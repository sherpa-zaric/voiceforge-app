import crypto from 'crypto';
import { NextRequest } from 'next/server';

import { respData, respErr } from '@/shared/lib/resp';

function hashToken(password: string): string {
  const secret = process.env.SITE_AUTH_TOKEN_SECRET || password;
  return crypto
    .createHash('sha256')
    .update(`${password}:${secret}`)
    .digest('hex');
}

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  const sitePassword = process.env.SITE_PASSWORD || '';
  if (!sitePassword) {
    return respData({ success: true });
  }

  if (password !== sitePassword) {
    return respErr('Invalid password');
  }

  const token = hashToken(sitePassword);
  const response = Response.json({ success: true });
  // Set cookie that expires in 30 days
  const cookieValue = `site_auth=${token}; Path=/; Max-Age=${30 * 24 * 60 * 60}; HttpOnly; SameSite=Lax; Secure`;
  response.headers.append('Set-Cookie', cookieValue);
  return response;
}
