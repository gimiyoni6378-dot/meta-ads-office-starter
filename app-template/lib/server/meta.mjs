import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { envValue } from './http.mjs';
import { supabaseRequest } from './supabase.mjs';
import { metaToolError } from './meta-errors.mjs';

const MCP_URL = 'https://mcp.facebook.com/ads';
const ACCOUNT_TOOL = 'ads_get_ad_accounts';
const ENTITY_TOOL = 'ads_get_ad_entities';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function encryptionKey() {
  const value = envValue('META_TOKEN_ENCRYPTION_KEY');
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('Meta 암호화 키 설정이 필요합니다.');
  return Buffer.from(value, 'hex');
}

function encrypt(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}

function decrypt(value) {
  const [version, ivText, tagText, ciphertextText] = String(value || '').split('.');
  if (version !== 'v1' || !ivText || !tagText || !ciphertextText) throw new Error('Meta 연결 정보를 읽지 못했습니다. 다시 연결해 주세요.');
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextText, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('Meta 연결 정보를 읽지 못했습니다. 다시 연결해 주세요.');
  }
}

function hash(value) { return createHash('sha256').update(value).digest('hex'); }

function conversationId() {
  const bytes = randomBytes(20);
  return Array.from(bytes, byte => ALPHABET[byte % ALPHABET.length]).join('');
}

export function metaConfigured() {
  try {
    const redirect = new URL(envValue('META_REDIRECT_URI'));
    return Boolean(
      envValue('META_APP_ID') && envValue('META_APP_SECRET') &&
      /^[a-f0-9]{64}$/i.test(envValue('META_TOKEN_ENCRYPTION_KEY')) &&
      redirect.protocol === 'https:' && redirect.pathname === '/api/meta/callback'
    );
  } catch { return false; }
}

export async function metaStatus(userId) {
  if (!metaConfigured()) return { configured: false, connected: false, connectedAt: null };
  const query = new URLSearchParams({ select: 'connected_at', user_id: `eq.${userId}`, limit: '1' });
  const rows = await supabaseRequest('meta_connections', { query: query.toString() });
  const row = Array.isArray(rows) ? rows[0] : null;
  return { configured: true, connected: Boolean(row), connectedAt: row?.connected_at || null };
}

export async function beginMetaOAuth(userId) {
  if (!metaConfigured()) throw new Error('Meta 앱과 HTTPS 콜백, 암호화 키 설정을 먼저 완료해 주세요.');
  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const cleanup = new URLSearchParams({ expires_at: `lt.${new Date().toISOString()}` });
  await supabaseRequest('meta_oauth_states', { method: 'DELETE', query: cleanup.toString() });
  await supabaseRequest('meta_oauth_states', {
    method: 'POST',
    body: {
      state_hash: hash(state),
      user_id: userId,
      encrypted_code_verifier: encrypt(verifier),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    },
    prefer: 'return=minimal',
  });
  const authorize = new URL(`https://www.facebook.com/${envValue('META_GRAPH_VERSION') || 'v27.0'}/dialog/oauth`);
  authorize.searchParams.set('client_id', envValue('META_APP_ID'));
  authorize.searchParams.set('redirect_uri', envValue('META_REDIRECT_URI'));
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('scope', envValue('META_SCOPES') || 'ads_mcp_management,ads_read');
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('code_challenge', challenge);
  authorize.searchParams.set('code_challenge_method', 'S256');
  const configId = envValue('META_LOGIN_CONFIG_ID');
  if (configId) authorize.searchParams.set('config_id', configId);
  return authorize.toString();
}

async function consumeOAuthState(state, userId) {
  const query = new URLSearchParams({
    select: 'user_id,encrypted_code_verifier',
    state_hash: `eq.${hash(state)}`,
    user_id: `eq.${userId}`,
    expires_at: `gt.${new Date().toISOString()}`,
  });
  const rows = await supabaseRequest('meta_oauth_states', {
    method: 'DELETE', query: query.toString(), prefer: 'return=representation',
  });
  if (!Array.isArray(rows) || !rows[0]) throw new Error('Meta 로그인 요청이 만료됐어요. 다시 연결해 주세요.');
  return decrypt(rows[0].encrypted_code_verifier);
}

