import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { basename, join } from 'path';

/** 独立提供企业内容图片，旧 landing-assets 路径保持不变。 */
@Controller('/uploads/enterprise-assets')
export class EnterpriseAssetsController {
  @Get('/:filename')
  asset(@Param('filename') filename: string, @Res() response: Response) {
    const safeName = basename(filename);
    const directory = process.env.ENTERPRISE_ASSET_DIR || join(process.cwd(), 'uploads', 'enterprise-assets');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.sendFile(join(directory, safeName), (error) => {
      if (error && !response.headersSent) response.status(404).send('Not found');
    });
  }
}
