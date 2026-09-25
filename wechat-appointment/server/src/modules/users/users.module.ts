import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { CryptoModule } from '../crypto/crypto.module';

@Module({
  imports: [CryptoModule],
  providers: [UsersService],
  exports: [UsersService]
})
export class UsersModule {}
