import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { WebsiteArticleQueryDto } from './dto';
import { WebsiteService } from './website.service';

@ApiTags('AfterBeat 公开内容')
@Controller('/api/afterbeat')
export class AfterbeatController {
  constructor(private readonly website: WebsiteService) {}
  @Get('/bootstrap') bootstrap(@Req() req: Request) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    return this.website.bootstrap({ ip: forwarded || req.ip || '', userAgent: String(req.headers['user-agent'] || ''), path: '/' }, 'afterbeat');
  }
  @Get('/categories') categories() { return this.website.categories(false, 'afterbeat'); }
  @Get('/sitemap.xml') async sitemap(@Res() res: Response) { res.type('application/xml').send(await this.website.sitemap('https://afterbeat.fuxiaonian.net', 'afterbeat')); }
  @Get('/articles') articles(@Query() query: WebsiteArticleQueryDto) { return this.website.articles(query, false, 'afterbeat'); }
  @Get('/articles/:slug') article(@Param('slug') slug: string) { return this.website.article(slug, 'afterbeat'); }
}
