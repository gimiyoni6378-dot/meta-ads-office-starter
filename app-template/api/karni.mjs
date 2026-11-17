import { requireUser } from '../lib/server/auth.mjs';
import { json, sameOrigin } from '../lib/server/http.mjs';
import { setup, listLaunches, saveLaunch, advance, verify, recoverCreative, cancelLaunch } from '../lib/server/karni.mjs';
import { getPreview } from '../lib/server/preview.mjs';
export const config={maxDuration:60};
export default async function handler(req,res) {
  const auth=await requireUser(req,res);
  if(auth.error)return json(res,auth.error.status,{error:auth.error.message});
  try {
    const action=String(req.query?.action||'list');
    if(req.method==='GET') {
      if(action==='setup')return json(res,200,await setup(auth.user.id,String(req.query?.accountId||'')));
      if(action==='list')return json(res,200,{launches:await listLaunches(auth.user.id)});
      if(action==='verify')return json(res,200,await verify(auth.user.id,String(req.query?.id||'')));
      if(action==='preview')return json(res,200,await getPreview(auth.user.id,String(req.query?.id||''),String(req.query?.format||'INSTAGRAM_STANDARD')));
    }
    if(req.method==='POST') {
      if(!sameOrigin(req))return json(res,403,{error:'같은 사이트에서 요청해 주세요.'});
      const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
      if(action==='save')return json(res,200,{launch:await saveLaunch(auth.user,body)});
      if(action==='prepare')return json(res,200,{launch:await advance(auth.user.id,String(body.id||''),true,{prepareOnly:true})});
      if(action==='recover')return json(res,200,{launch:await recoverCreative(auth.user.id,String(body.id||''))});
      if(action==='cancel')return json(res,200,{launch:await cancelLaunch(auth.user.id,String(body.id||''))});
      if(action==='advance')return json(res,200,{launch:await advance(auth.user.id,String(body.id||''),body.confirm===true)});
    }
    return json(res,405,{error:'지원하지 않는 요청입니다.'});
  }catch(e){return json(res,e.status||502,{error:e.code==='SUPABASE_REQUEST_FAILED'?'앱 데이터베이스를 확인해 주세요. Supabase 마이그레이션 적용 여부를 확인해 주세요.':e.message||'요청에 실패했습니다.'});}
}
