import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { WechatMiniService } from './wechat-mini.service';

@ApiTags('小程序消息推送')
@Controller('/wechat/mini')
export class WechatMiniMessageController {
  constructor(private readonly mini: WechatMiniService) {}

  @Get('/callback')
  verify(
    @Query('signature') signature: string,
    @Query('timestamp') timestamp: string,
    @Query('nonce') nonce: string,
    @Query('echostr') echostr: string,
    @Res() res: Response
  ) {
    if (this.mini.verifyMessageSignature(signature, timestamp, nonce)) {
      res.type('text/plain').send(echostr);
      return;
    }
    res.status(403).send('invalid signature');
  }

  @Post('/callback')
  async receive(
    @Query('signature') signature: string,
    @Query('timestamp') timestamp: string,
    @Query('nonce') nonce: string,
    @Body() body: string,
    @Res() res: Response
  ) {
    if (!this.mini.verifyMessageSignature(signature, timestamp, nonce)) {
      res.status(403).send('invalid signature');
      return;
    }
    await this.mini.handleMessagePush(body);
    res.type('text/plain').send('success');
  }
}
