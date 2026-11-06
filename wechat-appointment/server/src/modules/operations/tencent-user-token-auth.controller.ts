import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { OperationsService } from './operations.service';

@Controller('/api/admin/operations/tencent-user-token-auth')
export class TencentUserTokenAuthController {
  constructor(private readonly operations: OperationsService) {}

  @Get('/callback')
  async callback(
    @Query('state') state: string | undefined,
    @Query('user_status') userStatus: string | undefined,
    @Query('user_token') userToken: string | undefined,
    @Query('expire_time') expireTime: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    try {
      const result = await this.operations.completeTencentUserTokenAuthorization({ state, userStatus, userToken, expireTime }, request.ip, request.headers['user-agent']);
      response.setHeader('Cache-Control', 'no-store');
      return response.redirect(303, result.redirectUrl);
    } catch {
      response.setHeader('Cache-Control', 'no-store');
      return response.status(503).send('腾讯授权结果处理失败，请返回管理后台重新扫码');
    }
  }
}
