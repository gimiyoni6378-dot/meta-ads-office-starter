// Actual Meta renders only. Preview never creates or activates advertisements.
(() => {
  const formats={INSTAGRAM_STANDARD:'Instagram 피드',INSTAGRAM_STORY:'Instagram 스토리',INSTAGRAM_REELS:'Instagram 릴스',MOBILE_FEED_STANDARD:'Facebook 모바일 피드',DESKTOP_FEED_STANDARD:'Facebook PC 피드',FACEBOOK_REELS_MOBILE:'Facebook 릴스',RIGHT_COLUMN_STANDARD:'Facebook 오른쪽 열'};
  const dialog=document.createElement('dialog');dialog.className='karni-preview-dialog';dialog.setAttribute('aria-labelledby','karni-preview-title');
  dialog.innerHTML=`<header class="karni-preview-head"><div><span class="mono">META AD PREVIEW</span><h2 id="karni-preview-title">광고 미리보기</h2></div><button type="button" class="modal-close" aria-label="광고 미리보기 닫기">닫기 ×</button></header><p class="karni-note">Meta가 생성한 실제 미리보기입니다. 선택한 지면의 소재·문구 배치를 확인하세요. 미리보기 조회로 광고가 게재되지는 않습니다.</p><label class="karni-preview-label">미리보기 지면<select id="karni-preview-format"></select></label><p class="karni-preview-state" role="status" aria-live="polite"></p><div class="karni-preview-render"></div><p class="karni-preview-notices"></p><footer class="karni-preview-foot"><a class="karni-preview-link" target="_blank" rel="noopener noreferrer" hidden>Meta 미리보기 새 창으로 열기 ↗</a><button class="pixel-button" type="button" id="karni-preview-reload">다시 불러오기</button></footer><p class="karni-note">모달에서 표시되지 않거나 Meta 로그인이 필요하면 새 창으로 열어 확인하세요. 지면별 지원 여부와 실제 게재 모습은 Meta 설정·기기에 따라 달라질 수 있습니다.</p>`;
  document.body.append(dialog);
  const select=dialog.querySelector('select'),status=dialog.querySelector('[role=status]'),render=dialog.querySelector('.karni-preview-render'),notices=dialog.querySelector('.karni-preview-notices'),link=dialog.querySelector('a'),reload=dialog.querySelector('#karni-preview-reload');
  for(const [value,label]of Object.entries(formats))select.add(new Option(label,value));
  let launchId=null,trigger=null,request=0,controller=null;
  const reset=()=>{render.replaceChildren();notices.textContent='';link.hidden=true;link.removeAttribute('href');};
  async function load(){
    const sequence=++request;controller?.abort();const activeController=new AbortController();controller=activeController;
    reset();status.textContent='Meta에서 미리보기를 불러오고 있습니다…';render.setAttribute('aria-busy','true');reload.disabled=true;
    const timeout=setTimeout(()=>activeController.abort(),55000);
    try{
      const response=await fetch('/api/karni?'+new URLSearchParams({action:'preview',id:launchId,format:select.value}),{credentials:'same-origin',cache:'no-store',signal:activeController.signal});
      const data=await response.json();if(sequence!==request||!dialog.open)return;
      if(!response.ok)throw new Error(data.error||'미리보기를 불러오지 못했습니다.');
      const u=new URL(data.url);
      if(u.protocol!=='https:'||!['facebook.com','instagram.com','meta.com'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))throw new Error('Meta 미리보기 주소를 확인하지 못했습니다.');
      const iframe=document.createElement('iframe');iframe.title=data.label+' 광고 미리보기';iframe.src=data.url;iframe.referrerPolicy='no-referrer';
      iframe.setAttribute('sandbox','allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
      iframe.setAttribute('allow','autoplay; fullscreen');render.append(iframe);
      status.textContent=data.label+' · Meta 미리보기';link.href=data.url;link.hidden=false;
      notices.textContent=(data.notices||[]).join('\n');
    }catch(error){if(sequence===request&&dialog.open)status.textContent=error.name==='AbortError'?'미리보기 응답이 지연되고 있습니다. 다시 불러오거나 다른 지면을 선택해 주세요.':error.message;}
    finally{clearTimeout(timeout);if(sequence===request){render.setAttribute('aria-busy','false');reload.disabled=false;}}
  }
  document.addEventListener('karni:preview',event=>{
    launchId=event.detail?.id||null;
    trigger=document.activeElement;select.value='INSTAGRAM_STANDARD';select.disabled=!launchId;
    if(!dialog.open)dialog.showModal();
    if(launchId)load();
    else{++request;controller?.abort();reset();reload.disabled=true;status.textContent='아직 미리볼 광고 초안이 없습니다. 소재와 설정을 저장하고 ‘초안만 만들기 · 미게재’를 누른 뒤, 해당 접수 내역의 ‘지면별 미리보기’를 선택해 주세요.';}
  });
  select.addEventListener('change',load);reload.addEventListener('click',load);
  dialog.querySelector('.modal-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{const r=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))dialog.close();});
  dialog.addEventListener('close',()=>{++request;controller?.abort();reset();trigger?.focus();});
  window.addEventListener('agent-office-auth',event=>{if(!event.detail.signedIn){if(dialog.open)dialog.close();launchId=null;reset();}});
})();
