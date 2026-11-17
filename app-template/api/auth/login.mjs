import { allowedEmail, clearAuthCookies, setAuthCookies } from '../../lib/server/auth.mjs';
import { envValue, json, method, sameOrigin } from '../../lib/server/http.mjs';

export default async function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  if (!sameOrigin(req)) return json(res, 403, { status: 'error', code: 'ORIGIN_NOT_ALLOWED', error: '같은 사이트에서 로그인해 주세요.' });
  const url = envValue('SUPABASE_URL');
  const anon = envValue('SUPABASE_ANON_KEY');
  if (!url || !anon || !envValue('DASHBOARD_ALLOWED_EMAILS')) return json(res, 503, { status: 'error', code: 'AUTH_NOT_CONFIGURED', error: '로그인 설정이 아직 완료되지 않았습니다.' });
  const email = String(req.body?.email || '').trim().slice(0, 254);
  const password = String(req.body?.password || '');
  if (!email || !password || password.length > 1024) return json(res, 400, { status: 'error', code: 'INVALID_LOGIN', error: '이메일과 비밀번호를 입력해 주세요.' });
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anon, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(8000),
    });
    const session = await response.json();
    if (!response.ok || !session.access_token || !session.refresh_token) return json(res, 401, { status: 'error', code: 'INVALID_LOGIN', error: '이메일 또는 비밀번호를 확인해 주세요.' });
    if (!allowedEmail(session.user?.email)) {
      clearAuthCookies(res, req);
      return json(res, 403, { status: 'error', code: 'USER_NOT_ALLOWED', error: '이 계정은 대시보드 접근이 허용되지 않았습니다.' });
    }
    setAuthCookies(res, req, session);
    return json(res, 200, { user: { email: session.user.email } });
  } catch {
    return json(res, 502, { status: 'error', code: 'AUTH_UNREACHABLE', error: '로그인 서비스에 연결하지 못했습니다.' });
  }
}
