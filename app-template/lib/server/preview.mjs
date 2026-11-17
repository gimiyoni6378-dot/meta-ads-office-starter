import { getLaunch, fail } from './karni.mjs';
import { userMetaClient } from './meta.mjs';

export const previewFormats = Object.freeze({
  INSTAGRAM_STANDARD:'Instagram 피드',
  INSTAGRAM_STORY:'Instagram 스토리',
  INSTAGRAM_REELS:'Instagram 릴스',
  MOBILE_FEED_STANDARD:'Facebook 모바일 피드',
  DESKTOP_FEED_STANDARD:'Facebook PC 피드',
  FACEBOOK_REELS_MOBILE:'Facebook 릴스',
  RIGHT_COLUMN_STANDARD:'Facebook 오른쪽 열',
});

export function trustedPreviewUrl(value) {
  try {
    const u=new URL(value);
    if(u.protocol!=='https:' || u.username || u.password || (u.port && u.port!=='443'))return null;
    if(!['facebook.com','instagram.com','meta.com'].some(host=>u.hostname===host||u.hostname.endsWith('.'+host)))return null;
    return u.href;
  }catch{return null;}
}

export function normalizePreview(result,format) {
  const all=Array.isArray(result.previews)?result.previews:[];
  const candidates=all.filter(item=>item.ad_format===format);
  if(result.ad_format===format)candidates.push(result);
  const preview=candidates.find(p=>trustedPreviewUrl(p.preview_url));
  const availableFormats=[...new Set(all.filter(p=>trustedPreviewUrl(p.preview_url)&&previewFormats[p.ad_format]).map(p=>p.ad_format))];
  if(!preview)fail('Meta에서 이 지면의 미리보기를 제공하지 못했습니다. 다른 지면을 선택하거나 광고 관리자에서 확인해 주세요.',422);
  const notices=[];
  const enhancement=result.additional_info?.advantage_plus_creative_defaults;
  if(enhancement?.message)notices.push(`${enhancement.message} ${enhancement.how_to_turn_off||''}`);
  if(result.failed_ad_formats?.length)notices.push(`미리보기를 제공하지 못한 지면: ${result.failed_ad_formats.map(f=>previewFormats[f]||f).join(', ')}`);
  if(result.creative?.preview_error)notices.push('일부 지면을 렌더링하지 못했습니다. 광고 관리자에서도 확인해 주세요.');
  return {format,label:previewFormats[format],url:trustedPreviewUrl(preview.preview_url),availableFormats,notices,expiresAt:result.previews_expire_at||null};
}

function pendingCreative(error) {
  return !error.metaAccessDenied && (error.metaPreviewPending || /not (?:yet )?(?:fully )?materiali[sz]ed|has not fully materiali[sz]ed|draft.*not ready/i.test(error.message||''));
}

export async function fetchPreview(client,row,format) {
  if(!Object.hasOwn(previewFormats,format))fail('지원하는 미리보기 지면을 선택해 주세요.');
  const cp=row.checkpoint||{};
  if(!cp.adId&&!cp.creativeId)fail('먼저 ‘초안만 만들기 · 미게재’를 눌러 광고 소재를 생성해 주세요.',409);
  const args={ad_format:format,advertiser_job:'create_and_launch_new_ads',advertiser_request:'인스타 피드용,릴스,스토리,페이스북 여러가지 송출되는 규격에 맞춰서 어떻게 나가는지',client_conversation_id:cp.conversationId};
  const request=async entity=>{
    const r=await client.callTool('ads_get_ad_preview',{...args,...entity});
    if(r.error_message||r.error_category){const e=new Error(r.error_message||'Meta 미리보기 요청이 실패했습니다.');e.metaAccessDenied=r.error_category==='PERMISSION'||r.error_category==='NOT_FOUND';throw e;}
    return r;
  };
  let result;
  try{result=await request(cp.adId?{ad_id:cp.adId}:{creative_id:cp.creativeId});}
  catch(error){
    if(cp.adId&&cp.creativeId&&pendingCreative(error))result=await request({creative_id:cp.creativeId});
    else throw error;
  }
  return normalizePreview(result,format);
}

export async function getPreview(userId,launchId,format='INSTAGRAM_STANDARD') {
  // Resolve IDs exclusively from this user's saved request; never accept arbitrary Meta IDs.
  const row=await getLaunch(userId,launchId);
  if(!Object.hasOwn(previewFormats,format))fail('지원하는 미리보기 지면을 선택해 주세요.');
  return fetchPreview(await userMetaClient(userId),row,format);
}
