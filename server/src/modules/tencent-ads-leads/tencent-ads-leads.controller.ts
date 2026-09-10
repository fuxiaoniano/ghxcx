import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TencentAdsLeadsService } from './tencent-ads-leads.service';

@ApiTags('腾讯广告线索接收')
@Controller('/api/tencent-ads/leads')
export class TencentAdsLeadsController {
  constructor(private readonly leads: TencentAdsLeadsService) {}

  @Post('/push')
  receive(
    @Body() payload: Record<string, unknown>,
    @Headers('x-signature') signature?: string,
    @Headers('x-signature-algorithm') signatureAlgorithm?: string
  ) {
    return this.leads.receive(payload, signature, signatureAlgorithm);
  }
}
