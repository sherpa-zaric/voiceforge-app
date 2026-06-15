import dns from 'dns/promises';
import { NextRequest, NextResponse } from 'next/server';

import { getUserInfo } from '@/shared/models/user';

function isPrivateIP(ip: string): boolean {
  // IPv4 private/link-local ranges
  if (ip.includes('.')) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return false;
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 127.0.0.0/8 (loopback)
    if (parts[0] === 127) return true;
    // 169.254.0.0/16 (link-local)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 0.0.0.0
    if (parts[0] === 0) return true;
    return false;
  }
  // IPv6 loopback
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') return true;
  // IPv6 unique local (fc00::/7)
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
  // IPv6 link-local (fe80::/10)
  if (ip.startsWith('fe80')) return true;
  return false;
}

export async function GET(req: NextRequest) {
  const user = await getUserInfo();
  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse('Invalid url', { status: 400 });
  }

  if (parsed.protocol !== 'https:') {
    return new NextResponse('Only https allowed', { status: 400 });
  }

  // Block IP literals (v4/v6) and single-label hosts to defend against SSRF
  const hostname = parsed.hostname.toLowerCase();
  if (
    !/^[a-z0-9.-]+$/.test(hostname) ||
    !hostname.includes('.') ||
    !/[a-z]/.test(hostname)
  ) {
    return new NextResponse('Host not allowed', { status: 400 });
  }

  // DNS rebinding defense: resolve hostname and reject private IPs
  try {
    const { address } = await dns.lookup(hostname, { family: 4 });
    if (isPrivateIP(address)) {
      return new NextResponse('Host resolves to private IP', { status: 400 });
    }
  } catch {
    return new NextResponse('DNS resolution failed', { status: 400 });
  }

  try {
    const response = await fetch(parsed.toString());

    if (!response.ok) {
      return new NextResponse(`Failed to fetch file: ${response.statusText}`, {
        status: response.status,
      });
    }

    const contentType =
      response.headers.get('content-type') || 'application/octet-stream';

    return new NextResponse(response.body, {
      headers: {
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
