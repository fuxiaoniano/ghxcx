import { Controller, Get, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
import { ConfigsService } from './modules/configs/configs.service';

@Controller()
export class PublicPageController {
  constructor(private readonly configs: ConfigsService) {}

  @Get('/')
  async landing(@Query('source') source: string, @Res() response: Response) {
    const config = await this.configs.getLandingPage();
    response.type('html').send(this.render(config, source));
  }

  @Get('/uploads/landing-assets/:filename')
  landingAsset(@Param('filename') filename: string, @Res() response: Response) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(filename)) {
      throw new NotFoundException('文件不存在');
    }
    // 上传图片会被后台域名和小程序共同读取，允许跨域图片展示，避免浏览器或微信容器拦截预览。
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    const uploadDir = process.env.LANDING_ASSET_DIR || join(process.cwd(), 'uploads', 'landing-assets');
    response.sendFile(join(uploadDir, filename), (error) => {
      if (error && !response.headersSent) {
        response.status(404).send('Not found');
      }
    });
  }

  private render(config: Awaited<ReturnType<ConfigsService['getLandingPage']>>, source?: string) {
    const text = config.text;
    const display = config.display;
    const sourceQuery = this.sourceQuery(source);
    const included = config.includedItems.map((item) => `<span>${this.escape(item)}</span>`).join('');
    const ageOptions = config.formOptions.ageRanges.map((item) => `<option>${this.escape(item)}</option>`).join('');
    const missingOptions = config.formOptions.missingTeethTypes.map((item) => `<option>${this.escape(item)}</option>`).join('');
    const clinicOptions = config.clinics.map((item) => `<option>${this.escape(item.name)}</option>`).join('');
    const formTopImages = config.formTopImages
      .map((url) => `<img class="form-top-image" src="${this.escape(url)}" alt="" loading="lazy" />`)
      .join('');
    const titleBrand = [config.brandName, config.activityTitle].filter(Boolean).join(' - ');

    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${this.escape(titleBrand || '挂号咨询')}</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#f5f6f8;color:#2b2f33;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{max-width:520px;margin:0 auto;background:#fff;min-height:100vh}.brand{display:flex;align-items:center;gap:12px;padding:18px 18px 12px}.logo{width:42px;height:42px;border-radius:8px;background:#b18a6c;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;flex:0 0 auto}.brand-name{font-size:22px;font-weight:800}.subtitle{font-size:13px;color:#7a828a}.badge{margin-left:auto;color:#d71918;font-weight:700}.banner{padding:0 18px 18px}.subsidy{text-align:center;color:#c67818;font-weight:700;margin:8px 0 12px}.price-card{border:1px solid #f1d4d1;border-radius:8px;padding:18px;background:#fff8f7}.price-top{display:flex;justify-content:space-between;color:#737b83}.price{font-size:74px;line-height:1;color:#e60012;font-weight:900}.included{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.included span{background:#fff;border:1px solid #f0c7c4;border-radius:4px;padding:5px 8px;color:#b36b20}.form-images{padding:18px 18px 0;border-top:8px solid #f5f6f8}.form-top-image{display:block;width:100%;height:auto;border-radius:6px;margin:0 0 12px}.form{padding:18px;border-top:8px solid #f5f6f8}.form-images+.form{border-top:0}.title{text-align:center;font-size:20px;font-weight:800;margin-bottom:18px}.field{margin-bottom:14px}.field label{display:block;font-weight:700;margin-bottom:7px}.field input,.field select,.field textarea,.phone-launch{width:100%;border:1px solid #dfe4ea;border-radius:6px;padding:11px;font-size:16px;background:#fff}.phone-launch{display:block;color:#d71918;text-decoration:none}.submit{display:block;width:100%;border:0;border-radius:4px;background:#ef2918;color:#fff;font-size:20px;font-weight:800;padding:14px;margin:18px 0;text-align:center;text-decoration:none}.notice{text-align:center;color:#4d555c}.footer{text-align:center;color:#8b9298;font-size:13px;padding:18px;line-height:1.8}.footer-link{display:inline-block;margin-top:8px;color:#8a5f3d;text-decoration:none}.privacy{font-size:13px;color:#656d75;line-height:1.7}.phone-hint{color:#8b9298}@media(max-width:380px){.price{font-size:60px}.brand-name{font-size:19px}.badge{font-size:13px}}
  </style>
</head>
<body>
  <main class="page">
    ${
      display.brandSection
        ? `<section class="brand">
      ${display.logo ? `<div class="logo">${this.escape(text.logoText)}</div>` : ''}
      <div>${display.brandName ? `<div class="brand-name">${this.escape(config.brandName)}</div>` : ''}${display.brandSubtitle ? `<div class="subtitle">${this.escape(text.brandSubtitle)}</div>` : ''}</div>
      ${display.brandBadge ? `<div class="badge">${this.escape(text.brandBadgeText)}</div>` : ''}
    </section>`
        : ''
    }
    ${
      display.bannerSection
        ? `<section class="banner">
      ${display.subsidyText ? `<div class="subsidy">${this.escape(config.subsidyText)}</div>` : ''}
      ${
        display.priceCard
          ? `<div class="price-card">
        <div class="price-top"><span>${this.escape(text.originalPriceLabel)} ${this.escape(config.originalPrice)}</span><span>${this.escape(text.activityPriceLabel)}</span></div>
        <div class="price">${this.escape(config.activityPrice)}</div>
        ${display.includedItems ? `<div class="included">${included}</div>` : ''}
      </div>`
          : display.includedItems
            ? `<div class="included">${included}</div>`
            : ''
      }
    </section>`
        : ''
    }
    ${display.formTopImages && formTopImages ? `<section class="form-images">${formTopImages}</section>` : ''}
    <section class="form">
      ${display.formTitle ? `<div class="title">${this.escape(config.activityTitle)}</div>` : ''}
      <div class="field"><label>${this.escape(text.nameLabel)}</label><input placeholder="${this.escape(text.namePlaceholder)}" /></div>
      <div class="field"><label>${this.escape(text.phoneLabel)}</label><a class="phone-launch" href="/wechat/oa/oauth?state=landing${sourceQuery}">${this.escape(text.phoneAuthorizeButtonText)}</a></div>
      <div class="field"><label>${this.escape(text.ageLabel)}</label><select>${ageOptions}</select></div>
      <div class="field"><label>${this.escape(text.missingTeethLabel)}</label><select>${missingOptions}</select></div>
      <div class="field"><label>${this.escape(text.clinicLabel)}</label><select><option>${this.escape(text.clinicPlaceholder)}</option>${clinicOptions}</select></div>
      <div class="field"><label>${this.escape(text.remarkLabel)}</label><textarea rows="3" placeholder="${this.escape(text.remarkPlaceholder)}"></textarea></div>
      ${display.privacyAgreement ? `<div class="privacy">${this.escape(text.privacyCheckboxText)}<br />${this.escape(config.privacyAgreement)}</div>` : ''}
      <a class="submit" href="/wechat/oa/oauth?state=landing${sourceQuery}">${this.escape(text.submitButtonText)}</a>
      ${display.noticeText ? `<div class="notice">${this.escape(text.noticeText)}</div>` : ''}
    </section>
    ${
      display.footerSection
        ? `<footer class="footer">
      ${display.institutionName ? `<div>${this.escape(config.institutionName)}</div>` : ''}
      ${display.filingNo ? `<div>${this.escape(config.filingNo)}</div>` : ''}
      ${display.footerText ? `<div>${this.escape(config.footerText)}</div>` : ''}
      ${
        display.customerServicePhone && config.customerServicePhone
          ? `<div>${this.escape(text.customerServiceLabel)}：<a class="footer-link" href="tel:${this.escape(this.phoneNumber(config.customerServicePhone))}">${this.escape(config.customerServicePhone)}</a></div>`
          : ''
      }
      ${display.myAppointmentsButton ? `<a class="footer-link" href="/wechat/oa/oauth?state=my${sourceQuery}">${this.escape(text.myAppointmentsButtonText)}</a>` : ''}
    </footer>`
        : ''
    }
  </main>
</body>
</html>`;
  }

  private escape(value: unknown) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private sourceQuery(source?: string) {
    const safeSource = String(source || '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 60);
    return safeSource ? `&source=${encodeURIComponent(safeSource)}` : '';
  }

  private phoneNumber(value: unknown) {
    return String(value || '').replace(/[^\d+]/g, '');
  }
}
