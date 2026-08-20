import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigsService } from './configs.service';

@ApiTags('小程序配置')
@Controller('/api/config')
export class ConfigsController {
  constructor(private readonly configs: ConfigsService) {}

  @Get('/landing-page')
  getLandingPage() {
    return this.configs.getLandingPage();
  }
}
