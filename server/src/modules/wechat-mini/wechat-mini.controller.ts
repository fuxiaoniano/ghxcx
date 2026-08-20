import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, MiniCurrentUser } from '../../common/decorators/current-user.decorator';
import { MiniAuthGuard } from '../../common/guards/mini-auth.guard';
import { BindOfficialAccountDto, MiniLoginDto, MiniManualPhoneDto, MiniPhoneDto } from './dto';
import { WechatMiniService } from './wechat-mini.service';

@ApiTags('小程序微信能力')
@Controller('/api/wechat/mini')
export class WechatMiniController {
  constructor(private readonly mini: WechatMiniService) {}

  @Post('/login')
  login(@Body() dto: MiniLoginDto) {
    return this.mini.login(dto);
  }

  @ApiBearerAuth()
  @UseGuards(MiniAuthGuard)
  @Post('/phone')
  getPhone(@CurrentUser() user: MiniCurrentUser, @Body() dto: MiniPhoneDto) {
    return this.mini.authorizePhone(user.userId, dto.code);
  }

  @ApiBearerAuth()
  @UseGuards(MiniAuthGuard)
  @Post('/manual-phone')
  submitManualPhone(@CurrentUser() user: MiniCurrentUser, @Body() dto: MiniManualPhoneDto) {
    return this.mini.submitManualPhone(user.userId, dto.phone);
  }

  @ApiBearerAuth()
  @UseGuards(MiniAuthGuard)
  @Post('/bind-official-account')
  bindOfficialAccount(@CurrentUser() user: MiniCurrentUser, @Body() dto: BindOfficialAccountDto) {
    return this.mini.bindOfficialAccount(user.userId, dto.bindToken);
  }
}
