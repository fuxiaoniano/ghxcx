import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { WechatOfficialAccountService } from './wechat-official-account.service';

@ApiTags('微信公众号')
@Controller('/wechat/oa')
export class WechatOfficialAccountController {
  constructor(private readonly official: WechatOfficialAccountService) {}

  @Get('/callback')
  verify(
    @Query('signature') signature: string,
    @Query('timestamp') timestamp: string,
    @Query('nonce') nonce: string,
    @Query('echostr') echostr: string,
    @Res() res: Response
  ) {
    if (this.official.verifySignature(signature, timestamp, nonce)) {
      res.send(echostr);
      return;
    }
    res.status(403).send('invalid signature');
  }

  @Post('/callback')
  async receive(
    @Query('signature') signature: string,
    @Query('msg_signature') msgSignature: string,
    @Query('timestamp') timestamp: string,
    @Query('nonce') nonce: string,
    @Body() body: string,
    @Res() res: Response
  ) {
    let messageBody = body;
    if (msgSignature) {
      const encrypted = this.official.extractEncrypt(body);
      if (!encrypted || !this.official.verifyMessageSignature(msgSignature, timestamp, nonce, encrypted)) {
        res.status(403).send('invalid msg_signature');
        return;
      }
      messageBody = this.official.decryptMessage(encrypted);
    } else if (!this.official.verifySignature(signature, timestamp, nonce)) {
      res.status(403).send('invalid signature');
      return;
    }
    const replyXml = await this.official.handleMessage(messageBody);
    if (replyXml) {
      const responseXml = msgSignature ? this.official.encryptReplyMessage(replyXml, timestamp, nonce) : replyXml;
      res.status(200).type('application/xml').send(responseXml);
      return;
    }
    res.status(200).type('text/plain').send('success');
  }

  @Get('/oauth')
  oauth(
    @Query('state') state: string,
    @Query('source') source: string,
    @Query('page') page: string,
    @Res() res: Response
  ) {
    res.redirect(this.official.buildOauthUrl(state, source, page));
  }

  @Get('/oauth/callback')
  async oauthCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    const redirectUrl = await this.official.handleOauthCallback(code, state);
    res.redirect(redirectUrl);
  }

}
