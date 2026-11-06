export function isCorsOriginAllowed(origin: string | undefined, origins: string, environment: string | undefined): boolean {
  if (!origin) return true;
  const allowList = origins.split(',').map((item) => item.trim()).filter(Boolean);
  return allowList.includes(origin) || (environment !== 'production' && allowList.length === 0);
}
