import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    adminUserId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    beforeJson?: Prisma.InputJsonValue;
    afterJson?: Prisma.InputJsonValue;
    ip?: string;
    userAgent?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        adminUserId: data.adminUserId,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        beforeJson: data.beforeJson ?? undefined,
        afterJson: data.afterJson ?? undefined,
        ip: data.ip,
        userAgent: data.userAgent
      }
    });
  }
}
