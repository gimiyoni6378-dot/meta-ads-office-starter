import { envValue } from './http.mjs';

export async function supabaseRequest(table, { method = 'GET', query = '', body, prefer } = {}) {
  const url = envValue('SUPABASE_URL');
  const key = envValue('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    const error = new Error('Supabase 서버 연결 설정이 없습니다.');
    error.code = 'SUPABASE_NOT_CONFIGURED';
    throw error;
  }
  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${table}${query ? `?${query}` : ''}`, {
    method,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      'accept': 'application/json',
      ...(prefer ? { prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000),
  });
  const text = await response.text();
  let result = null;
  try { result = text ? JSON.parse(text) : null; } catch { result = null; }
  if (!response.ok) {
    console.error(JSON.stringify({ event: 'supabase_request_failed', table, method, status: response.status }));
    const error = new Error('Supabase 보고서 저장소 요청에 실패했습니다.');
    error.code = 'SUPABASE_REQUEST_FAILED';
    throw error;
  }
  return result;
}

export async function latestReport(propertyId) {
  const query = new URLSearchParams({ select: '*', property_id: `eq.${propertyId}`, order: 'report_date.desc', limit: '1' });
  const rows = await supabaseRequest('ga_daily_reports', { query: query.toString() });
  return Array.isArray(rows) ? rows[0] || null : null;
}

export async function recentReports(propertyId, limit = 15) {
  const query = new URLSearchParams({ select: '*', property_id: `eq.${propertyId}`, order: 'report_date.desc', limit: String(limit) });
  const rows = await supabaseRequest('ga_daily_reports', { query: query.toString() });
  return Array.isArray(rows) ? rows : [];
}

export async function latestRun(propertyId, reportDate) {
  const filters = { select: 'status,started_at,finished_at,error_code,error_message,report_date,trigger_source', property_id: `eq.${propertyId}`, order: 'started_at.desc', limit: '1' };
  if (reportDate) filters.report_date = `eq.${reportDate}`;
  const query = new URLSearchParams(filters);
  const rows = await supabaseRequest('ga_report_runs', { query: query.toString() });
  return Array.isArray(rows) ? rows[0] || null : null;
}

export async function jayDailyAnalysis(propertyId, reportDate) {
  const query = new URLSearchParams({
    select: 'status,model,analysis,input_fingerprint,generated_at',
    property_id: `eq.${propertyId}`,
    report_date: `eq.${reportDate}`,
    limit: '1',
  });
  const rows = await supabaseRequest('ga_jay_daily_analyses', { query: query.toString() });
  return Array.isArray(rows) ? rows[0] || null : null;
}

export async function saveJayDailyAnalysis({ propertyId, reportDate, model, analysis, inputFingerprint }) {
  return supabaseRequest('ga_jay_daily_analyses', {
    method: 'POST',
    query: 'on_conflict=property_id,report_date',
    body: { property_id: propertyId, report_date: reportDate, status: 'success', model, analysis, input_fingerprint: inputFingerprint, generated_at: new Date().toISOString() },
    prefer: 'resolution=merge-duplicates,return=minimal',
  });
}
