import { NextRequest } from 'next/server';

import { respData, respErr } from '@/shared/lib/resp';

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  const sitePassword = process.env.SITE_PASSWORD || '';
  if (!sitePassword) {
    return respData({ success: true });
  }

  if (password !== sitePassword) {
    return respErr('Invalid password');
  }

  const response = Response.json({ success: true });
  // Set cookie that expires in 30 days
  const cookieValue = `site_auth=${sitePassword}; Path=/; Max-Age=${30 * 24 * 60 * 60}; HttpOnly; SameSite=Lax`;
  response.headers.append('Set-Cookie', cookieValue);
  return response;
}
