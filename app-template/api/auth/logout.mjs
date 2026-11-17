import { clearAuthCookies, revokeSession } from '../../lib/server/auth.mjs';
import { json, method, sameOrigin } from '../../lib/server/http.mjs';

export default async function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  if (!sameOrigin(req)) return json(res, 403, { status: 'error', code: 'ORIGIN_NOT_ALLOWED', error: '같은 사이트에서 로그아웃해 주세요.' });
  await revokeSession(req);
  clearAuthCookies(res, req);
  return json(res, 200, { status: 'signed_out' });
}
