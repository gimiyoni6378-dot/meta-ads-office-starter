import { randomBytes } from 'node:crypto';
import { envValue } from './http.mjs';
import { supabaseRequest } from './supabase.mjs';
import { userMetaClient, getMetaAccounts } from './meta.mjs';
import { metaToolError } from './meta-errors.mjs';

const TABLE = 'karni_launches';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function fail(message, status = 400) { const e = new Error(message); e.status = status; throw e; }
const parse = value => { if (typeof value !== 'string') return value; try { return JSON.parse(value); } catch { return null; } };
const rows = value => { const result = parse(value); return Array.isArray(result) ? result : []; };
export function budgetMinor(amount, currency) {
  const factor = ['KRW','JPY'].includes(currency) ? 1 : 100;
  return amount * factor;
}
const text = (value, label, max = 200) => { if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`${label}을 확인해 주세요.`); return value.trim(); };
function id(value, label) { const s = String(value || ''); if (!/^\d+$/.test(s)) fail(`${label}을 선택해 주세요.`); return s; }

export function validateBrief(input, now = Date.now()) {
  const b = input || {};
  const budget = Number(b.budget);
  if (!Number.isSafeInteger(budget) || budget <= 0 || budget > 100000000) fail('예산은 1~100,000,000 사이 정수로 입력해 주세요.');
  if (!['daily','lifetime'].includes(b.budgetType)) fail('예산 방식을 선택해 주세요.');
  if (!['OUTCOME_TRAFFIC','OUTCOME_SALES'].includes(b.objective)) fail('광고 목표를 선택해 주세요.');
  const start = Date.parse(b.start), end = Date.parse(b.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= now || end <= start) fail('시작은 현재 이후, 종료는 시작 이후로 지정해 주세요.');
  const ageMin = Number(b.ageMin), ageMax = Number(b.ageMax);
  if (!Number.isInteger(ageMin) || !Number.isInteger(ageMax) || ageMin < 18 || ageMax > 65 || ageMin > ageMax) fail('연령 범위는 18~65세로 입력해 주세요.');
  if (!['all','male','female'].includes(b.gender)) fail('성별 설정을 확인해 주세요.');
  if (!['advantage','manual'].includes(b.audienceMode)) fail('타겟 방식을 선택해 주세요.');
  const countries = [...new Set(String(b.countries || '').toUpperCase().split(',').map(x=>x.trim()).filter(Boolean))];
  const countryCodes = new Set(['KR','US','JP','GB','CA','AU','NZ','DE','FR','ES','IT','SG','HK','TW','TH','VN','ID','MY','PH']);
  if (!countries.length || countries.some(c=>!countryCodes.has(c))) fail('지원 국가 코드를 확인해 주세요.');
  if (countries.includes('TH') && ageMin < 20) fail('태국 타겟은 최소 20세로 지정해 주세요.');
  const placements = Array.isArray(b.placements) ? [...new Set(b.placements)] : [];
  if (!placements.length || placements.some(p=>!['auto','facebook_feed','facebook_story','facebook_reels','instagram_feed','instagram_story','instagram_reels'].includes(p)) || (placements.includes('auto') && placements.length>1)) fail('자동 또는 수동 노출지면 중 하나를 선택해 주세요.');
  let url; try { url = new URL(b.linkUrl); } catch { fail('연결 URL을 입력해 주세요.'); }
  if (url.protocol !== 'https:' || url.username || url.password) fail('연결 URL은 HTTPS 주소여야 합니다.');
  const result = {
    accountId:id(b.accountId,'광고 계정'), pageId:id(b.pageId,'Facebook 페이지'),
    campaignName:text(b.campaignName,'캠페인명'), adsetName:text(b.adsetName,'광고세트명'), adName:text(b.adName,'광고명'),
    objective:b.objective, budget,budgetType:b.budgetType,start:new Date(start).toISOString(),end:new Date(end).toISOString(),
    countries,ageMin,ageMax,gender:b.gender,audienceMode:b.audienceMode,placements,
    message:text(b.message,'광고 본문',2200),headline:text(b.headline,'광고 제목',255),linkUrl:url.toString(),
    cta: ['LEARN_MORE','SHOP_NOW','SIGN_UP','CONTACT_US'].includes(b.cta) ? b.cta : 'LEARN_MORE',
    instagramId:b.instagramId ? id(b.instagramId,'Instagram 계정 ID') : null,
    specialAdCategories:[],
  };
  if (b.specialCategory !== 'NONE') fail('주택·고용·금융·정치 등 특별 광고 카테고리는 현재 폼에서 게재할 수 없습니다.');
  if (b.objective==='OUTCOME_SALES') {
    result.pixelId=id(b.pixelId,'픽셀 ID');
    if (!['PURCHASE','LEAD','ADD_TO_CART','COMPLETE_REGISTRATION'].includes(b.eventType)) fail('전환 이벤트를 선택해 주세요.');
    result.eventType=b.eventType;
  }
  return result;
}

