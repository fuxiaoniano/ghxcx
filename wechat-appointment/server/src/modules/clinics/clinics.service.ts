import { Injectable } from '@nestjs/common';
import { ClinicStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ClinicsService {
  constructor(private readonly prisma: PrismaService) {}

  findActive() {
    return this.prisma.clinic.findMany({
      where: { status: ClinicStatus.ACTIVE },
      orderBy: { createdAt: 'asc' }
    });
  }
}
