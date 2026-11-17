import { envValue } from './http.mjs';

const COOKIE_ACCESS = 'agent_office_access';
const COOKIE_REFRESH = 'agent_office_refresh';

function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(part => {
    const index = part.indexOf('=');
    if (index < 0) return ['', ''];
    const key = part.slice(0, index).trim();
    try { return [key, decodeURIComponent(part.slice(index + 1).trim())]; }
    catch { return [key, '']; }
  }).filter(([key]) => key));
}

function cookie(name, value, maxAge, req) {
  const secure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

export function clearAuthCookies(res, req) {
  res.setHeader('set-cookie', [cookie(COOKIE_ACCESS, '', 0, req), cookie(COOKIE_REFRESH, '', 0, req)]);
}

export function setAuthCookies(res, req, session) {
  const accessAge = Math.max(60, Math.min(Number(session.expires_in) || 3600, 3600));
  res.setHeader('set-cookie', [
    cookie(COOKIE_ACCESS, session.access_token, accessAge, req),
    cookie(COOKIE_REFRESH, session.refresh_token, 60 * 60 * 24 * 30, req),
  ]);
}

export function allowedEmail(email) {
  const allowed = envValue('DASHBOARD_ALLOWED_EMAILS').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  return Boolean(email && allowed.length && allowed.includes(email.toLowerCase()));
}

export async function refreshSession(req, res) {
  const refreshToken = cookies(req)[COOKIE_REFRESH];
  const url = envValue('SUPABASE_URL');
  const anon = envValue('SUPABASE_ANON_KEY');
  if (!refreshToken || !url || !anon) return null;
  let response;
  try {
    response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: anon, 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: AbortSignal.timeout(8000),
    });
  } catch { return null; }
  if (!response.ok) return null;
  const session = await response.json();
  if (!session.access_token || !session.refresh_token || !allowedEmail(session.user?.email)) return null;
  setAuthCookies(res, req, session);
  return session.user;
}

export async function requireUser(req, res) {
  const envMissing = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'DASHBOARD_ALLOWED_EMAILS'].filter(key => !envValue(key));
  if (envMissing.length) return { error: { status: 503, code: 'AUTH_NOT_CONFIGURED', message: '로그인 설정이 아직 완료되지 않았습니다.' } };
  const accessToken = cookies(req)[COOKIE_ACCESS];
  const url = envValue('SUPABASE_URL');
  const anon = envValue('SUPABASE_ANON_KEY');
  if (accessToken) {
    let response;
    try {
      response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
        headers: { apikey: anon, authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      return { error: { status: 502, code: 'AUTH_UNREACHABLE', message: '로그인 서비스에 연결하지 못했습니다.' } };
    }
    if (response.ok) {
      const user = await response.json();
      if (allowedEmail(user.email)) return { user };
      clearAuthCookies(res, req);
      return { error: { status: 403, code: 'USER_NOT_ALLOWED', message: '이 계정은 대시보드 접근이 허용되지 않았습니다.' } };
    }
  }
  const refreshedUser = await refreshSession(req, res);
  if (refreshedUser) return { user: refreshedUser };
  clearAuthCookies(res, req);
  return { error: { status: 401, code: 'SIGN_IN_REQUIRED', message: '로그인해 주세요.' } };
}

export async function revokeSession(req) {
  const accessToken = cookies(req)[COOKIE_ACCESS];
  const url = envValue('SUPABASE_URL');
  const anon = envValue('SUPABASE_ANON_KEY');
  if (!accessToken || !url || !anon) return;
  try {
    await fetch(`${url.replace(/\/$/, '')}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: anon, authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(3000),
    });
  } catch { /* Local cookies are cleared even if remote revocation is unavailable. */ }
}
