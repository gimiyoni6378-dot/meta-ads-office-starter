import { requireUser } from '../../lib/server/auth.mjs';
import { json, sameOrigin } from '../../lib/server/http.mjs';
import {
  beginMetaOAuth, completeMetaOAuth, disconnectMeta, getMetaAccounts,
  getMetaReport, metaStatus,
} from '../../lib/server/meta.mjs';

export const config = { maxDuration: 60 };

function redirect(res, status) {
  res.status(303).setHeader('location', `/?meta=${status}#meta-report`);
  res.setHeader('cache-control', 'no-store');
  return res.end();
}

export default async function handler(req, res) {
  const action = String(req.query?.action || '');

  if (action === 'callback' && req.method === 'GET') {
    const auth = await requireUser(req, res);
    if (auth.error) return redirect(res, 'error');
    const state = String(req.query?.state || '');
    const code = String(req.query?.code || '');
    if (!state || !code || req.query?.error) return redirect(res, 'error');
    try {
      await completeMetaOAuth({ userId: auth.user.id, state, code });
      return redirect(res, 'connected');
    } catch (error) {
      console.error(JSON.stringify({ event: 'meta_oauth_callback_failed', message: String(error.message || '').slice(0, 180) }));
      return redirect(res, 'error');
    }
  }

  const auth = await requireUser(req, res);
  if (auth.error) return json(res, auth.error.status, { status: 'error', code: auth.error.code, error: auth.error.message });

  if (action === 'status' && req.method === 'GET') {
    try { return json(res, 200, await metaStatus(auth.user.id)); }
    catch { return json(res, 503, { status: 'error', error: 'Meta 연결 상태를 확인하지 못했습니다.' }); }
  }

  if (action === 'connect' && req.method === 'POST') {
    if (!sameOrigin(req)) return json(res, 403, { status: 'error', error: '같은 사이트에서 연결을 시작해 주세요.' });
    try { return json(res, 200, { status: 'ready', authorizeUrl: await beginMetaOAuth(auth.user.id) }); }
    catch (error) { return json(res, 503, { status: 'error', error: error.message || 'Meta 연결 설정을 확인해 주세요.' }); }
  }

  if (action === 'accounts' && req.method === 'GET') {
    try { return json(res, 200, { status: 'ready', accounts: await getMetaAccounts(auth.user.id) }); }
    catch (error) { return json(res, error.message?.includes('연결') ? 401 : 502, { status: 'error', error: error.message || 'Meta 광고 계정 목록을 읽지 못했습니다.' }); }
  }

  if (action === 'report' && req.method === 'GET') {
    const accountId = String(req.query?.ad_account_id || '');
    const datePreset = String(req.query?.date_preset || 'last_7d');
    if (!accountId) return json(res, 400, { status: 'error', error: '광고 계정을 선택해 주세요.' });
    try { return json(res, 200, { status: 'ready', ...(await getMetaReport(auth.user.id, accountId, datePreset)) }); }
    catch (error) { return json(res, error.message?.includes('연결') ? 401 : 502, { status: 'error', error: error.message || 'Meta 보고서를 가져오지 못했습니다.' }); }
  }

  if (action === 'disconnect' && req.method === 'POST') {
    if (!sameOrigin(req)) return json(res, 403, { status: 'error', error: '같은 사이트에서 연결을 해제해 주세요.' });
    try {
      await disconnectMeta(auth.user.id);
      return json(res, 200, { status: 'disconnected' });
    } catch { return json(res, 503, { status: 'error', error: '앱의 Meta 연결 정보를 삭제하지 못했습니다.' }); }
  }

  res.setHeader('allow', 'GET, POST');
  return json(res, 405, { status: 'error', error: '요청을 처리하지 못했습니다.' });
}
