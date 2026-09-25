import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WebsiteArticleQueryDto } from './dto';
import { WebsiteService } from './website.service';

@ApiTags('企业官网公开内容')
@Controller('/api/website')
export class WebsiteController {
  constructor(private readonly website: WebsiteService) {}
  @Get('/bootstrap') bootstrap() { return this.website.bootstrap(); }
  @Get('/pages/:slug') page(@Param('slug') slug: string) { return this.website.page(slug); }
  @Get('/articles') articles(@Query() query: WebsiteArticleQueryDto) { return this.website.articles(query); }
  @Get('/articles/:slug') article(@Param('slug') slug: string) { return this.website.article(slug); }
}
