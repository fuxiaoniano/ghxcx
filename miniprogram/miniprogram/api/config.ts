import { request } from './request';
import { LandingPageConfig } from './types';

export function getLandingPageConfig() {
  return request<LandingPageConfig>({ url: '/api/config/landing-page' });
}
