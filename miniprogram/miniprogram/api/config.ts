import { request } from './request';
import { LandingPageConfig } from './types';

export function getLandingPageConfig(pageKey?: string) {
  const path = pageKey ? `/api/config/landing-page/${encodeURIComponent(pageKey)}` : '/api/config/landing-page';
  return request<LandingPageConfig>({ url: path });
}
