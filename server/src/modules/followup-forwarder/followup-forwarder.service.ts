import { Injectable } from '@nestjs/common';
import axios from 'axios';
import dayjs from 'dayjs';
import { FollowupForwardStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../common/utils/business-exception';
import { CryptoService } from '../crypto/crypto.service';
import { ConfigsService, FollowupForwardConfig } from '../configs/configs.service';

type AppointmentWithClinic = Prisma.AppointmentGetPayload<{ include: { clinic: true } }>;

export interface FollowupForwardResult {
  status: FollowupForwardStatus;
  statusText: string;
  errorCode?: string;
  errorMessage?: string;
  response?: Prisma.InputJsonValue;
}

@Injectable()
export class FollowupForwarderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly configs: ConfigsService
  ) {}

  async forwardAppointment(appointmentId: string, options: { force?: boolean } = {}): Promise<FollowupForwardResult> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { clinic: true }
    });
    if (!appointment) {
      throw new BusinessException(404601, '挂号记录不存在');
    }
    if (appointment.followupForwardStatus === FollowupForwardStatus.SUCCESS && !options.force) {
      return {
        status: FollowupForwardStatus.SUCCESS,
        statusText: this.statusText(FollowupForwardStatus.SUCCESS),
        response: appointment.followupForwardResponse as Prisma.InputJsonValue | undefined
      };
    }

    const runtime = await this.configs.getFollowupForwardConfig();
    const triedAt = new Date();
    const isRetry = appointment.followupForwardStatus !== FollowupForwardStatus.PENDING || Boolean(options.force);
    if (!runtime.enabled) {
      return this.markSkipped(appointment.id, triedAt, isRetry, 'FOLLOWUP_FORWARD_DISABLED', '院内回访系统转发未启用');
    }
    if (!runtime.url) {
      return this.markFailed(appointment.id, triedAt, isRetry, 'NO_FOLLOWUP_FORWARD_URL', '未配置院内回访系统 API 地址');
    }

    const payload = this.buildPayload(appointment, runtime.includeFullPhone);
    try {
      const response = await axios.post(runtime.url, payload, {
        timeout: runtime.timeoutMs,
        headers: this.buildHeaders(runtime),
        validateStatus: () => true
      });
      const responseJson = this.responseJson(response.status, response.data);
      const business = this.resolveBusinessResult(response.status, response.data);
      if (business.ok) {
        await this.prisma.appointment.update({
          where: { id: appointment.id },
          data: {
            followupForwardStatus: FollowupForwardStatus.SUCCESS,
            followupForwardedAt: triedAt,
            followupForwardLastTriedAt: triedAt,
            followupForwardErrorCode: null,
            followupForwardErrorMessage: null,
            followupForwardResponse: responseJson,
            followupForwardRetryCount: isRetry ? { increment: 1 } : undefined
          }
        });
        return {
          status: FollowupForwardStatus.SUCCESS,
          statusText: this.statusText(FollowupForwardStatus.SUCCESS),
          response: responseJson
        };
      }
      return this.markFailed(
        appointment.id,
        triedAt,
        isRetry,
        business.errorCode,
        business.errorMessage,
        responseJson
      );
    } catch (error) {
      return this.markFailed(
        appointment.id,
        triedAt,
        isRetry,
        'HTTP_ERROR',
        error instanceof Error ? error.message : '院内回访系统 API 调用异常'
      );
    }
  }

  private buildPayload(appointment: AppointmentWithClinic, includeFullPhone: boolean) {
    const fullPhone = includeFullPhone ? this.decryptPhoneSafely(appointment.phoneEncrypted) : '';
    return {
      event: 'APPOINTMENT_CREATED',
      appointment: {
        id: appointment.id,
        appointmentNo: appointment.appointmentNo,
        name: appointment.name,
        phone: fullPhone || appointment.phoneMasked,
        phoneMasked: appointment.phoneMasked,
        ageRange: appointment.ageRange,
        missingTeethType: appointment.missingTeethType,
        clinic: appointment.clinic
          ? {
              id: appointment.clinic.id,
              name: appointment.clinic.name,
              address: appointment.clinic.address,
              phone: appointment.clinic.phone
            }
          : null,
        source: appointment.source,
        status: appointment.status,
        remark: appointment.remark,
        submittedAt: appointment.createdAt.toISOString(),
        submittedAtText: dayjs(appointment.createdAt).format('YYYY-MM-DD HH:mm:ss')
      }
    };
  }

  private buildHeaders(runtime: FollowupForwardConfig) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...runtime.extraHeaders
    };
    if (runtime.authToken) {
      headers[runtime.authHeader] = runtime.authScheme
        ? `${runtime.authScheme} ${runtime.authToken}`
        : runtime.authToken;
    }
    return headers;
  }

  private async markSkipped(
    appointmentId: string,
    triedAt: Date,
    isRetry: boolean,
    errorCode: string,
    errorMessage: string
  ): Promise<FollowupForwardResult> {
    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        followupForwardStatus: FollowupForwardStatus.SKIPPED,
        followupForwardLastTriedAt: triedAt,
        followupForwardErrorCode: errorCode,
        followupForwardErrorMessage: errorMessage,
        followupForwardRetryCount: isRetry ? { increment: 1 } : undefined
      }
    });
    return {
      status: FollowupForwardStatus.SKIPPED,
      statusText: this.statusText(FollowupForwardStatus.SKIPPED),
      errorCode,
      errorMessage
    };
  }

  private async markFailed(
    appointmentId: string,
    triedAt: Date,
    isRetry: boolean,
    errorCode: string,
    errorMessage: string,
    response?: Prisma.InputJsonValue
  ): Promise<FollowupForwardResult> {
    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        followupForwardStatus: FollowupForwardStatus.FAILED,
        followupForwardLastTriedAt: triedAt,
        followupForwardErrorCode: errorCode,
        followupForwardErrorMessage: errorMessage.slice(0, 2000),
        followupForwardResponse: response,
        followupForwardRetryCount: isRetry ? { increment: 1 } : undefined
      }
    });
    return {
      status: FollowupForwardStatus.FAILED,
      statusText: this.statusText(FollowupForwardStatus.FAILED),
      errorCode,
      errorMessage
    };
  }

  private resolveBusinessResult(
    statusCode: number,
    body: unknown
  ): { ok: true } | { ok: false; errorCode: string; errorMessage: string } {
    if (statusCode < 200 || statusCode >= 300) {
      return {
        ok: false,
        errorCode: `HTTP_${statusCode}`,
        errorMessage: this.extractMessage(body) || `院内回访系统返回 HTTP ${statusCode}`
      };
    }
    if (!body || typeof body !== 'object') {
      return { ok: true };
    }
    const data = body as Record<string, unknown>;
    if (data.success === false) {
      return {
        ok: false,
        errorCode: String(data.code || data.errcode || 'BUSINESS_FAILED'),
        errorMessage: this.extractMessage(data) || '院内回访系统返回失败'
      };
    }
    const code = data.code ?? data.errcode;
    if (code !== undefined && !['0', '200', 'OK', 'SUCCESS'].includes(String(code).toUpperCase())) {
      return {
        ok: false,
        errorCode: String(code),
        errorMessage: this.extractMessage(data) || '院内回访系统返回失败'
      };
    }
    return { ok: true };
  }

  private responseJson(statusCode: number, body: unknown): Prisma.InputJsonValue {
    return {
      statusCode,
      body: this.toJsonValue(body)
    };
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    try {
      return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
    } catch {
      return { value: String(value) };
    }
  }

  private extractMessage(body: unknown) {
    if (!body || typeof body !== 'object') {
      return '';
    }
    const data = body as Record<string, unknown>;
    return String(data.message || data.msg || data.errmsg || data.error || '');
  }

  private decryptPhoneSafely(phoneEncrypted: string) {
    try {
      return this.crypto.decryptPhone(phoneEncrypted);
    } catch {
      return '';
    }
  }

  private statusText(status: FollowupForwardStatus) {
    const map: Record<FollowupForwardStatus, string> = {
      PENDING: '待转发',
      SUCCESS: '已转发',
      FAILED: '转发失败',
      SKIPPED: '未启用'
    };
    return map[status];
  }
}
