import { requireUser } from '../../lib/server/auth.mjs';
import { json, method } from '../../lib/server/http.mjs';

export default async function handler(req, res) {
  if (!method(req, res, 'GET')) return;
  try {
    const result = await requireUser(req, res);
    if (result.error) return json(res, result.error.status, { status: 'error', code: result.error.code, error: result.error.message });
    return json(res, 200, { user: { email: result.user.email } });
  } catch {
    return json(res, 502, { status: 'error', code: 'AUTH_UNREACHABLE', error: '로그인 상태를 확인하지 못했습니다.' });
  }
}
