import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService
  ) {}

  async attachPhone(userId: string, phone: string) {
    const phoneEncrypted = this.crypto.encryptPhone(phone);
    const phoneHash = this.crypto.hashPhone(phone);
    const phoneMasked = this.crypto.maskPhone(phone);

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        phoneEncrypted,
        phoneHash,
        phoneMasked
      }
    });
  }

  async findByPhone(phone: string) {
    return this.prisma.user.findUnique({
      where: { phoneHash: this.crypto.hashPhone(phone) }
    });
  }
}