async function exchangeCode(code, verifier) {
  const graphVersion = envValue('META_GRAPH_VERSION') || 'v27.0';
  const url = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
  url.searchParams.set('client_id', envValue('META_APP_ID'));
  url.searchParams.set('client_secret', envValue('META_APP_SECRET'));
  url.searchParams.set('redirect_uri', envValue('META_REDIRECT_URI'));
  url.searchParams.set('code', code);
  url.searchParams.set('code_verifier', verifier);
  let response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'error' }); }
  catch { throw new Error('Meta 로그인 응답을 받지 못했습니다. 다시 시도해 주세요.'); }
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.access_token) throw new Error('Meta 로그인을 완료하지 못했어요. 앱의 리디렉션 주소와 권한을 확인해 주세요.');
  return result;
}

function parseRpc(raw, contentType) {
  if (contentType.includes('text/event-stream')) {
    const blocks = raw.split(/\r?\n\r?\n/);
    for (let index = blocks.length - 1; index >= 0; index--) {
      const data = blocks[index].split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
      if (data) { try { return JSON.parse(data); } catch {} }
    }
    throw new Error('Meta MCP 응답을 읽지 못했습니다.');
  }
  try { return JSON.parse(raw); } catch { throw new Error('Meta MCP 응답을 읽지 못했습니다.'); }
}

export async function createMetaClient(accessToken) {
  let sessionId = '';
  let requestId = 0;
  async function rpc(method, params = {}, notification = false) {
    const payload = { jsonrpc: '2.0', method, params };
    if (!notification) payload.id = ++requestId;
    const headers = { accept: 'application/json, text/event-stream', 'content-type': 'application/json', authorization: `Bearer ${accessToken}` };
    if (sessionId) headers['mcp-session-id'] = sessionId;
    let response;
    try {
      response = await fetch(MCP_URL, { method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000), redirect: 'error' });
    } catch { throw new Error('Meta Ads MCP에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
    sessionId = response.headers.get('mcp-session-id') || sessionId;
    const raw = await response.text();
    if (!response.ok) throw new Error(response.status === 401 ? 'Meta 로그인이 만료됐어요. 다시 연결해 주세요.' : 'Meta Ads MCP 요청이 실패했습니다.');
    if (notification || response.status === 202 || !raw.trim()) return null;
    const message = parseRpc(raw, response.headers.get('content-type') || '');
    if (message?.error) throw new Error('Meta Ads MCP 요청을 처리하지 못했습니다. 권한과 계정 상태를 확인해 주세요.');
    return message?.result ?? message;
  }
  await rpc('initialize', {
    protocolVersion: '2025-06-18', capabilities: {},
    clientInfo: { name: 'agent-office', version: '1.0.0' },
  });
  await rpc('notifications/initialized', {}, true);
  return {
    async listTools() {
      const all = []; let cursor;
      do { const result = await rpc('tools/list', cursor ? {cursor} : {}); all.push(...(result.tools || [])); cursor = result.nextCursor; } while (cursor && all.length < 1000);
      return all;
    },
    async callTool(name, args) {
      const result = await rpc('tools/call', { name, arguments: args });
      if (result?.isError) {
        throw metaToolError(result);
      }
      if (result?.structuredContent && typeof result.structuredContent === 'object') return result.structuredContent;
      const text = (result?.content || []).find(item => item.type === 'text')?.text;
      if (text) { try { return JSON.parse(text); } catch { return { message: text }; } }
      return result || {};
    },
  };
}

export async function userMetaClient(userId) {
  const { token } = await getConnection(userId);
  return createMetaClient(token);
}

async function storeConnection(userId, token) {
  const expiresAt = token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : null;
  await supabaseRequest('meta_connections', {
    method: 'POST', query: 'on_conflict=user_id',
    body: { user_id: userId, encrypted_access_token: encrypt(token.access_token), expires_at: expiresAt, connected_at: new Date().toISOString() },
    prefer: 'resolution=merge-duplicates,return=minimal',
  });
}

async function getConnection(userId) {
  const query = new URLSearchParams({ select: 'encrypted_access_token,expires_at,connected_at', user_id: `eq.${userId}`, limit: '1' });
  const rows = await supabaseRequest('meta_connections', { query: query.toString() });
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) throw new Error('Meta 계정을 먼저 연결해 주세요.');
  if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) throw new Error('Meta 로그인이 만료됐어요. 다시 연결해 주세요.');
  return { token: decrypt(row.encrypted_access_token), connectedAt: row.connected_at };
}

function accountRows(result) {
  let rows = result?.ad_accounts || result?.accounts || [];
  if (typeof rows === 'string') { try { rows = JSON.parse(rows); } catch { rows = []; } }
  return Array.isArray(rows) ? rows : [];
}

function reportRows(result) {
  let rows = result?.ad_entities || [];
  if (typeof rows === 'string') { try { rows = JSON.parse(rows); } catch { rows = []; } }
  return Array.isArray(rows) ? rows : [];
}

function seoulDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDate(date, days) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function dailyReportDate(row) {
  const value = String(row.date_start || row.date_stop || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function dailyReportPayload(row, userId, accountId, fetchedAt) {
  const reportDate = dailyReportDate(row);
  if (!reportDate) return null;
  return {
    user_id: userId,
    ad_account_id: accountId,
    report_date: reportDate,
    amount_spent: Number(row.amount_spent || 0),
    impressions: Math.trunc(Number(row.impressions || 0)),
    clicks: Math.trunc(Number(row.clicks || 0)),
    reach: row.reach == null ? null : Math.trunc(Number(row.reach || 0)),
    landing_page_views: Math.trunc(Number(row.omni_landing_page_view || 0)),
    purchases: Math.trunc(Number(row.omni_purchase || 0)),
    leads: Math.trunc(Number(row.lead || 0)),
    generated_at: fetchedAt,
  };
}

async function readMetaDailyReports(userId, accountId, since, until) {
  const query = new URLSearchParams({
    select: 'report_date,amount_spent,impressions,clicks,reach,landing_page_views,purchases,leads,generated_at',
    user_id: `eq.${userId}`,
    ad_account_id: `eq.${accountId}`,
    report_date: `gte.${since}`,
    order: 'report_date.asc',
  });
  // PostgREST supports one filter per column, so bound the upper date with `and`.
  query.set('and', `(report_date.lte.${until})`);
  const rows = await supabaseRequest('meta_daily_reports', { query: query.toString() });
  return Array.isArray(rows) ? rows : [];
}

async function saveMetaDailyReports(rows, userId, accountId, since, until, fetchedAt) {
  const payloadByDate = new Map(rows.map(row => dailyReportPayload(row, userId, accountId, fetchedAt)).filter(Boolean).map(row => [row.report_date, row]));
  for (let date = since; date <= until; date = shiftDate(date, 1)) {
    if (!payloadByDate.has(date)) payloadByDate.set(date, {
      user_id: userId, ad_account_id: accountId, report_date: date,
      amount_spent: 0, impressions: 0, clicks: 0, reach: 0,
      landing_page_views: 0, purchases: 0, leads: 0, generated_at: fetchedAt,
    });
  }
  const payload = [...payloadByDate.values()];
  await supabaseRequest('meta_daily_reports', {
    method: 'POST',
    query: 'on_conflict=user_id,ad_account_id,report_date',
    body: payload,
    prefer: 'resolution=merge-duplicates,return=minimal',
  });
}

function completeDailyHistory(rows, since, until) {
  const byDate = new Map(rows.map(row => [String(row.report_date).slice(0, 10), row]));
  const result = [];
  for (let date = since; date <= until; date = shiftDate(date, 1)) {
    const row = byDate.get(date);
    result.push(row ? {
      date,
      amount_spent: Number(row.amount_spent || 0),
      impressions: Number(row.impressions || 0),
      clicks: Number(row.clicks || 0),
      reach: row.reach == null ? null : Number(row.reach),
      landing_page_views: Number(row.landing_page_views || 0),
      purchases: Number(row.purchases || 0),
      leads: Number(row.leads || 0),
      generated_at: row.generated_at,
    } : {
      date, amount_spent: 0, impressions: 0, clicks: 0, reach: 0,
      landing_page_views: 0, purchases: 0, leads: 0, generated_at: null,
    });
  }
  return result;
}

async function listAccounts(client) {
  const result = await client.callTool(ACCOUNT_TOOL, {
    advertiser_job: 'report_measure_or_look_up',
    advertiser_request: 'Agent Office에서 광고 계정과 성과를 조회합니다.',
    client_conversation_id: conversationId(),
    limit: 50,
  });
  return accountRows(result).map(row => ({
    adAccountId: String(row.ad_account_id || ''),
    name: String(row.ad_account_name || row.name || row.ad_account_id || ''),
    currency: String(row.currency || 'KRW'),
    minDailyBudget: Number(row.min_daily_budget_cents || 0),
    status: String(row.account_status || 'UNKNOWN'),
    queryable: Boolean(row.is_queryable && row.is_ads_mcp_enabled),
  })).filter(row => row.adAccountId);
}

export async function completeMetaOAuth({ userId, state, code }) {
  const verifier = await consumeOAuthState(state, userId);
  const token = await exchangeCode(code, verifier);
  const client = await createMetaClient(token.access_token);
  const accounts = await listAccounts(client);
  if (!accounts.some(account => account.queryable)) throw new Error('Meta 계정은 찾았지만 조회 가능한 광고 계정이 없습니다. 앱 권한과 광고 계정 접근 권한을 확인해 주세요.');
  await storeConnection(userId, token);
  return { accountCount: accounts.length };
}

export async function getMetaAccounts(userId) {
  const { token } = await getConnection(userId);
  return listAccounts(await createMetaClient(token));
}

export async function getMetaReport(userId, adAccountId, datePreset = 'last_7d') {
  const allowed = new Set(['today', 'yesterday', 'last_7d', 'last_14d', 'last_28d', 'this_month']);
  if (!allowed.has(datePreset)) throw new Error('조회 기간을 확인해 주세요.');
  const { token } = await getConnection(userId);
  const client = await createMetaClient(token);
  const accounts = await listAccounts(client);
  const account = accounts.find(item => item.adAccountId === String(adAccountId));
  if (!account || !account.queryable) throw new Error('조회 가능한 광고 계정을 선택해 주세요.');
  const clientConversationId = conversationId();
  const base = { ad_account_id: account.adAccountId, advertiser_job: 'report_measure_or_look_up', advertiser_request: 'Agent Office에서 Meta 광고 성과를 확인합니다.', client_conversation_id: clientConversationId, date_preset: datePreset, object_state: 'live', limit: 50 };
  const fields = ['name', 'amount_spent', 'impressions', 'clicks', 'reach', 'ctr', 'cpc', 'cpm', 'omni_landing_page_view', 'omni_purchase', 'lead'];
  const fetchedAt = new Date().toISOString();
  const dailyUntil = shiftDate(seoulDateParts(), -1);
  const dailySince = shiftDate(dailyUntil, -6);
  const dailyBase = {
    ad_account_id: account.adAccountId,
    advertiser_job: 'report_measure_or_look_up',
    advertiser_request: 'Agent Office에서 최근 7일을 날짜별로 보관합니다.',
    client_conversation_id: clientConversationId,
    time_range: JSON.stringify({ since: dailySince, until: dailyUntil }),
    time_increment: '1',
    object_state: 'live',
    limit: 50,
  };
  const [totalsResult, campaignsResult, dailyResult] = await Promise.all([
    client.callTool(ENTITY_TOOL, { ...base, level: 'ad_account', fields }),
    client.callTool(ENTITY_TOOL, { ...base, level: 'campaign', fields: [...fields, 'effective_status', 'objective', 'daily_budget', 'lifetime_budget', 'budget_remaining'] }),
    client.callTool(ENTITY_TOOL, { ...dailyBase, level: 'ad_account', fields }).then(result => ({ result })).catch(error => ({ error })),
  ]);
  let dailyRows = [];
  let dailyHistoryStatus = 'unavailable';
  let dailyHistoryFetchedAt = null;
  try {
    if (dailyResult.error) throw dailyResult.error;
    const dailyEntities = reportRows(dailyResult.result);
    await saveMetaDailyReports(dailyEntities, userId, account.adAccountId, dailySince, dailyUntil, fetchedAt);
    dailyHistoryStatus = 'fresh';
    dailyHistoryFetchedAt = fetchedAt;
  } catch (error) {
    console.error(JSON.stringify({ event: 'meta_daily_archive_refresh_failed', code: error.code || 'UPSTREAM_ERROR' }));
  }
  try {
    const storedRows = await readMetaDailyReports(userId, account.adAccountId, dailySince, dailyUntil);
    dailyRows = completeDailyHistory(storedRows, dailySince, dailyUntil);
    dailyHistoryFetchedAt = storedRows.reduce((latest, row) => !latest || row.generated_at > latest ? row.generated_at : latest, dailyHistoryFetchedAt);
    if (dailyHistoryStatus !== 'fresh') dailyHistoryStatus = storedRows.length ? 'cached' : 'unavailable';
  } catch (error) {
    console.error(JSON.stringify({ event: 'meta_daily_archive_read_failed', code: error.code || 'SUPABASE_REQUEST_FAILED' }));
  }
  return {
    account, datePreset, fetchedAt,
    totals: reportRows(totalsResult)[0] || null,
    campaigns: reportRows(campaignsResult),
    dailyHistory: { since: dailySince, until: dailyUntil, status: dailyHistoryStatus, fetchedAt: dailyHistoryFetchedAt, rows: dailyRows },
  };
}

export async function disconnectMeta(userId) {
  const query = new URLSearchParams({ user_id: `eq.${userId}` });
  await supabaseRequest('meta_connections', { method: 'DELETE', query: query.toString() });
}

