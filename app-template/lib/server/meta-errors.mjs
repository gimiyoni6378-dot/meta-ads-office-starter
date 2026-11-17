export function metaToolError(result) {
  let detail=result?.structuredContent;
  for(const item of result?.content||[])if(item.type==='text'){
    try{const value=JSON.parse(item.text);if(value&&typeof value==='object'&&(value.error_message||value.error_subcode||value.error))detail=value;}catch{}
  }
  detail=detail?.error&&typeof detail.error==='object'?detail.error:detail;
  const subcode=String(detail?.error_subcode||detail?.error?.error_subcode||'');
  const raw=String(detail?.error_message||detail?.error_user_msg||detail?.message||'');
  const message=subcode==='1885183' || /development mode|개발 모드/i.test(raw)
    ? 'Meta 앱이 개발 모드라 광고 소재 생성이 차단됐습니다. Meta 개발자 대시보드에서 앱 게시 요건과 공개 모드를 확인해 주세요. (1885183)'
    : raw ? raw.replace(/Bearer\s+\S+/gi,'Bearer [숨김]').replace(/((?:access_token|client_secret|refresh_token)["\s:=]+)[^\s,"}]+/gi,'$1[숨김]').replace(/https?:\/\/[^\s<>"']+/g,'[주소 생략]').slice(0,500)
    : 'Meta MCP 요청이 거절됐습니다. 계정 권한과 입력값을 확인해 주세요.';
  const error=new Error(message);
  error.metaSubcode=subcode;
  error.metaCategory=String(detail?.error_category||'');
  error.metaAccessDenied=/permission|not accessible|access denied|권한/i.test(raw)||error.metaCategory==='PERMISSION';
  const text=(result?.content||[]).filter(i=>i.type==='text').map(i=>i.text).join(' ');
  error.metaPreviewPending=/not (?:yet )?(?:fully )?materiali[sz]ed|has not fully materiali[sz]ed|draft.*not ready/i.test(raw||text);
  return error;
}