export function targeting(b) {
  const t = {geo_locations:{countries:b.countries,location_types:['home','recent']}};
  if(b.audienceMode==='manual') {
    t.age_min=b.ageMin; t.age_max=b.ageMax; t.targeting_automation={advantage_audience:0};
  } else { t.age_min=Math.min(b.ageMin,25); t.age_range=[b.ageMin,b.ageMax]; t.targeting_automation={advantage_audience:1}; }
  if(b.gender!=='all') t.genders=[b.gender==='male'?1:2];
  if(!b.placements.includes('auto')) {
    t.publisher_platforms=[...new Set(b.placements.map(p=>p.split('_')[0]))];
    for(const platform of t.publisher_platforms) t[`${platform}_positions`]=b.placements.filter(p=>p.startsWith(platform+'_')).map(p=>({feed:platform==='facebook'?'feed':'stream',story:'story',reels:platform==='facebook'?'facebook_reels':'reels'})[p.split('_')[1]]);
  }
  return t;
}

function context(row) { return {ad_account_id:row.brief.accountId,advertiser_job:'create_and_launch_new_ads',advertiser_request:'소재 전달 폼의 설정으로 광고를 게재합니다.',client_conversation_id:row.checkpoint.conversationId}; }
async function call(client,name,args) {
  const r=await client.callTool(name,args);
  if(r.error_message || r.error_category) throw metaToolError({structuredContent:r});
  return r;
}
async function storage(path,method,body,contentType) {
  const response=await fetch(`${envValue('SUPABASE_URL').replace(/\/$/,'')}/storage/v1/${path}`,{
    method,headers:{apikey:envValue('SUPABASE_SERVICE_ROLE_KEY'),authorization:`Bearer ${envValue('SUPABASE_SERVICE_ROLE_KEY')}`,...(contentType?{'content-type':contentType}:{}),'x-upsert':'true'},body,signal:AbortSignal.timeout(15000),redirect:'error',
  });
  if(!response.ok) fail('소재 저장소 요청에 실패했습니다.',502);
  return response;
}
export async function listLaunches(userId) { return supabaseRequest(TABLE,{query:new URLSearchParams({user_id:`eq.${userId}`,select:'*',order:'created_at.desc',limit:'30'}).toString()}); }
export async function getLaunch(userId,launchId) {
  if(!uuid.test(launchId)) fail('접수 번호를 확인해 주세요.');
  const r=await supabaseRequest(TABLE,{query:new URLSearchParams({id:`eq.${launchId}`,user_id:`eq.${userId}`,select:'*',limit:'1'}).toString()});
  if(!r?.[0]) fail('접수 내역을 찾지 못했습니다.',404); return r[0];
}
async function update(row,body,filters={}) {
  const result=await supabaseRequest(TABLE,{method:'PATCH',query:new URLSearchParams({id:`eq.${row.id}`,user_id:`eq.${row.user_id}`,...filters}).toString(),body:{...body,updated_at:new Date().toISOString()},prefer:'return=representation'});
  if(!result?.[0]) fail('다른 요청이 처리 중입니다. 내역을 새로고침해 주세요.',409); return result[0];
}
export async function setup(userId,accountId) {
  const accounts=await getMetaAccounts(userId);
  if(!accountId) return {accounts};
  const account=accounts.find(a=>a.adAccountId===accountId&&a.queryable);
  if(!account) fail('접근 가능한 광고 계정을 선택해 주세요.',403);
  const client=await userMetaClient(userId);
  const tools=await client.listTools();
  const required=['ads_creative_upload_media','ads_create_campaign','ads_create_ad_set','ads_create_creative','ads_create_ad','ads_activate_entity'];
  const missingTools=required.filter(name=>!tools.some(t=>t.name===name));
  const pages=[]; let cursor;
  for(let i=0;i<20;i++) {
    const r=await call(client,'ads_get_ad_account_pages',{ad_account_id:accountId,limit:50,...(cursor?{cursor}:{})});
    pages.push(...rows(r.pages)); cursor=r.next_cursor; if(!cursor)break;
  }
  // Newly used accounts may have no historically promoted pages yet.
  if(!pages.length && tools.some(t=>t.name==='ads_get_user_pages')) {
    cursor=undefined;
    for(let i=0;i<5;i++) {
      const r=await call(client,'ads_get_user_pages',{limit:50,...(cursor?{cursor}:{})});
      pages.push(...rows(r.pages));cursor=r.next_cursor;if(!cursor)break;
    }
  }
  return {accounts,account,pages,missingTools};
}
export async function saveLaunch(user,input) {
  if(!uuid.test(String(input.id))) fail('접수 번호를 확인해 주세요.');
  const brief=validateBrief(input.brief);
  const settings=await setup(user.id,brief.accountId);
  if(settings.missingTools.length) fail(`현재 사이트의 Meta 연결에서 광고 작성 도구를 사용할 수 없습니다: ${settings.missingTools.join(', ')}. Meta 앱 권한을 확인해 주세요.`);
  if(!settings.pages.some(p=>String(p.page_id)===brief.pageId)) fail('광고 계정에 연결된 페이지를 선택해 주세요.');
  brief.currency=settings.account.currency;
  // Preserve account currency units in the brief; convert at the API boundary.
  if(!['KRW','USD','JPY','EUR','GBP','CAD','AUD','SGD','HKD','TWD'].includes(brief.currency)) fail('현재 지원하지 않는 계정 통화입니다.');
  brief.accountName=settings.account.name;
  if(brief.budgetType==='daily' && budgetMinor(brief.budget,brief.currency)<settings.account.minDailyBudget) fail('선택한 계정의 최소 일 예산보다 작습니다.');
  const data=String(input.image||'');
  const match=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(data);
  if(!match) fail('JPG, PNG, WebP 이미지가 필요합니다.');
  const bytes=Buffer.from(match[2],'base64');
  if(bytes.length>2*1024*1024 || bytes.length<12) fail('이미지는 2MB 이하로 업로드해 주세요.');
  const valid = match[1]==='image/png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : match[1]==='image/jpeg' ? bytes[0]===255&&bytes[1]===216&&bytes[2]===255 : bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  if(!valid) fail('이미지 파일 형식이 올바르지 않습니다.');
  let existing;
  try { existing=await getLaunch(user.id,input.id); } catch(e) { if(e.status!==404)throw e; }
  if(existing) return existing;
  const assetPath=`${user.id}/${input.id}/creative.${{ 'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[match[1]]}`;
  const inserted=await supabaseRequest(TABLE,{method:'POST',body:{id:input.id,user_id:user.id,brief,asset_path:assetPath,checkpoint:{conversationId:randomBytes(15).toString('hex').slice(0,20)}},prefer:'return=representation'});
  const row=inserted[0];
  await storage(`object/creative-assets/${assetPath}`,'POST',bytes,match[1]);
  return update(row,{state:'ready'});
}
async function signedAsset(row) {
  const r=await storage(`object/sign/creative-assets/${row.asset_path}`,'POST',JSON.stringify({expiresIn:3600}),'application/json');
  const value=await r.json(); const path=value.signedURL||value.signedUrl;
  if(!path)fail('소재 다운로드 주소를 생성하지 못했습니다.',502);
  return `${envValue('SUPABASE_URL').replace(/\/$/,'')}/storage/v1${path}`;
}
function ensureCreated(r,key) {
  if(!/^\d+$/.test(String(r[key]||''))) fail('Meta 응답에서 생성 ID를 확인하지 못했습니다. 중복 생성을 막기 위해 자동 재시도를 중단합니다.',502);
  if(rows(r.active_errors).length) fail('Meta 초안에 검증 오류가 있습니다. 광고 관리자에서 확인해 주세요.',502);
}
export async function advance(userId,launchId,confirm,{prepareOnly=false}={}) {
  let row=await getLaunch(userId,launchId);
  if(row.checkpoint?.cancelled) fail('사용자가 초기화한 접수입니다. 새 접수를 시작해 주세요.',409);
  if(['attention','uploading'].includes(row.state)) fail(row.error ? `이전 ${row.pending_operation==='creative'?'광고 소재 생성':'처리'} 실패: ${row.error}` : '소재 저장이 완료되지 않았습니다. 접수 내역을 확인해 주세요.',409);
  if(row.pending_operation) fail('이전 요청 결과를 확인 중입니다. 다시 생성하지 말고 상태를 조회해 주세요.',409);
  if(row.state==='submitted') return row;
  if(prepareOnly && row.step>=5) {
    if(row.checkpoint.activationIndex) fail('이미 게재 요청을 시작한 접수입니다. Meta 광고 관리자에서 상태를 확인해 주세요.',409);
    return row;
  }
  if(!confirm) fail('설정을 확인하고 광고 게재에 동의해 주세요.');
  if(Date.parse(row.brief.end)<=Date.now()) fail('광고 종료 시간이 지났습니다. 새 설정으로 접수해 주세요.');
  const client=await userMetaClient(userId);
  const b=row.brief, cp={...row.checkpoint}, base=context(row);
  if(row.step===0) {
    const available=await client.listTools();
    if(!['ads_creative_upload_media','ads_create_campaign','ads_create_ad_set','ads_create_creative','ads_create_ad','ads_activate_entity'].every(n=>available.some(t=>t.name===n))) fail('현재 Meta 연결에서 광고 생성 권한을 확인하지 못했습니다.',403);
    if(Date.parse(b.start)<=Date.now()) fail('시작 시간이 지났습니다. 새 설정으로 접수해 주세요.');
  }
  const operations=['image','campaign','adset','creative','ad','activate'];
  const op=operations[row.step]; if(!op)fail('처리 단계를 확인해 주세요.');
  row=await update(row,{state:'working',pending_operation:op,confirmed_at:row.confirmed_at||new Date().toISOString(),error:null},{pending_operation:'is.null',step:`eq.${row.step}`,state:`eq.${row.state}`});
  try {
    let r;
    if(op==='image') {
      r=await call(client,'ads_creative_upload_media',{...base,upload_source:'URL',media_type:'IMAGE',media_url:await signedAsset(row),name:b.adName});
      if(!r.hash)fail('Meta에서 이미지 업로드 결과를 확인하지 못했습니다.',502); cp.imageHash=r.hash;
    } else if(op==='campaign') {
      r=await call(client,'ads_create_campaign',{...base,campaign_name:b.campaignName,buying_type:'AUCTION',objective:b.objective,special_ad_categories:'[]'});
      cp.campaignId=r.campaign_id; cp.draft=r.status==='DRAFT'; cp.validGoals=rows(r.valid_optimization_goals); ensureCreated(r,'campaign_id');
      const goal=b.objective==='OUTCOME_SALES'?'OFFSITE_CONVERSIONS':'LINK_CLICKS';
      if(!cp.validGoals.includes(goal))fail('이 캠페인에서 선택한 최적화 목표를 지원하지 않습니다. 광고 관리자에서 확인해 주세요.',502);
    } else if(op==='adset') {
      const parent=await call(client,'ads_get_ad_entities',{...base,level:'campaign',object_state:cp.draft?'draft':'live',object_ids:[cp.campaignId],fields:['daily_budget','lifetime_budget','effective_status'],limit:1});
      const parentRows=rows(cp.draft?parent.ad_drafts:parent.ad_entities);
      if(!parentRows.length)fail('부모 캠페인 설정을 확인하지 못했습니다.',502);
      const parentValues=cp.draft?Object.fromEntries(Object.entries(parentRows[0].values||{}).map(([k,v])=>[k,v?.new])):parentRows[0];
      if(Number(parentValues.daily_budget||0)>0||Number(parentValues.lifetime_budget||0)>0)fail('캠페인에 예산이 이미 있습니다. 광고세트 예산과 충돌하므로 확인이 필요합니다.',502);
      r=await call(client,'ads_create_ad_set',{...base,campaign_id:cp.campaignId,ad_set_name:b.adsetName,billing_event:'IMPRESSIONS',optimization_goal:b.objective==='OUTCOME_SALES'?'OFFSITE_CONVERSIONS':'LINK_CLICKS',destination_type:'WEBSITE',targeting:JSON.stringify(targeting(b)),...(b.audienceMode==='manual'?{advantage_audience_off_reason:'ADVERTISER_REQUESTED_OFF'}:{}),[b.budgetType==='daily'?'daily_budget':'lifetime_budget']:budgetMinor(b.budget,b.currency),start_time:b.start,end_time:b.end,...(b.pixelId?{promoted_object:JSON.stringify({pixel_id:b.pixelId,custom_event_type:b.eventType})}:{})});
      cp.adsetId=r.ad_set_id; ensureCreated(r,'ad_set_id');
      if((r.status==='DRAFT')!==cp.draft)fail('Meta 생성 모드가 변경됐습니다. 광고 관리자에서 확인해 주세요.',502);
    } else if(op==='creative') {
      r=await call(client,'ads_create_creative',{...base,name:b.adName,page_id:b.pageId,...(b.instagramId?{instagram_user_id:b.instagramId}:{}),image_hash:cp.imageHash,message:b.message,headline:b.headline,link_url:b.linkUrl,call_to_action_type:b.cta,objective:b.objective,advantage_plus_creative:false});
      cp.creativeId=r.creative_id; ensureCreated(r,'creative_id');
    } else if(op==='ad') {
      r=await call(client,'ads_create_ad',{...base,ad_set_id:cp.adsetId,ad_name:b.adName,creative:JSON.stringify({creative_id:cp.creativeId})});
      cp.adId=r.ad_id; ensureCreated(r,'ad_id');
      if((r.status==='DRAFT')!==cp.draft)fail('Meta 생성 모드가 변경됐습니다. 광고 관리자에서 확인해 주세요.',502);
    } else {
      if(cp.draft) {
        const drafts=await call(client,'ads_get_ad_entities',{...base,object_state:'draft',object_ids:[cp.campaignId,cp.adsetId,cp.adId],limit:10});
        const objects=rows(drafts.ad_drafts);
        if(objects.length<3 || objects.some(d=>rows(d.active_errors).length || d.publish_error)) fail('초안의 게시 오류 또는 누락을 광고 관리자에서 확인해 주세요.',502);
      }
      const targets=cp.draft ? [['campaign',cp.campaignId]] : [['campaign',cp.campaignId],['ad_set',cp.adsetId],['ad',cp.adId]];
      // One activation per HTTP request, with durable progress between each.
      const index=cp.activationIndex||0; const [type,entityId]=targets[index];
      r=await call(client,'ads_activate_entity',{...base,entity_id:entityId,entity_type:type,...(cp.draft?{object_ids:[cp.campaignId,cp.adsetId,cp.adId],publish_as_active:true}:{})});
      const activation=parse(r.result)||r;
      if(!['ACTIVE','PUBLISHING'].includes(activation.status))fail('Meta에서 게재 요청 접수를 확인하지 못했습니다.',502);
      cp.activationIndex=index+1;
      cp.activation=activation.status;
      if(index<targets.length-1) return update(row,{checkpoint:cp,state:'paused',pending_operation:null});
    }
    if(r.client_conversation_id)cp.conversationId=r.client_conversation_id;
    cp.notices=[...(cp.notices||[]),...(r.warnings||[]),...(r.defaulted_instagram_user_id?[`연결된 Instagram 계정 ${r.defaulted_instagram_user_id} 사용`]:[])];
    for(const n of Object.values(r.additional_info||{})) if(n?.message)cp.notices.push(`${n.message} ${n.how_to_turn_off||''}`);
    return update(row,{checkpoint:cp,step:row.step+1,state:op==='activate'?'submitted':'paused',pending_operation:null});
  } catch(error) {
    // A timeout may have happened after Meta committed. Never silently repeat writes.
    if(error.metaSubcode)cp.lastErrorSubcode=error.metaSubcode;
    await update(row,{checkpoint:cp,state:'attention',error:String(error.message||'Meta 처리 결과 확인 필요').slice(0,500)}).catch(()=>{});
    throw error;
  }
}

