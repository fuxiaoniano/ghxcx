import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import dayjs from 'dayjs';
import { AdminStatus, NotificationChannel, NotificationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WechatOfficialAccountService } from '../wechat-official-account/wechat-official-account.service';
import { WechatMiniService } from '../wechat-mini/wechat-mini.service';
import { BusinessException } from '../../common/utils/business-exception';
import { ConfigsService } from '../configs/configs.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly official: WechatOfficialAccountService,
    private readonly mini: WechatMiniService,
    private readonly configs: ConfigsService
  ) {}

  async sendConsultationAssignmentNotice(formId: string, ownerAdminId: string): Promise<void> {
    const config = await this.configs.getAppointmentNotifyConfig();
    if (!config.assignmentEnabled || !config.assignmentTemplateId) return;
    const [form, owner] = await Promise.all([
      this.prisma.consultationForm.findUnique({ where: { id: formId }, select: {
        id: true, name: true, phoneMasked: true, ownerAdminId: true, channelSource: true,
        promotionAccount: { select: { name: true, project: true } }
      } }),
      this.prisma.adminUser.findUnique({ where: { id: ownerAdminId }, select: {
        id: true, status: true, oaOpenId: true, nickname: true, username: true
      } })
    ]);
    if (!form || form.ownerAdminId !== ownerAdminId || !owner || owner.status !== AdminStatus.ACTIVE || !owner.oaOpenId) return;
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
      errorCode = 'HTTP_ERROR';
    }
    await this.prisma.auditLog.create({ data: {
      adminUserId: ownerAdminId,
      action: 'CONSULTATION_ASSIGN_NOTICE', resourceType: 'consultation_forms', resourceId: formId,
      afterJson: { result, errorCode, templateId: config.assignmentTemplateId } as Prisma.InputJsonValue
    } }).catch(() => undefined);
  }

  async sendAppointmentSuccess(appointmentId: string) {
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

    const officialResult = await this.sendOfficialAccountTemplate(appointment);
    if (officialResult === NotificationStatus.SUCCESS) {
      return { officialAccount: officialResult, miniProgram: NotificationStatus.SKIPPED };
    }
    const miniResult = await this.sendMiniSubscribe(appointment);
    return { officialAccount: officialResult, miniProgram: miniResult };
  }

  async sendStaffAppointmentNotice(appointmentId: string) {
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
        oaOpenId: { not: null }
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
      const recipientName = recipient.nickname || recipient.username;
      const payload = this.buildStaffOfficialPayload(appointment, recipient.oaOpenId || '', templateId, recipientName);
      const fallbackText = this.buildStaffNoticeText(appointment, recipientName);
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
        const response = await axios.post(
          `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${accessToken}`,
          payload
        );
        const ok = response.data.errcode === 0;
        await this.createLog({
          appointment,
          channel: NotificationChannel.OFFICIAL_ACCOUNT_TEMPLATE,
          targetOpenId: recipient.oaOpenId || null,
          templateId,
          payloadJson: payload,
          status: ok ? NotificationStatus.SUCCESS : NotificationStatus.FAILED,
          errorCode: ok ? undefined : String(response.data.errcode),
          errorMessage: ok ? undefined : response.data.errmsg
        });
        if (ok) {
          success += 1;
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
          errorCode: 'HTTP_ERROR',
          errorMessage: error instanceof Error ? error.message : '工作人员新预约通知发送异常'
        });
        const fallback = await this.sendStaffCustomTextFallback(
          appointment,
          recipient.oaOpenId || '',
          fallbackText,
          'HTTP_ERROR',
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
    await this.prisma.notificationLog.update({
      where: { id: log.id },
      data: { retryCount: { increment: 1 } }
    });
    const payload = log.payloadJson as Record<string, any> | null;
    if (
      payload?.kind === 'STAFF_APPOINTMENT_NOTICE' ||
      payload?.kind === 'STAFF_APPOINTMENT_NOTICE_CUSTOM_TEXT' ||
      payload?.data?.first?.value === '有新的预约信息'
    ) {
      return this.sendStaffAppointmentNotice(log.appointmentId);
    }
    return this.sendAppointmentSuccess(log.appointmentId);
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
      const response = await axios.post(
        `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${accessToken}`,
        payload
      );
      const ok = response.data.errcode === 0;
      await this.createLog({
        appointment,
        channel: NotificationChannel.OFFICIAL_ACCOUNT_TEMPLATE,
        targetOpenId: oaOpenId,
        templateId,
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
        targetOpenId: oaOpenId,
        templateId,
        payloadJson: payload,
        status: NotificationStatus.FAILED,
        errorCode: 'HTTP_ERROR',
        errorMessage: error instanceof Error ? error.message : '公众号模板消息发送异常'
      });
      return NotificationStatus.FAILED;
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

  private isMock(): boolean {
    const env = this.config.get<string>('NODE_ENV');
    return env === 'test';
  }
}
