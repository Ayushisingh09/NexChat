import dns from 'dns/promises';
import net from 'net';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24h
const FETCH_TIMEOUT_MS = 5000;
const MAX_BYTES = 512 * 1024; // 512 KB cap on HTML we read

/** Reject private, loopback, link-local, and other non-public IP ranges (SSRF guard). */
function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true; // loopback / unspecified
    if (lower.startsWith('fe80')) return true; // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
    // IPv4-mapped IPv6 (::ffff:a.b.c.d)
    const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/);
    if (mapped) return isBlockedIp(mapped[1]);
    return false;
  }
  return true; // unknown format → block
}

/** Resolve a hostname and ensure every resolved address is public. */
async function assertPublicHost(hostname: string): Promise<void> {
  // Literal IP in the host
  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new Error('Blocked IP address');
    return;
  }
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.local') || lower.endsWith('.internal')) {
    throw new Error('Blocked hostname');
  }
  const records = await dns.lookup(hostname, { all: true });
  if (records.length === 0) throw new Error('No DNS records');
  for (const r of records) {
    if (isBlockedIp(r.address)) throw new Error('Resolves to a private address');
  }
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function metaContent(html: string, patterns: string[]): string | null {
  for (const prop of patterns) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`,
      'i'
    );
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1].trim());
    // content may appear before property
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`,
      'i'
    );
    const m2 = html.match(re2);
    if (m2?.[1]) return decodeEntities(m2[1].trim());
  }
  return null;
}

function parsePreview(url: string, html: string): LinkPreview {
  const title =
    metaContent(html, ['og:title', 'twitter:title']) ||
    (() => {
      const t = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      return t?.[1] ? decodeEntities(t[1].trim()) : null;
    })();
  const description = metaContent(html, ['og:description', 'twitter:description', 'description']);
  let image = metaContent(html, ['og:image', 'twitter:image', 'twitter:image:src']);
  const siteName = metaContent(html, ['og:site_name']);

  // Resolve protocol-relative or root-relative image URLs
  if (image) {
    try {
      image = new URL(image, url).toString();
    } catch {
      image = null;
    }
  }

  return { url, title, description, image, siteName };
}

/**
 * Fetch and parse a link preview with SSRF protection and a Redis cache.
 * Returns null when the URL is unsafe or unreachable.
 */
export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview | null> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  // https only
  if (parsed.protocol !== 'https:') return null;

  const cacheKey = `linkpreview:${parsed.toString()}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as LinkPreview;
  } catch {
    /* cache read failure is non-fatal */
  }

  try {
    await assertPublicHost(parsed.hostname);

    const res = await fetch(parsed.toString(), {
      method: 'GET',
      redirect: 'manual', // we validate redirects ourselves
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'User-Agent': 'NexChatBot/1.0 (+link-preview)',
        Accept: 'text/html',
      },
    });

    // Follow at most one redirect, re-validating the destination host
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return null;
      const next = new URL(location, parsed.toString());
      if (next.protocol !== 'https:') return null;
      await assertPublicHost(next.hostname);
      const res2 = await fetch(next.toString(), {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { 'User-Agent': 'NexChatBot/1.0 (+link-preview)', Accept: 'text/html' },
      });
      return await finalize(next.toString(), res2, cacheKey);
    }

    return await finalize(parsed.toString(), res, cacheKey);
  } catch (err) {
    logger.warn(`Link preview failed for ${parsed.hostname}: ${(err as Error).message}`);
    return null;
  }
}

async function finalize(url: string, res: Response, cacheKey: string): Promise<LinkPreview | null> {
  if (!res.ok) return null;
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return null;

  // Read up to MAX_BYTES then stop
  const reader = res.body?.getReader();
  if (!reader) return null;
  let received = 0;
  const chunks: Uint8Array[] = [];
  while (received < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
    }
  }
  reader.cancel().catch(() => {});

  const html = Buffer.concat(chunks).toString('utf-8');
  const preview = parsePreview(url, html);

  // Only cache previews that yielded something useful
  if (preview.title || preview.description || preview.image) {
    try {
      await redis.set(cacheKey, JSON.stringify(preview), 'EX', CACHE_TTL_SECONDS);
    } catch {
      /* non-fatal */
    }
    return preview;
  }
  return null;
}
