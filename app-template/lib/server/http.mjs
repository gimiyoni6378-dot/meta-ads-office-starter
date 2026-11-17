export function json(res, status, body) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'private, no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  return res.send(JSON.stringify(body));
}

export function method(req, res, expected) {
  if (req.method === expected) return true;
  res.setHeader('allow', expected);
  json(res, 405, { status: 'error', code: 'METHOD_NOT_ALLOWED', error: '요청 방법을 확인해 주세요.' });
  return false;
}

export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try { return new URL(origin).host === host; } catch { return false; }
}

export function envValue(name) {
  return String(process.env[name] || '').trim();
}

export function missingEnv(...names) {
  return names.filter(name => !envValue(name));
}
