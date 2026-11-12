import { Body, Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AdminLoginDto } from './dto';
import { AdminService } from './admin.service';

@ApiTags('后台登录')
@Controller('/api/admin/auth')
export class AdminAuthController {
  constructor(private readonly admin: AdminService) {}

  @Get('/login-preference')
  loginPreference() { return this.admin.adminLoginPreference(); }

  @Post('/login')
  login(@Body() dto: AdminLoginDto, @Req() request: Request) {
    return this.admin.login(dto, request.ip, request.headers['user-agent']);
  }

  @Post('/wechat/session')
  createWechatSession() {
    return this.admin.createWechatLoginSession();
  }

  @Get('/wechat/session/:sessionId')
  pollWechatSession(
    @Param('sessionId') sessionId: string,
    @Req() request: Request
  ) {
    return this.admin.pollWechatLoginSession(sessionId, request.ip, request.headers['user-agent']);
  }

  @Get('/wechat/oauth')
  async wechatOauth(@Query('sessionId') sessionId: string, @Res() response: Response) {
    response.redirect(await this.admin.wechatLoginOauthUrl(sessionId));
  }

  @Get('/wechat/callback')
  async wechatCallback(@Query('code') code: string, @Query('state') sessionId: string, @Res() response: Response) {
    const result = await this.admin.completeWechatLogin(code, sessionId);
    response.type('html').send(this.resultPage(result.success ? '登录确认成功' : '登录失败', result.message));
  }

  @Get('/wechat/bind')
  async wechatBind(@Query('token') token: string, @Res() response: Response) {
    response.redirect(await this.admin.wechatInviteOauthUrl(token));
  }

  @Get('/wechat/bind/callback')
  async wechatBindCallback(@Query('code') code: string, @Query('state') token: string, @Res() response: Response) {
    const result = await this.admin.completeWechatInvite(code, token);
    response.type('html').send(this.resultPage('后台账号绑定成功', `${result.nickname} 已完成微信绑定，现在可以使用微信扫码登录后台。`));
  }

  private resultPage(title: string, message: string) {
    const escape = (value: string) => String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(
      title
    )}</title></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:32px;line-height:1.8;color:#172321"><h2>${escape(
      title
    )}</h2><p>${escape(message)}</p><p style="color:#7d8c89">可以关闭此页面。</p></body></html>`;
  }
}
