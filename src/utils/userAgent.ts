// Minimal, dependency-free User-Agent parser — enough to label a session
// like "Chrome on Windows". Not exhaustive; falls back to "Unknown".

export interface ParsedUserAgent {
  browser: string;
  os: string;
}

export function parseUserAgent(ua?: string | null): ParsedUserAgent {
  if (!ua) return { browser: 'Unknown', os: 'Unknown' };

  let os = 'Unknown';
  if (/windows nt/i.test(ua)) os = 'Windows';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/mac os x/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'Unknown';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/opr\/|opera/i.test(ua)) browser = 'Opera';
  else if (/firefox\//i.test(ua)) browser = 'Firefox';
  else if (/chrome\//i.test(ua)) browser = 'Chrome';
  else if (/safari\//i.test(ua)) browser = 'Safari';

  return { browser, os };
}