export async function recoverCreative(userId,launchId) {
  const row=await getLaunch(userId,launchId);
  if(row.checkpoint?.cancelled)fail('사용자가 초기화한 접수입니다. 다시 진행할 수 없습니다.',409);
  if(row.state!=='attention'||row.step!==3||row.pending_operation!=='creative')fail('이 접수는 광고 소재 복구 대상이 아닙니다.',409);
  if(Date.now()-Date.parse(row.updated_at)<120000)fail('이전 요청이 끝났는지 확인하기 위해 잠시 후 다시 확인해 주세요.',409);
  const client=await userMetaClient(userId);const cp={...row.checkpoint};const b=row.brief;
  const matches=[];let cursor;
  for(let i=0;i<20;i++){
    const result=await call(client,'ads_get_creatives',{...context(row),fields:['id','name','body','title','link_url','image_hash','object_story_id','effective_object_story_id'],limit:100,...(cursor?{cursor}:{})});
    const candidates=rows(result.ad_creatives).filter(c=>c.name===b.adName&&c.image_hash===cp.imageHash);
    for(const c of candidates){
      const page=String(c.object_story_id||c.effective_object_story_id||'').split('_')[0];
      if(c.body!==b.message||c.title!==b.headline||c.link_url!==b.linkUrl||page!==b.pageId)fail('같은 이름·이미지의 소재가 있습니다. 자동 재생성을 멈췄습니다. Meta에서 확인해 주세요.',409);
      matches.push(c);
    }
    cursor=result.next_cursor;if(!cursor)break;
  }
  if(cursor)fail('소재 전체 목록을 확인하지 못해 자동 재시도를 중단했습니다.',409);
  if(matches.length>1)fail('일치하는 소재가 여러 개입니다. Meta에서 확인해 주세요.',409);
  if(matches.length===1)cp.creativeId=matches[0].id;
  delete cp.lastErrorSubcode;
  return update(row,{checkpoint:cp,step:matches.length?4:3,state:'paused',pending_operation:null,error:null},{state:'eq.attention',pending_operation:'eq.creative',step:'eq.3'});
}
export async function cancelLaunch(userId,launchId) {
  const row=await getLaunch(userId,launchId);
  if(row.checkpoint?.cancelled)return row;
  if(row.state!=='attention'||row.step!==3||row.pending_operation!=='creative')fail('초기화할 수 있는 실패 접수가 아닙니다.',409);
  const checkpoint={...row.checkpoint,cancelled:true,cancelledAt:new Date().toISOString()};
  return update(row,{checkpoint,state:'paused',pending_operation:null},{state:'eq.attention',pending_operation:'eq.creative',step:'eq.3'});
}
export async function verify(userId,launchId) {
  const row=await getLaunch(userId,launchId); const cp=row.checkpoint;
  if(!cp.adId) return {launch:row,entities:[],verified:false};
  const client=await userMetaClient(userId);
  const result=await call(client,'ads_get_ad_entities',{...context(row),object_ids:[cp.adId],level:'ad',object_state:'live',date_preset:'today',fields:['name','status','effective_status','amount_spent','impressions','clicks'],limit:1});
  const entities=rows(result.ad_entities);
  return {launch:row,entities,verified:entities.length>0,fetchedAt:new Date().toISOString()};
}
