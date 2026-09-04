import { Controller, Get, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { randomBytes } from 'crypto';
import { join } from 'path';
import { ConfigsService } from './modules/configs/configs.service';

@Controller()
export class PublicPageController {
  constructor(private readonly configs: ConfigsService) {}

  @Get('/')
  async landing(@Query('source') source: string, @Res() response: Response) {
    const config = await this.configs.getLandingPage();
    this.sendLanding(response, config, source);
  }

  @Get('/landing/:pageKey')
  async landingByKey(
    @Param('pageKey') pageKey: string,
    @Query('source') source: string,
    @Res() response: Response
  ) {
    const config = await this.configs.getLandingPage(pageKey);
    this.sendLanding(response, config, source);
  }

  @Get('/uploads/landing-assets/:filename')
  landingAsset(@Param('filename') filename: string, @Res() response: Response) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(filename)) {
      throw new NotFoundException('文件不存在');
    }
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

  private sendLanding(
    response: Response,
    config: Awaited<ReturnType<ConfigsService['getLandingPage']>>,
    source?: string
  ) {
    const nonce = randomBytes(18).toString('base64');
    response.setHeader(
      'Content-Security-Policy',
      `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self'; font-src 'self' data:; base-uri 'self'; form-action 'self'; frame-ancestors 'self'`
    );
    response.type('html').send(this.render(config, source, nonce));
  }

  private render(
    config: Awaited<ReturnType<ConfigsService['getLandingPage']>>,
    source: string | undefined,
    nonce: string
  ) {
    const text = config.text;
    const display = config.display;
    const safeSource = this.normalizeSource(source) || `h5_${config.pageKey}`;
    const ageOptions = config.formOptions.ageRanges
      .map((item) => `<option value="${this.escape(item)}">${this.escape(item)}</option>`)
      .join('');
    const missingOptions = config.formOptions.missingTeethTypes
      .map((item) => `<option value="${this.escape(item)}">${this.escape(item)}</option>`)
      .join('');
    const clinicOptions = config.clinics
      .map((item) => `<option value="${this.escape(item.id)}">${this.escape(item.name)}</option>`)
      .join('');
    const formTopImages = config.formTopImages
      .map((url) => `<img class="form-top-image" src="${this.escape(url)}" alt="" loading="lazy" />`)
      .join('');
    const title = config.shareTitle || config.pageName || config.activityTitle || config.brandName || '挂号咨询';
    const endpoint = `/api/public/landing-pages/${encodeURIComponent(config.pageKey || 'default')}/appointments`;
    const oauthPageQuery = `&page=${encodeURIComponent(config.pageKey || 'default')}`;
    const footerHtml = display.footerSection
      ? [
          '<footer class="footer">',
          display.institutionName ? `<div>${this.escape(config.institutionName)}</div>` : '',
          display.filingNo ? `<div>${this.escape(config.filingNo)}</div>` : '',
          display.footerText ? `<div>${this.escape(config.footerText)}</div>` : '',
          display.customerServicePhone && config.customerServicePhone
            ? `<div>${this.escape(text.customerServiceLabel)}：<a class="phone-link" href="tel:${this.escape(this.phoneNumber(config.customerServicePhone))}">${this.escape(config.customerServicePhone)}</a></div>`
            : '',
          display.myAppointmentsButton
            ? `<a class="footer-link" href="/wechat/oa/oauth?state=my&source=${encodeURIComponent(safeSource)}${oauthPageQuery}">${this.escape(text.myAppointmentsButtonText)}</a>`
            : '',
          '</footer>'
        ].join('')
      : '';

    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>${this.escape(title)}</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#f4f6f8;color:#20262d;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}.page{max-width:560px;margin:0 auto;background:#fff;min-height:100vh}.rich-section{overflow:hidden;background:#fff}.rich-section img{display:block;max-width:100%;height:auto;margin:0 auto}.form-images{background:#fff}.form-top-image{display:block;width:100%;height:auto}.form{padding:22px 18px 28px;border-top:8px solid #f4f6f8}.title{text-align:center;font-size:20px;font-weight:700;margin:0 0 20px}.field{margin-bottom:15px}.field label{display:block;font-size:15px;font-weight:600;margin-bottom:7px}.required:before{content:"*";color:#d92d20;margin-right:4px}.field input,.field select,.field textarea{display:block;width:100%;border:1px solid #d7dde4;border-radius:6px;padding:12px 13px;background:#fff;color:#20262d;font:inherit;outline:none}.field input:focus,.field select:focus,.field textarea:focus{border-color:#d92d20;box-shadow:0 0 0 2px rgba(217,45,32,.08)}.field textarea{min-height:92px;resize:vertical}.privacy{display:flex;align-items:flex-start;gap:8px;font-size:14px;line-height:1.65;color:#4b5563}.privacy input{width:18px;height:18px;margin-top:2px;flex:0 0 auto}.privacy-detail{margin:5px 0 0 26px;color:#7a838d;font-size:13px;line-height:1.65}.submit{display:flex;width:100%;min-height:50px;border:0;border-radius:25px;background:#d92d20;color:#fff;font-size:18px;font-weight:700;align-items:center;justify-content:center;margin:20px 0 14px;padding:10px 18px}.submit:disabled{opacity:.58}.notice{text-align:center;color:#5f6872;font-size:14px;line-height:1.65}.form-message{display:none;margin:12px 0 0;padding:12px;border-radius:6px;font-size:14px;line-height:1.6}.form-message.error{display:block;color:#b42318;background:#fef3f2}.form-message.success{display:block;color:#067647;background:#ecfdf3}.footer{text-align:center;color:#7a838d;font-size:13px;padding:22px 18px calc(22px + env(safe-area-inset-bottom));line-height:1.9;border-top:8px solid #f4f6f8}.footer-link{display:inline-block;margin-top:5px;color:#0b63ce;text-decoration:none}.phone-link{color:#0b63ce;text-decoration:none}.hidden{display:none!important}@media(max-width:360px){.form{padding-left:14px;padding-right:14px}.submit{font-size:17px}}
  </style>
</head>
<body>
  <main class="page">
    ${display.brandSection ? `<section class="rich-section">${config.brandHtml}</section>` : ''}
    ${display.bannerSection ? `<section class="rich-section">${config.activityHtml}</section>` : ''}
    ${display.formTopImages && formTopImages ? `<section class="form-images">${formTopImages}</section>` : ''}
    <section class="form">
      ${display.formTitle ? `<h1 class="title">${this.escape(config.activityTitle)}</h1>` : ''}
      <form id="appointment-form" novalidate>
        <div class="field"><label class="required" for="name">${this.escape(text.nameLabel)}</label><input id="name" name="name" maxlength="64" autocomplete="name" placeholder="${this.escape(text.namePlaceholder)}" required /></div>
        <div class="field"><label class="required" for="phone">${this.escape(text.phoneLabel)}</label><input id="phone" name="phone" type="tel" inputmode="numeric" maxlength="11" autocomplete="tel" placeholder="请输入 11 位手机号" required /></div>
        <div class="field"><label class="required" for="ageRange">${this.escape(text.ageLabel)}</label><select id="ageRange" name="ageRange" required>${ageOptions}</select></div>
        <div class="field"><label class="required" for="missingTeethType">${this.escape(text.missingTeethLabel)}</label><select id="missingTeethType" name="missingTeethType" required>${missingOptions}</select></div>
        <div class="field"><label for="clinicId">${this.escape(text.clinicLabel)}</label><select id="clinicId" name="clinicId"><option value="">${this.escape(text.clinicPlaceholder)}</option>${clinicOptions}</select></div>
        <div class="field"><label for="remark">${this.escape(text.remarkLabel)}</label><textarea id="remark" name="remark" maxlength="500" placeholder="${this.escape(text.remarkPlaceholder)}"></textarea></div>
        <label class="privacy"><input id="privacyAccepted" name="privacyAccepted" type="checkbox" /><span>${this.escape(text.privacyCheckboxText)}</span></label>
        ${display.privacyAgreement ? `<div class="privacy-detail">${this.escape(config.privacyAgreement)}</div>` : ''}
        <button id="submit-button" class="submit" type="submit">${this.escape(text.submitButtonText)}</button>
        <div id="form-message" class="form-message" role="alert"></div>
      </form>
      ${display.noticeText ? `<div class="notice">${this.escape(text.noticeText)}</div>` : ''}
    </section>
    ${footerHtml}
  </main>
  <script nonce="${this.escape(nonce)}">
    (() => {
      const form = document.getElementById('appointment-form');
      const phoneInput = document.getElementById('phone');
      const button = document.getElementById('submit-button');
      const message = document.getElementById('form-message');
      const endpoint = ${this.safeJson(endpoint)};
      const source = ${this.safeJson(safeSource)};
      let submitting = false;

      phoneInput.addEventListener('input', () => {
        phoneInput.value = phoneInput.value.replace(/\\D/g, '').slice(0, 11);
      });

      const showMessage = (text, type) => {
        message.textContent = text;
        message.className = 'form-message ' + type;
      };

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (submitting) return;
        const values = Object.fromEntries(new FormData(form).entries());
        const name = String(values.name || '').trim();
        const phone = String(values.phone || '').replace(/\\D/g, '');
        if (!name) return showMessage('请填写姓名', 'error');
        if (!/^1\\d{10}$/.test(phone)) return showMessage('请输入正确的 11 位手机号', 'error');
        if (!document.getElementById('privacyAccepted').checked) return showMessage('请先阅读并同意隐私协议', 'error');

        submitting = true;
        button.disabled = true;
        button.textContent = '正在提交...';
        message.className = 'form-message';
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              phone,
              ageRange: String(values.ageRange || ''),
              missingTeethType: String(values.missingTeethType || ''),
              clinicId: String(values.clinicId || '') || undefined,
              remark: String(values.remark || '').trim() || undefined,
              source,
              privacyAccepted: true
            })
          });
          const body = await response.json().catch(() => null);
          if (!response.ok || !body || body.code !== 0) {
            throw new Error(body?.message || '提交失败，请稍后重试');
          }
          showMessage('挂号提交成功，挂号编号：' + body.data.appointmentNo + '。工作人员将在 24 小时内联系您。', 'success');
          form.querySelectorAll('input:not([type="checkbox"]), textarea').forEach((input) => { input.value = ''; });
          document.getElementById('privacyAccepted').checked = false;
        } catch (error) {
          showMessage(error instanceof Error ? error.message : '提交失败，请稍后重试', 'error');
        } finally {
          submitting = false;
          button.disabled = false;
          button.textContent = ${this.safeJson(text.submitButtonText)};
        }
      });
    })();
  </script>
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

  private safeJson(value: unknown) {
    return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  }

  private normalizeSource(source?: string) {
    return String(source || '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 60);
  }

  private phoneNumber(value: unknown) {
    return String(value || '').replace(/[^\d+]/g, '');
  }
}
