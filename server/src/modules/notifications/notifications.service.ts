import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Inject, Optional } from '@nestjs/common';
import axios from 'axios';
import { createHash, randomBytes } from 'crypto';
import dayjs from 'dayjs';
import Redis from 'ioredis';
import { AdminStatus, NotificationChannel, NotificationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WechatOfficialAccountService } from '../wechat-official-account/wechat-official-account.service';
import { WechatMiniService } from '../wechat-mini/wechat-mini.service';
import { BusinessException } from '../../common/utils/business-exception';
import { ConfigsService } from '../configs/configs.service';

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private assignmentTimer?: ReturnType<typeof setInterval>;
  private assignmentWorkerRunning = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly official: WechatOfficialAccountService,
    private readonly mini: WechatMiniService,
    private readonly configs: ConfigsService,
    @Optional() @Inject('REDIS') private readonly redis?: Redis
  ) {}

  onModuleInit() {
    this.assignmentTimer = setInterval(() => void this.runAssignmentNoticeWorker(), 5000);
    this.assignmentTimer.unref?.();
    void this.runAssignmentNoticeWorker();
  }

  onModuleDestroy() {
    if (this.assignmentTimer) clearInterval(this.assignmentTimer);
  }

  async sendConsultationAssignmentNotice(formId: string, ownerAdminId: string): Promise<{ status: string; errorCode: string }> {
    const config = await this.configs.getAppointmentNotifyConfig();
    if (!config.assignmentEnabled || !config.assignmentTemplateId) return { status: 'SKIPPED', errorCode: 'DISABLED' };
    const [form, owner] = await Promise.all([
      this.prisma.consultationForm.findUnique({ where: { id: formId }, select: {
        id: true, name: true, phoneMasked: true, ownerAdminId: true, channelSource: true,
        promotionAccount: { select: { name: true, project: true } }
      } }),
      this.prisma.adminUser.findUnique({ where: { id: ownerAdminId }, select: {
        id: true, status: true, oaOpenId: true, nickname: true, username: true
      } })
    ]);
    if (!form || form.ownerAdminId !== ownerAdminId || !owner || owner.status !== AdminStatus.ACTIVE || !owner.oaOpenId) {
      return { status: 'SKIPPED', errorCode: 'RECIPIENT_UNAVAILABLE' };
    }
    const payload = {
      touser: owner.oaOpenId,
      template_id: config.assignmentTemplateId,
      data: {
        first: { value: '您有一条新的网咨表单待跟进' },
        keyword1: { value: form.id },
        keyword2: { value: form.name },
        keyword3: { value: form.promotionAccount?.project || '未填写' },
        keyword4: { value: dayjs().format('YYYY-MM-DD HH:mm:ss') },
        remark: { value: `电话：${form.phoneMasked}；来源：${form.channelSource || '未填写'}；账户：${form.promotionAccount?.name || '未填写'}` }
      }
    };
    let result = 'FAILED';
    let errorCode = '';
    try {
      if (this.isMock()) {
        result = 'MOCK_SENT';
      } else {
        const accessToken = await this.official.getAccessToken();
        const response = await axios.post(
          `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${accessToken}`,
          payload, { timeout: 10000 }
        );
        errorCode = String(response.data?.errcode ?? 'NO_CODE');
        if (response.data?.errcode === 0) result = 'SENT';
      }
    } catch {
      result = 'UNKNOWN';
      errorCode = 'HTTP_ERROR';
    }
    await this.prisma.auditLog.create({ data: {
      adminUserId: ownerAdminId,
      action: 'CONSULTATION_ASSIGN_NOTICE', resourceType: 'consultation_forms', resourceId: formId,
      afterJson: { result, errorCode, templateId: config.assignmentTemplateId } as Prisma.InputJsonValue
    } }).catch(() => undefined);
    return { status: result, errorCode };
  }

  private async runAssignmentNoticeWorker() {
    if (this.assignmentWorkerRunning) return;
    this.assignmentWorkerRunning = true;
    try {
      const staleAt = new Date(Date.now() - 2 * 60 * 1000);
      await this.prisma.consultationAssignmentNoticeJob.updateMany({
        where: { status: 'SENDING', updatedAt: { lt: staleAt } },
        data: { status: 'UNKNOWN', lastErrorCode: 'WORKER_INTERRUPTED' },
      });
      const jobs = await this.prisma.consultationAssignmentNoticeJob.findMany({
        where: { status: 'PENDING', availableAt: { lte: new Date() } },
        orderBy: [{ createdAt: 'asc' }],
        take: 10,
      });
      for (const job of jobs) {
        const claimed = await this.prisma.consultationAssignmentNoticeJob.updateMany({
          where: { id: job.id, status: 'PENDING' },
          data: { status: 'SENDING', attemptCount: { increment: 1 } },
        });
        if (!claimed.count) continue;
        const result = await this.sendConsultationAssignmentNotice(job.formId, job.ownerAdminId);
        await this.prisma.consultationAssignmentNoticeJob.update({
          where: { id: job.id },
          data: {
            status: result.status,
            lastErrorCode: result.errorCode || null,
            completedAt: ['SENT', 'MOCK_SENT', 'SKIPPED', 'FAILED'].includes(result.status) ? new Date() : null,
          },
        });
      }
    } catch (error) {
      this.logger.error(`网咨分配通知任务处理失败: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      this.assignmentWorkerRunning = false;
    }
  }

  async sendAppointmentSuccess(appointmentId: string, options: { force?: boolean } = {}) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        clinic: true,
        user: { include: { identities: true } }
      }
    });
    if (!appointment) {
      throw new BusinessException(404101, '挂号记录不存在');
    }
    if (!options.force && await this.hasSettledPatientNotice(appointmentId)) {
      return { officialAccount: NotificationStatus.SKIPPED, miniProgram: NotificationStatus.SKIPPED, reason: '已有成功或结果待核实记录，已阻止自动重复发送' };
    }

    const officialResult = await this.sendOfficialAccountTemplate(appointment);
    if (officialResult === NotificationStatus.SUCCESS) {
      return { officialAccount: officialResult, miniProgram: NotificationStatus.SKIPPED };
    }
    if (officialResult === 'UNKNOWN') {
      return { officialAccount: NotificationStatus.FAILED, miniProgram: NotificationStatus.SKIPPED, reason: '公众号发送结果待核实，未自动发送备用通知' };
    }
    const miniResult = await this.sendMiniSubscribe(appointment);
    return { officialAccount: officialResult, miniProgram: miniResult };
  }

  async sendStaffAppointmentNotice(appointmentId: string, targetOpenId?: string, force = false) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        clinic: true,
        user: { include: { identities: true } }
      }
    });
    if (!appointment) {
      throw new BusinessException(404103, '挂号记录不存在');
    }
    const config = await this.configs.getAppointmentNotifyConfig();
    const recipients = await this.prisma.adminUser.findMany({
      where: {
        status: AdminStatus.ACTIVE,
        notifyEnabled: true,
        oaOpenId: targetOpenId || { not: null }
      },
      select: { nickname: true, username: true, oaOpenId: true }
    });
    const templateId = config.templateId || this.config.get<string>('OFFICIAL_ACCOUNT_TEMPLATE_APPOINTMENT_SUCCESS');
    if (!config.enabled) {
      await this.createLog({
        appointment,
        channel: NotificationChannel.OFFICIAL_ACCOUNT_TEMPLATE,
        targetOpenId: null,
        templateId,
        payloadJson: { kind: 'STAFF_APPOINTMENT_NOTICE', reason: 'disabled' },
        status: NotificationStatus.SKIPPED,
        errorCode: 'STAFF_NOTICE_DISABLED',
        errorMessage: '新预约工作人员通知未启用'
      });
      return { total: 0, success: 0, failed: 0, skipped: 1 };
    }
    if (!templateId) {
      await this.createLog({
        appointment,
        channel: NotificationChannel.OFFICIAL_ACCOUNT_TEMPLATE,
        targetOpenId: null,
        templateId,
        payloadJson: { kind: 'STAFF_APPOINTMENT_NOTICE' },
        status: NotificationStatus.FAILED,
        errorCode: 'NO_TEMPLATE_ID',
        errorMessage: '未配置工作人员新预约通知模板 ID'
      });
      return { total: 0, success: 0, failed: 1, skipped: 0 };
    }
    if (recipients.length === 0) {
      await this.createLog({
        appointment,
        channel: NotificationChannel.OFFICIAL_ACCOUNT_TEMPLATE,
        targetOpenId: null,
        templateId,
        payloadJson: { kind: 'STAFF_APPOINTMENT_NOTICE' },
        status: NotificationStatus.SKIPPED,
        errorCode: 'NO_STAFF_RECIPIENT',
        errorMessage: '未绑定启用的预约通知接收人'
      });
      return { total: 0, success: 0, failed: 0, skipped: 1 };
    }

    let success = 0;
    let failed = 0;
    for (const recipient of recipients) {
      if (!force && recipient.oaOpenId && await this.hasSettledStaffNotice(appointmentId, recipient.oaOpenId)) {
        success += 1;
        continue;
      }
      const recipientName = recipient.nickname || recipient.username;
      const payload = this.buildStaffOfficialPayload(appointment, recipient.oaOpenId || '', templateId, recipientName);
      const fallbackText = this.buildStaffNoticeText(appointment, recipientName);
      let requestStarted = false;
      try {
        if (this.isMock()) {
          await this.createLog({
            appointment,
            channel: NotificationChannel.OFFICIAL_ACCOUNT_TEMPLATE,
            targetOpenId: recipient.oaOpenId || null,
            templateId,
            payloadJson: payload,
            status: NotificationStatus.SUCCESS
          });
          success += 1;
          continue;
        }
        const accessToken = await this.official.getAccessToken();
        requestStarted = true;
        const response = await axios.post(
          `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${accessToken}`,
          payload
        );
        const ok = response.data?.errcode === 0;
        const unknownResponse = response.data?.errcode === undefined || response.data?.errcode === null;
        await this.createLog({
          appointment,
          channel: NotificationChannel.OFFICIAL_ACCOUNT_TEMPLATE,
          targetOpenId: recipient.oaOpenId || null,
          templateId,
          payloadJson: payload,
          status: ok ? NotificationStatus.SUCCESS : NotificationStatus.FAILED,
          errorCode: ok ? undefined : unknownResponse ? 'UNKNOWN_RESPONSE' : String(response.data.errcode),
          errorMessage: ok ? undefined : unknownResponse ? '微信响应缺少业务状态，发送结果待核实' : response.data.errmsg
        });
        if (ok) {
          success += 1;
        } else if (unknownResponse) {
          failed += 1;
        } else {
          const fallback = await this.sendStaffCustomTextFallback(
            appointment,
            recipient.oaOpenId || '',
            fallbackText,
            String(response.data.errcode),
            response.data.errmsg
          );
          if (fallback === NotificationStatus.SUCCESS) success += 1;
          else failed += 1;
        }
      } catch (error) {
        await this.createLog({
          appointment,
          channel: NotificationChannel.OFFICIAL_ACCOUNT_TEMPLATE,
          targetOpenId: recipient.oaOpenId || null,
          templateId,
          payloadJson: payload,
          status: NotificationStatus.FAILED,
          errorCode: requestStarted ? 'HTTP_ERROR' : 'TOKEN_ERROR',
          errorMessage: error instanceof Error ? error.message : '工作人员新预约通知发送异常'
        });
        if (requestStarted) { failed += 1; continue; }
        const fallback = await this.sendStaffCustomTextFallback(
          appointment,
          recipient.oaOpenId || '',
          fallbackText,
          'TOKEN_ERROR',
          error instanceof Error ? error.message : '工作人员新预约通知发送异常'
        );
        if (fallback === NotificationStatus.SUCCESS) success += 1;
        else failed += 1;
      }
    }
    return { total: recipients.length, success, failed, skipped: 0 };
  }

  async retryNotification(logId: string) {
    const log = await this.prisma.notificationLog.findUnique({ where: { id: logId } });
    if (!log || !log.appointmentId) {
      throw new BusinessException(404102, '通知记录不存在或无法重试');
    }
    if (log.status === NotificationStatus.SUCCESS) {
      throw new BusinessException(400104, '通知已发送成功，无需重试', 400);
    }
    const payload = log.payloadJson as Record<string, any> | null;
    const isStaff = Boolean(
      payload?.kind === 'STAFF_APPOINTMENT_NOTICE' ||
      payload?.kind === 'STAFF_APPOINTMENT_NOTICE_CUSTOM_TEXT' ||
      payload?.data?.first?.value === '有新的预约信息'
    );
    if (log.status === NotificationStatus.PENDING) throw new BusinessException(400105, '通知正在处理或结果待核实，不能重复重试', 400);
    if (isStaff && !log.targetOpenId) throw new BusinessException(400106, '通知未记录接收人，请先核实接收人后处理', 400);
    if (!this.redis) throw new BusinessException(503104, '通知重试服务暂不可用，请稍后重试', 503);
    const lockIdentity = `${log.appointmentId}:${isStaff ? `staff:${log.targetOpenId}` : 'patient'}`;
    const lockKey = `notification-retry:${createHash('sha256').update(lockIdentity).digest('hex')}`;
    const lockToken = randomBytes(16).toString('hex');
    let locked = false;
    try { locked = await this.redis.set(lockKey, lockToken, 'PX', 120_000, 'NX') === 'OK'; }
    catch { throw new BusinessException(503104, '通知重试服务暂不可用，请稍后重试', 503); }
    if (!locked) throw new BusinessException(400105, '通知正在处理或结果待核实，不能重复重试', 400);
    try {
    const related = await this.prisma.notificationLog.findMany({
      where: { appointmentId: log.appointmentId, ...(isStaff ? { targetOpenId: log.targetOpenId } : {}) },
      select: { id: true, status: true, errorCode: true, payloadJson: true }
    });
    const sameKind = related.filter((item) => {
      const data = item.payloadJson as Record<string, any> | null;
      const staff = Boolean(data?.kind === 'STAFF_APPOINTMENT_NOTICE' || data?.kind === 'STAFF_APPOINTMENT_NOTICE_CUSTOM_TEXT' || data?.data?.first?.value === '有新的预约信息');
      return staff === isStaff;
    });
    if (sameKind.some((item) => item.status === NotificationStatus.SUCCESS)) throw new BusinessException(400107, '该通知已有成功记录，无需重试', 400);
    if (sameKind.some((item) => ['HTTP_ERROR', 'CUSTOM_TEXT_HTTP_ERROR', 'UNKNOWN_RESPONSE'].includes(item.errorCode || '') || (item.id !== log.id && item.status === NotificationStatus.PENDING))) {
      throw new BusinessException(400108, '发送结果不明或正在处理，请先核实接收情况', 400);
    }
    const claimed = await this.prisma.notificationLog.updateMany({ where: { id: log.id, status: log.status }, data: { status: NotificationStatus.PENDING, retryCount: { increment: 1 } } });
    if (!claimed.count) throw new BusinessException(400105, '通知正在处理或结果待核实，不能重复重试', 400);
    let completed = false;
    try {
      const result = isStaff ? await this.sendStaffAppointmentNotice(log.appointmentId, log.targetOpenId!, true) : await this.sendAppointmentSuccess(log.appointmentId, { force: true });
      completed = true;
      return result;
    } finally {
      if (completed) await this.prisma.notificationLog.updateMany({ where: { id: log.id, status: NotificationStatus.PENDING }, data: { status: log.status } });
    }
    } finally {
      await this.redis.eval("if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end", 1, lockKey, lockToken).catch(() => undefined);
    }
  }

  private async sendOfficialAccountTemplate(
    appointment: Prisma.AppointmentGetPayload<{ include: { clinic: true; user: { include: { identities: true } } } }>
  ) {
    const pageConfig = await this.configs.getLandingPageForAppointment(appointment.landingPageId);
    const templateId =
      pageConfig.officialAccountTemplateId ||
      this.config.get<string>('OFFICIAL_ACCOUNT_TEMPLATE_APPOINTMENT_SUCCESS');
    const oaOpenId = appointment.user.identities.find((item) => item.oaOpenId)?.oaOpenId;
    const payload = this.buildOfficialPayload(appointment, oaOpenId || '', templateId || '');
    if (!oaOpenId) {
      await this.createLog({
        appointment,
        channel: NotificationChannel.OFFICIAL_ACCOUNT_TEMPLATE,
        targetOpenId: null,
        templateId,
        payloadJson: payload,
        status: NotificationStatus.FAILED,
        errorCode: 'NO_OA_OPENID',
        errorMessage: '用户未绑定公众号 openid，无法发送公众号模板消息'
      });
      return NotificationStatus.FAILED;
    }
    if (!templateId) {
      await this.createLog({
        appointment,
        channel: NotificationChannel.OFFICIAL_ACCOUNT_TEMPLATE,
        targetOpenId: oaOpenId,
        templateId,
        payloadJson: payload,
        status: NotificationStatus.FAILED,
        errorCode: 'NO_TEMPLATE_ID',
        errorMessage: '未配置公众号模板消息 ID'
      });
      return NotificationStatus.FAILED;
    }
    let requestStarted = false;
    try {
      if (this.isMock()) {
        await this.createLog({
          appointment,
          channel: NotificationChannel.OFFICIAL_ACCOUNT_TEMPLATE,
          targetOpenId: oaOpenId,
          templateId,
          payloadJson: payload,
          status: NotificationStatus.SUCCESS
        });
        return NotificationStatus.SUCCESS;
      }
      const accessToken = await this.official.getAccessToken();
      requestStarted = true;
      const response = await axios.post(
        `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${accessToken}`,
        payload
      );
      const ok = response.data?.errcode === 0;
      const unknownResponse = response.data?.errcode === undefined || response.data?.errcode === null;
      await this.createLog({
        appointment,
        channel: NotificationChannel.OFFICIAL_ACCOUNT_TEMPLATE,
        targetOpenId: oaOpenId,
        templateId,
        payloadJson: payload,
        status: ok ? NotificationStatus.SUCCESS : NotificationStatus.FAILED,
        errorCode: ok ? undefined : unknownResponse ? 'UNKNOWN_RESPONSE' : String(response.data.errcode),
        errorMessage: ok ? undefined : unknownResponse ? '微信响应缺少业务状态，发送结果待核实' : response.data.errmsg
      });
      return ok ? NotificationStatus.SUCCESS : unknownResponse ? 'UNKNOWN' as const : NotificationStatus.FAILED;
    } catch (error) {
      await this.createLog({
        appointment,
        channel: NotificationChannel.OFFICIAL_ACCOUNT_TEMPLATE,
        targetOpenId: oaOpenId,
        templateId,
        payloadJson: payload,
        status: NotificationStatus.FAILED,
        errorCode: requestStarted ? 'HTTP_ERROR' : 'TOKEN_ERROR',
        errorMessage: error instanceof Error ? error.message : '公众号模板消息发送异常'
      });
      return requestStarted ? 'UNKNOWN' as const : NotificationStatus.FAILED;
    }
  }

  private async sendMiniSubscribe(
    appointment: Prisma.AppointmentGetPayload<{ include: { clinic: true; user: { include: { identities: true } } } }>
  ) {
    const pageConfig = await this.configs.getLandingPageForAppointment(appointment.landingPageId);
    const templateId =
      pageConfig.miniSubscribeTemplateId ||
      this.config.get<string>('MINI_SUBSCRIBE_TEMPLATE_APPOINTMENT_SUCCESS');
    const miniOpenId = appointment.user.identities.find((item) => item.miniOpenId)?.miniOpenId;
    const payload = this.buildMiniPayload(
      appointment,
      miniOpenId || '',
      templateId || '',
      pageConfig.institutionName
    );
    if (!miniOpenId) {
      await this.createLog({
        appointment,
        channel: NotificationChannel.MINI_PROGRAM_SUBSCRIBE,
        targetOpenId: null,
        templateId,
        payloadJson: payload,
        status: NotificationStatus.FAILED,
        errorCode: 'NO_MINI_OPENID',
        errorMessage: '用户没有小程序 openid，无法发送订阅消息'
      });
      return NotificationStatus.FAILED;
    }
    if (!templateId) {
      await this.createLog({
        appointment,
        channel: NotificationChannel.MINI_PROGRAM_SUBSCRIBE,
        targetOpenId: miniOpenId,
        templateId,
        payloadJson: payload,
        status: NotificationStatus.FAILED,
        errorCode: 'NO_TEMPLATE_ID',
        errorMessage: '未配置小程序订阅消息模板 ID'
      });
      return NotificationStatus.FAILED;
    }
    try {
      if (this.isMock()) {
        await this.createLog({
          appointment,
          channel: NotificationChannel.MINI_PROGRAM_SUBSCRIBE,
          targetOpenId: miniOpenId,
          templateId,
          payloadJson: payload,
          status: NotificationStatus.SUCCESS
        });
        return NotificationStatus.SUCCESS;
      }
      const accessToken = await this.mini.getAccessToken();
      const response = await axios.post(
        `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`,
        payload
      );
      const skipped = response.data.errcode === 43101;
      const ok = response.data.errcode === 0;
      await this.createLog({
        appointment,
        channel: NotificationChannel.MINI_PROGRAM_SUBSCRIBE,
        targetOpenId: miniOpenId,
        templateId,
        payloadJson: payload,
        status: ok ? NotificationStatus.SUCCESS : skipped ? NotificationStatus.SKIPPED : NotificationStatus.FAILED,
        errorCode: ok ? undefined : String(response.data.errcode),
        errorMessage: ok ? undefined : response.data.errmsg
      });
      return ok ? NotificationStatus.SUCCESS : skipped ? NotificationStatus.SKIPPED : NotificationStatus.FAILED;
    } catch (error) {
      await this.createLog({
        appointment,
        channel: NotificationChannel.MINI_PROGRAM_SUBSCRIBE,
        targetOpenId: miniOpenId,
        templateId,
        payloadJson: payload,
        status: NotificationStatus.FAILED,
        errorCode: 'HTTP_ERROR',
        errorMessage: error instanceof Error ? error.message : '小程序订阅消息发送异常'
      });
      return NotificationStatus.FAILED;
    }
  }

  private buildOfficialPayload(
    appointment: Prisma.AppointmentGetPayload<{ include: { clinic: true; user: { include: { identities: true } } } }>,
    oaOpenId: string,
    templateId: string
  ) {
    const submittedAt = dayjs(appointment.createdAt).format('YYYY-MM-DD HH:mm');
    const content = [
      `挂号成功，编号：${appointment.appointmentNo}`,
      `姓名：${appointment.name}`,
      `预约项目：${appointment.missingTeethType}`,
      `提交时间：${submittedAt}`,
      '工作人员将在 24 小时内联系您，请保持电话畅通。'
    ].join('\n');

    return {
      touser: oaOpenId,
      template_id: templateId,
      miniprogram: {
        appid: this.config.get<string>('MINI_APP_ID'),
        pagepath: `pages/success/success?id=${appointment.id}`
      },
      data: {
        content: { value: content },
        first: { value: '挂号成功' },
        keyword1: { value: appointment.appointmentNo },
        keyword2: { value: appointment.name },
        keyword3: { value: appointment.missingTeethType },
        keyword4: { value: submittedAt },
        remark: { value: '工作人员将在 24 小时内联系您，请保持电话畅通。' }
      }
    };
  }

  private buildStaffOfficialPayload(
    appointment: Prisma.AppointmentGetPayload<{ include: { clinic: true; user: { include: { identities: true } } } }>,
    oaOpenId: string,
    templateId: string,
    recipientName: string
  ) {
    const submittedAt = dayjs(appointment.createdAt).format('YYYY-MM-DD HH:mm');
    const clinicName = appointment.clinic?.name || '未选择门店';
    const content = this.buildStaffNoticeText(appointment, recipientName);

    return {
      kind: 'STAFF_APPOINTMENT_NOTICE',
      touser: oaOpenId,
      template_id: templateId,
      data: {
        content: { value: content },
        first: { value: '有新的预约信息' },
        keyword1: { value: appointment.appointmentNo },
        keyword2: { value: appointment.name },
        keyword3: { value: appointment.missingTeethType },
        keyword4: { value: submittedAt },
        phone_number3: { value: appointment.phoneMasked },
        thing2: { value: this.templateThing(appointment.name || '预约客户') },
        thing15: { value: this.templateThing(appointment.missingTeethType || '种牙咨询') },
        remark: { value: `手机号：${appointment.phoneMasked}；门店：${clinicName}` }
      }
    };
  }

  private buildMiniPayload(
    appointment: Prisma.AppointmentGetPayload<{ include: { clinic: true; user: { include: { identities: true } } } }>,
    miniOpenId: string,
    templateId: string,
    institutionName: string
  ) {
    const department = appointment.clinic?.name || appointment.missingTeethType || '口腔咨询';
    return {
      touser: miniOpenId,
      template_id: templateId,
      page: `pages/success/success?id=${appointment.id}`,
      data: {
        // 字段名必须与微信后台模板完全一致，否则微信返回 47003。
        thing1: { value: this.templateThing('您的挂号已提交，请保持电话畅通') },
        phrase2: { value: String(appointment.name || '用户').slice(0, 5) },
        thing5: { value: this.templateThing(department) },
        date14: { value: dayjs(appointment.createdAt).format('YYYY-MM-DD HH:mm') },
        thing4: { value: this.templateThing(institutionName || '口腔医疗机构') }
      }
    };
  }

  private buildStaffNoticeText(
    appointment: Prisma.AppointmentGetPayload<{ include: { clinic: true; user: { include: { identities: true } } } }>,
    recipientName: string
  ) {
    const submittedAt = dayjs(appointment.createdAt).format('YYYY-MM-DD HH:mm');
    const clinicName = appointment.clinic?.name || '未选择门店';
    return [
      `新预约提醒：${appointment.appointmentNo}`,
      `接收人：${recipientName}`,
      `姓名：${appointment.name}`,
      `手机号：${appointment.phoneMasked}`,
      `年龄段：${appointment.ageRange}`,
      `缺牙情况：${appointment.missingTeethType}`,
      `期望门店：${clinicName}`,
      `来源：${appointment.source || '未知'}`,
      `提交时间：${submittedAt}`,
      appointment.remark ? `备注：${appointment.remark}` : ''
    ].filter(Boolean).join('\n');
  }

  private templateThing(value: string) {
    return String(value || '').slice(0, 20);
  }

  private async sendStaffCustomTextFallback(
    appointment: Prisma.AppointmentGetPayload<{ include: { clinic: true; user: { include: { identities: true } } } }>,
    oaOpenId: string,
    content: string,
    reasonCode?: string,
    reasonMessage?: string
  ) {
    const payload = {
      kind: 'STAFF_APPOINTMENT_NOTICE_CUSTOM_TEXT',
      touser: oaOpenId,
      msgtype: 'text',
      text: { content },
      fallbackFrom: {
        channel: 'OFFICIAL_ACCOUNT_TEMPLATE',
        errorCode: reasonCode,
        errorMessage: reasonMessage
      }
    };
    try {
      if (this.isMock()) {
        await this.createLog({
          appointment,
          channel: NotificationChannel.OFFICIAL_ACCOUNT_TEMPLATE,
          targetOpenId: oaOpenId || null,
          templateId: 'CUSTOM_TEXT_FALLBACK',
          payloadJson: payload,
          status: NotificationStatus.SUCCESS
        });
        return NotificationStatus.SUCCESS;
      }
      const accessToken = await this.official.getAccessToken();
      const response = await axios.post(
        `https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=${accessToken}`,
        {
          touser: oaOpenId,
          msgtype: 'text',
          text: { content }
        }
      );
      const ok = response.data.errcode === 0;
      await this.createLog({
        appointment,
        channel: NotificationChannel.OFFICIAL_ACCOUNT_TEMPLATE,
        targetOpenId: oaOpenId || null,
        templateId: 'CUSTOM_TEXT_FALLBACK',
        payloadJson: payload,
        status: ok ? NotificationStatus.SUCCESS : NotificationStatus.FAILED,
        errorCode: ok ? undefined : String(response.data.errcode),
        errorMessage: ok ? undefined : response.data.errmsg
      });
      return ok ? NotificationStatus.SUCCESS : NotificationStatus.FAILED;
    } catch (error) {
      await this.createLog({
        appointment,
        channel: NotificationChannel.OFFICIAL_ACCOUNT_TEMPLATE,
        targetOpenId: oaOpenId || null,
        templateId: 'CUSTOM_TEXT_FALLBACK',
        payloadJson: payload,
        status: NotificationStatus.FAILED,
        errorCode: 'CUSTOM_TEXT_HTTP_ERROR',
        errorMessage: error instanceof Error ? error.message : '工作人员客服文本消息发送异常'
      });
      return NotificationStatus.FAILED;
    }
  }

  private createLog(input: {
    appointment: Prisma.AppointmentGetPayload<{ include: { clinic: true; user: { include: { identities: true } } } }>;
    channel: NotificationChannel;
    targetOpenId: string | null;
    templateId?: string;
    payloadJson: Prisma.InputJsonValue;
    status: NotificationStatus;
    errorCode?: string;
    errorMessage?: string;
  }) {
    return this.prisma.notificationLog.create({
      data: {
        userId: input.appointment.userId,
        appointmentId: input.appointment.id,
        channel: input.channel,
        targetOpenId: input.targetOpenId,
        templateId: input.templateId,
        payloadJson: input.payloadJson,
        status: input.status,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        sentAt: input.status === NotificationStatus.SUCCESS ? new Date() : undefined
      }
    });
  }

  private async hasSettledPatientNotice(appointmentId: string) {
    const rows = await this.prisma.notificationLog.findMany({ where: { appointmentId, OR: [{ status: NotificationStatus.SUCCESS }, { errorCode: { in: ['HTTP_ERROR', 'UNKNOWN_RESPONSE'] } }] }, select: { payloadJson: true } });
    return rows.some((row) => (row.payloadJson as Record<string, unknown> | null)?.kind !== 'STAFF_APPOINTMENT_NOTICE');
  }

  private async hasSettledStaffNotice(appointmentId: string, targetOpenId: string) {
    const rows = await this.prisma.notificationLog.findMany({ where: { appointmentId, targetOpenId, OR: [{ status: NotificationStatus.SUCCESS }, { errorCode: { in: ['HTTP_ERROR', 'UNKNOWN_RESPONSE', 'CUSTOM_TEXT_HTTP_ERROR'] } }] }, select: { payloadJson: true } });
    return rows.some((row) => (row.payloadJson as Record<string, unknown> | null)?.kind === 'STAFF_APPOINTMENT_NOTICE');
  }

  private isMock(): boolean {
    const env = this.config.get<string>('NODE_ENV');
    return env === 'test';
  }
}
