const $k = selector => document.querySelector(selector);
const panel = document.createElement('section');
panel.className='panel karni-panel'; panel.id='karni'; panel.dataset.view='ads';
panel.innerHTML=`<div class="karni-intro"><div class="karni-avatar" aria-hidden="true"><img src="/karni-character.svg" alt="" width="34" height="42"></div><div><p class="eyebrow">CREATIVE WORKFLOW</p><h2>광고 소재와 설정</h2><p>소재를 전달하고 설정을 검토해 미게재 초안과 미리보기를 준비합니다.</p></div></div>
<div class="karni-tools"><button class="pixel-button" id="karni-new" type="button">소재 전달 · 광고 설정</button><button class="pixel-button" id="karni-reload" type="button">접수 내역 새로고침</button></div>
<p class="karni-status" id="karni-status" role="status" aria-live="polite"></p>
<form class="karni-form" id="karni-form" hidden>
<label class="karni-field">광고 계정<select name="accountId" required><option value="">계정을 선택하세요</option></select></label>
<label class="karni-field">Facebook 페이지<select name="pageId" required><option value="">계정 선택 후 불러옵니다</option></select><button class="secondary-button karni-page-refresh" id="karni-refresh-pages" type="button">페이지 목록 새로고침</button></label>
<label class="karni-field">캠페인명<input name="campaignName" maxlength="200" required></label><label class="karni-field">광고세트명<input name="adsetName" maxlength="200" required></label>
<label class="karni-field">광고명<input name="adName" maxlength="200" required></label><label class="karni-field">광고 목표<select name="objective"><option value="OUTCOME_TRAFFIC">웹사이트 방문 · 링크 클릭</option><option value="OUTCOME_SALES">웹사이트 전환 · 판매</option></select></label>
<label class="karni-field">예산 방식<select name="budgetType"><option value="daily">일 예산</option><option value="lifetime">기간 전체 예산</option></select></label><label class="karni-field">예산 · <span id="karni-currency">계정 통화</span><input name="budget" type="number" min="1" max="100000000" step="1" required><small>광고세트에 적용됩니다. 일 예산은 일별 지출 상한과 다를 수 있습니다.</small></label>
<label class="karni-field">시작 · 한국 시간<input name="start" type="datetime-local" required></label><label class="karni-field">종료 · 한국 시간<input name="end" type="datetime-local" required></label>
<label class="karni-field">국가 코드<input name="countries" value="KR" required><small>쉼표로 구분: KR, US, JP, GB, CA, AU, NZ, DE, FR, ES, IT, SG, HK, TW, TH, VN, ID, MY, PH</small></label>
<label class="karni-field">타겟 방식<select name="audienceMode"><option value="advantage">Advantage+ · 연령·성별을 추천 신호로 사용</option><option value="manual">수동 · 입력한 연령·성별 범위로 제한 요청</option></select></label>
<label class="karni-field">최소 연령<input name="ageMin" type="number" value="18" min="18" max="65" required></label><label class="karni-field">최대 연령 · 65는 65세 이상 포함<input name="ageMax" type="number" value="65" min="18" max="65" required></label>
<label class="karni-field">성별<select name="gender"><option value="all">전체</option><option value="male">남성</option><option value="female">여성</option></select></label><label class="karni-field">특별 광고 카테고리<select name="specialCategory"><option value="NONE">해당 없음</option><option value="SPECIAL">주택·고용·금융·정치 등 해당</option></select><small>특별 카테고리는 별도 설정이 필요하여 이 폼에서 게재를 제한합니다.</small></label>
<fieldset class="karni-wide"><legend>노출지면</legend><div class="karni-placements"><label><input type="checkbox" name="placements" value="auto" checked>Advantage+ 자동</label><label><input type="checkbox" name="placements" value="facebook_feed">Facebook 피드</label><label><input type="checkbox" name="placements" value="facebook_story">Facebook 스토리</label><label><input type="checkbox" name="placements" value="facebook_reels">Facebook 릴스</label><label><input type="checkbox" name="placements" value="instagram_feed">Instagram 피드</label><label><input type="checkbox" name="placements" value="instagram_story">Instagram 스토리</label><label><input type="checkbox" name="placements" value="instagram_reels">Instagram 릴스</label></div></fieldset>
<label class="karni-field karni-wide">광고 소재 이미지<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required><small>JPG·PNG·WebP, 2MB 이하. 선택한 노출지면에 맞는 비율의 이미지를 전달해 주세요.</small><img class="karni-image" id="karni-image" alt="전달할 광고 소재 미리보기" hidden></label>
<label class="karni-field karni-wide">광고 본문<textarea name="message" maxlength="2200" required></textarea></label><label class="karni-field">광고 제목<input name="headline" maxlength="255" required></label><label class="karni-field">연결 URL<input name="linkUrl" type="url" placeholder="https://" required></label>
<label class="karni-field">행동 유도 버튼<select name="cta"><option value="LEARN_MORE">더 알아보기</option><option value="SHOP_NOW">구매하기</option><option value="SIGN_UP">가입하기</option><option value="CONTACT_US">문의하기</option></select></label><label class="karni-field">Instagram 계정 ID · 선택<input name="instagramId" inputmode="numeric"><small>비워두면 Meta가 페이지에 연결된 Instagram 계정을 사용할 수 있습니다.</small></label>
<div class="karni-sales" id="karni-sales" hidden><label class="karni-field">픽셀 ID<input name="pixelId" inputmode="numeric"></label><label class="karni-field">전환 이벤트<select name="eventType"><option value="PURCHASE">구매</option><option value="LEAD">리드</option><option value="ADD_TO_CART">장바구니</option><option value="COMPLETE_REGISTRATION">등록 완료</option></select></label></div>
<div class="karni-wide karni-form-actions"><button class="pixel-button" id="karni-save" type="submit">소재 전달 · 최종 설정 확인</button><button class="pixel-button" id="karni-reset" type="button">작성 취소 · 폼 초기화</button><small>작성 중인 내용만 비웁니다. 접수 완료된 내역은 바뀌지 않습니다.</small></div></form>
<section class="karni-review" id="karni-review" hidden><h3>최종 광고 설정</h3><pre id="karni-review-text"></pre><label class="karni-check"><input id="karni-confirm" type="checkbox">위 계정·소재·타겟·예산·기간을 확인했습니다. 광고 게재를 누르면 실제 광고비가 발생할 수 있음에 동의합니다.</label><button class="pixel-button" id="karni-publish" type="button">광고 게재</button></section>
<div class="karni-history" id="karni-history"></div>`;
$k('#meta-report-anchor').before(panel);
const previewTopButton=document.createElement('button');previewTopButton.type='button';previewTopButton.className='pixel-button';previewTopButton.textContent='광고 미리보기';
previewTopButton.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('karni:preview',{detail:{id:selected?.id||null}})));
panel.querySelector('.karni-tools').append(previewTopButton);
const form=$k('#karni-form'), status=$k('#karni-status');
let selected=null, requestId=null, busy=false, imageUrl=null, accounts=[];
const field=name=>form.elements.namedItem(name);
function message(value,error=false){status.textContent=value;status.dataset.error=String(error);}
async function api(action,body,query={}) {
  const response=await fetch('/api/karni?'+new URLSearchParams({action,...query}),{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'content-type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(65000)});
  const r=await response.json(); if(!response.ok)throw new Error(r.error||'광고 작업 요청에 실패했습니다.'); return r;
}
function review(row) {
  selected=row; const b=row.brief;
  let previewSlot=$k('#karni-review-preview');
  if(!previewSlot){previewSlot=document.createElement('div');previewSlot.id='karni-review-preview';$k('#karni-review-text').after(previewSlot);}
  previewSlot.replaceChildren(makePreviewButton(row));
  $k('#karni-review').hidden=false;$k('#karni-confirm').checked=false;
  $k('#karni-review-text').textContent=`계정: ${b.accountName||b.accountId} · 페이지 ${b.pageId}\n캠페인: ${b.campaignName}\n광고세트: ${b.adsetName} · 광고: ${b.adName}\n목표: ${b.objective==='OUTCOME_SALES'?'웹사이트 전환':'웹사이트 링크 클릭'}\n${b.budgetType==='daily'?'일':'전체'} 예산: ${b.budget.toLocaleString()} ${b.currency}\n기간: ${new Date(b.start).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} ~ ${new Date(b.end).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}\n타겟: ${b.countries.join(', ')} · ${b.ageMin}~${b.ageMax}세 · ${b.gender}\n${b.audienceMode==='advantage'?'Advantage+ 사용 · 연령/성별은 추천 신호로 확장될 수 있습니다.':'수동 타겟 사용 · 입력 범위 제한 요청'}\n노출지면: ${b.placements.join(', ')}\n제목: ${b.headline}\n본문: ${b.message}\n연결: ${b.linkUrl}\n${b.pixelId?`픽셀: ${b.pixelId} · ${b.eventType}\n`:''}이미지 자동 개선: 사용 안 함 요청\nMeta 심사와 계정 상태에 따라 실제 송출이 시작됩니다.`;
  $k('#karni-review').scrollIntoView({block:'nearest'});
}
function makePreviewButton(row){
  const button=document.createElement('button');button.type='button';button.className='pixel-button';
  const ready=Boolean(row.checkpoint?.creativeId||row.checkpoint?.adId);
  button.textContent=ready?'지면별 미리보기':'미리보기 · 초안 생성 후';button.disabled=!ready;
  button.title=ready?'Meta 실제 광고 미리보기':'먼저 초안만 만들기를 눌러 소재를 생성해 주세요.';
  button.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('karni:preview',{detail:{id:row.id}})));
  return button;
}
async function loadAccounts(){const r=await api('setup');accounts=r.accounts;field('accountId').replaceChildren(new Option('계정을 선택하세요',''));for(const a of accounts.filter(a=>a.queryable))field('accountId').add(new Option(`${a.name} · ${a.currency}`,a.adAccountId));}
async function loadPages(){
  const accountId=field('accountId').value;if(!accountId){message('먼저 광고 계정을 선택해 주세요.',true);return;}
  const button=$k('#karni-refresh-pages'), previous=field('pageId').value;button.disabled=true;button.textContent='페이지 확인 중…';field('pageId').replaceChildren(new Option('Meta에서 페이지를 확인 중…',''));
  try{const r=await api('setup',null,{accountId});if(field('accountId').value!==accountId)return;field('pageId').replaceChildren(new Option('페이지를 선택하세요',''));for(const p of r.pages)field('pageId').add(new Option(p.page_name,p.page_id));if(r.pages.some(p=>String(p.page_id)===previous))field('pageId').value=previous;$k('#karni-currency').textContent=r.account.currency;message(r.pages.length?'Meta에서 페이지 목록을 다시 불러왔습니다. 이름 변경이 아직 보이지 않으면 Meta 페이지 권한/이름 반영 상태를 확인해 주세요.':'연결된 페이지가 없습니다. Meta 페이지 권한을 확인해 주세요.',!r.pages.length);}catch(e){message(e.message,true);}finally{button.disabled=false;button.textContent='페이지 목록 새로고침';}
}
field('accountId').addEventListener('change',loadPages);
$k('#karni-refresh-pages').addEventListener('click',loadPages);
field('objective').addEventListener('change',()=>{$k('#karni-sales').hidden=field('objective').value!=='OUTCOME_SALES';});
form.querySelectorAll('[name=placements]').forEach(input=>input.addEventListener('change',()=>{if(input.checked)form.querySelectorAll('[name=placements]').forEach(other=>{if(input.value==='auto'&&other!==input||input.value!=='auto'&&other.value==='auto')other.checked=false;});}));
field('image').addEventListener('change',()=>{if(imageUrl)URL.revokeObjectURL(imageUrl);const f=field('image').files[0];$k('#karni-image').hidden=!f;if(f){imageUrl=URL.createObjectURL(f);$k('#karni-image').src=imageUrl;}});
$k('#karni-new').addEventListener('click',async()=>{if(busy)return;form.hidden=false;message('연결된 Meta 계정을 불러오는 중입니다.');try{await loadAccounts();message('광고 설정을 입력해 주세요.');}catch(e){message(e.message,true);}});
$k('#karni-reset').addEventListener('click',()=>{
  if(busy)return;
  if(requestId){message('접수 저장 결과를 아직 확인하지 못해 비우지 않았습니다. 먼저 접수 내역을 새로고침해 주세요.',true);return;}
  form.reset();requestId=null;
  if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl=null;
  $k('#karni-image').removeAttribute('src');$k('#karni-image').hidden=true;
  field('pageId').replaceChildren(new Option('계정 선택 후 불러옵니다',''));
  $k('#karni-sales').hidden=true;form.hidden=true;
  message('작성 중인 광고 설정을 비웠습니다. 저장된 접수와 Meta 광고 객체는 변경하지 않았습니다.');
});
form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  const f=field('image').files[0];if(!f||f.size>2*1024*1024){message('2MB 이하 이미지를 선택해 주세요.',true);return;}
  busy=true;$k('#karni-save').disabled=true;message('소재와 설정을 저장하고 있습니다.');
  try{
    const image=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(f);});
    const b=Object.fromEntries(new FormData(form));delete b.image;b.placements=[...form.querySelectorAll('[name=placements]:checked')].map(i=>i.value);
    for(const k of ['start','end'])b[k]=new Date(b[k]+':00+09:00').toISOString();
    requestId ||= crypto.randomUUID();
    const r=await api('save',{id:requestId,brief:b,image});review(r.launch);requestId=null;message('소재를 접수했습니다. 아래 최종 설정을 확인해 주세요.');await history();
  }catch(e){message(e.message,true);}finally{busy=false;$k('#karni-save').disabled=false;}
});
const stageNames=['이미지 등록','캠페인 생성','광고세트 생성','광고 소재 생성','광고 생성','게재 요청'];
const prepareButton=document.createElement('button');
prepareButton.className='pixel-button';prepareButton.id='karni-prepare';prepareButton.type='button';prepareButton.textContent='초안만 만들기 · 미게재';
$k('#karni-publish').before(prepareButton,document.createTextNode(' '));
prepareButton.addEventListener('click',async()=>{
  if(busy||!selected)return;
  busy=true;prepareButton.disabled=true;$k('#karni-publish').disabled=true;$k('#karni-save').disabled=true;
  try{
    if(selected.checkpoint?.activationIndex||selected.state==='submitted')throw new Error('이미 게재 요청을 시작한 접수입니다. 상태를 확인해 주세요.');
    while(selected.step<5){message(`미게재 초안 준비 중 · ${stageNames[selected.step]}`);const r=await api('prepare',{id:selected.id});selected=r.launch;}
    $k('#karni-confirm').checked=false;
    review(selected);
    message('광고 초안을 준비했습니다. Meta에서 DRAFT 또는 PAUSED 상태로 보관하며, 게재·활성화 요청은 보내지 않았습니다. 광고 관리자에서 확인할 수 있습니다.');
    await history();
  }catch(e){message(e.message,true);await history().catch(()=>{});}
  finally{busy=false;prepareButton.disabled=false;$k('#karni-publish').disabled=false;$k('#karni-save').disabled=false;}
});
$k('#karni-publish').addEventListener('click',async()=>{
  if(busy||!selected)return;if(!$k('#karni-confirm').checked){message('최종 설정 확인에 동의해 주세요.',true);return;}
  busy=true;$k('#karni-publish').disabled=true;$k('#karni-save').disabled=true;
  try{
    while(selected.state!=='submitted') {message(`광고 작업 중 · ${stageNames[selected.step]||'게재 상태 확인'}\n창을 닫으면 접수 내역에서 이어서 진행할 수 있습니다.`);const r=await api('advance',{id:selected.id,confirm:true});selected=r.launch;}
    $k('#karni-review').hidden=true;message('Meta에 게재 요청을 제출했습니다. 심사·예약·계정 상태를 접수 내역에서 확인해 주세요.');await history();
  }catch(e){message(`${e.message}\n접수 내역을 새로고침해 처리 단계를 확인해 주세요.`,true);await history().catch(()=>{});}finally{busy=false;$k('#karni-publish').disabled=false;$k('#karni-save').disabled=false;}
});
async function history(){
 const r=await api('list');const host=$k('#karni-history');host.replaceChildren();
 if(!r.launches.length){const p=document.createElement('p');p.className='karni-note';p.textContent='아직 접수된 소재가 없습니다.';host.append(p);}
 for(const row of r.launches){const card=document.createElement('article');card.className='karni-entry';const h=document.createElement('h3');h.textContent=row.brief.campaignName;const p=document.createElement('p');const labels={uploading:'소재 저장 확인 필요',ready:'설정 확인 대기',working:'처리 결과 확인 중',paused:'광고 준비 중 · 이어서 진행 가능',submitted:'게재 요청 제출 · 심사/송출 상태 확인 필요',attention:'처리 결과 확인 필요',publishing:'게재 처리 중'};p.textContent=`${row.checkpoint?.cancelled?'접수 초기화 완료 · Meta에 생성된 객체는 일시중지 상태로 보존':labels[row.state]||row.state} · ${Math.min(row.step,6)}/6 단계\n${row.error||''}`;card.append(h,p);
 if(['ready','paused'].includes(row.state)&&!row.pending_operation&&!row.checkpoint?.cancelled){const button=document.createElement('button');button.className='pixel-button';button.textContent='설정 확인 · 이어서 진행';button.onclick=()=>{if(!busy)review(row);};card.append(button);}
 if(row.checkpoint.campaignId){const link=document.createElement('a');link.textContent='Meta 광고 관리자에서 확인';link.href=`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${encodeURIComponent(row.brief.accountId)}&selected_campaign_ids=${encodeURIComponent(row.checkpoint.campaignId)}`;link.target='_blank';link.rel='noopener noreferrer';card.append(link);}
 if(row.checkpoint.adId){const button=document.createElement('button');button.className='pixel-button';button.textContent='실제 상태 · 오늘 성과 조회';button.onclick=async()=>{button.disabled=true;try{const v=await api('verify',null,{id:row.id});const result=document.createElement('p');result.textContent=v.verified?v.entities.map(e=>`상태: ${e.effective_status||e.status||'미확인'} · 지출: ${e.amount_spent??'—'} ${row.brief.currency} · 노출: ${e.impressions??'—'} · 클릭: ${e.clicks??'—'}`).join('\n'):'아직 실제 광고를 조회하지 못했습니다. 초안·게시 오류·처리 상태를 광고 관리자에서 확인해 주세요.';card.append(result);}catch(e){message(e.message,true);}finally{button.disabled=false;}};card.append(button);}
 card.append(makePreviewButton(row));
 if(row.state==='attention'&&row.step===3&&row.pending_operation==='creative'){
   const cancel=document.createElement('button');cancel.type='button';cancel.className='pixel-button';cancel.textContent='실패 접수 초기화';
   cancel.onclick=async()=>{if(busy)return;if(!confirm('이 실패 접수를 취소할까요? 기록은 보관하고 다시 진행할 수 없게 표시합니다. Meta에 이미 만들어진 캠페인과 광고세트는 삭제하지 않고 일시중지 상태로 둡니다.'))return;busy=true;cancel.disabled=true;try{await api('cancel',{id:row.id});await history();message('실패 접수를 초기화했습니다. Meta에 생성된 캠페인과 광고세트는 일시중지 상태로 보존됩니다.');}catch(e){message(e.message,true);}finally{busy=false;cancel.disabled=false;}};card.append(cancel);
   const recover=document.createElement('button');recover.type='button';recover.className='pixel-button';recover.textContent='문제 해결 후 재확인';
   recover.onclick=async()=>{if(busy)return;recover.disabled=true;try{const result=await api('recover',{id:row.id});review(result.launch);await history();message('기존 Meta 소재를 확인했습니다. 캠페인과 광고세트는 유지합니다. 설정 확인 후 ‘초안만 만들기 · 미게재’로 이어서 진행해 주세요.');}catch(e){message(e.message,true);}finally{recover.disabled=false;}};card.append(recover);
 }
 for(const notice of row.checkpoint.notices||[]){const n=document.createElement('p');n.textContent=notice;card.append(n);}host.append(card);
 }
}
$k('#karni-reload').addEventListener('click',async()=>{try{await history();message('접수 내역을 새로고침했습니다.');}catch(e){message(e.message,true);}});
window.addEventListener('agent-office-auth',event=>{if(event.detail.signedIn)history().catch(e=>message(e.message,true));else{$k('#karni-history').replaceChildren();$k('#karni-review').hidden=true;selected=null;form.reset();if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl=null;$k('#karni-image').removeAttribute('src');$k('#karni-image').hidden=true;form.hidden=true;message('');}});
