import { openDialog } from "./overlay-scroll.js";
export function horizontalSwipe(dx,dy,direction){
 return dx*direction>=60 && Math.abs(dx)>Math.abs(dy)*1.8;
}
const interactive='button,input,select,textarea,a,summary,label,[contenteditable="true"]';
export function createCharacterPanel({getCharacter,renderContent}){
 const dialog=document.createElement('dialog');dialog.id='character-panel';dialog.className='character-panel';dialog.setAttribute('aria-label','キャラクター詳細');document.body.append(dialog);
 let origin=null,gesture=null;
 function close(){if(dialog.open)dialog.close();}
 function open(source,id){
  if(document.querySelector('#modal[open]'))return;
  const c=getCharacter(source,id);if(!c)return;
  const character=structuredClone(c);
  if(!dialog.open)origin=document.activeElement;
  dialog.innerHTML='<header class="panel-header"><h2 tabindex="-1" autofocus></h2><button type="button" data-panel-close>閉じる</button></header><div class="panel-tabs" role="tablist" aria-label="詳細の種類"></div><div class="panel-scroll character-extra"></div>';
  dialog.querySelector('h2').textContent=character.name;
  const tabs=[['equipment','装備'],['skills','スキル'],['spells','呪文']];
  dialog.querySelector('.panel-tabs').innerHTML=tabs.map(([id,name],i)=>`<button type="button" role="tab" data-panel-tab="${id}" id="panel-tab-${id}" aria-controls="panel-content-${id}" aria-selected="${i===0}" tabindex="${i===0?0:-1}">${name}</button>`).join('');
  dialog.querySelector('.panel-scroll').innerHTML=renderContent(character,'equipment');
  for(const section of dialog.querySelectorAll('[data-extra-category]')){section.id='panel-content-'+section.dataset.extraCategory;section.setAttribute('role','tabpanel');section.setAttribute('aria-labelledby','panel-tab-'+section.dataset.extraCategory);}
  openDialog(dialog);
  dialog.querySelector('h2').focus({preventScroll:true});
 }
 function tab(id,focus=false){
  for(const b of dialog.querySelectorAll('[data-panel-tab]')){const selected=b.dataset.panelTab===id;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;if(selected&&focus)b.focus({preventScroll:true});}
  for(const s of dialog.querySelectorAll('[data-extra-category]'))s.hidden=s.dataset.extraCategory!==id;
  dialog.querySelector('.panel-scroll').scrollTop=0;
 }
 dialog.addEventListener('click',e=>{if(e.target.closest('[data-panel-close]'))close();const b=e.target.closest('[data-panel-tab]');if(b)tab(b.dataset.panelTab);if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
 dialog.addEventListener('keydown',e=>{if(!e.target.matches('[data-panel-tab]'))return;const ids=['equipment','skills','spells'],i=ids.indexOf(e.target.dataset.panelTab);let n;if(e.key==='ArrowRight')n=(i+1)%3;if(e.key==='ArrowLeft')n=(i+2)%3;if(e.key==='Home')n=0;if(e.key==='End')n=2;if(n!==undefined){e.preventDefault();tab(ids[n],true);}});
 dialog.addEventListener('close',()=>{if(dialog.open)return;gesture=null;if(origin?.isConnected)origin.focus?.({preventScroll:true});origin=null;dialog.innerHTML='';});
 document.addEventListener('pointerdown',e=>{
  gesture=null;if(e.pointerType!=='touch'||!e.isPrimary||e.target.closest(interactive))return;
  if(dialog.open){if(dialog.contains(e.target))gesture={pointer:e.pointerId,x:e.clientX,y:e.clientY,close:true};return;}
  if(document.querySelector('#modal[open]'))return;
  const card=e.target.closest('.roster-card[data-character-id][data-panel-source]');
  if(!card)return;const r=card.getBoundingClientRect();
  if(e.clientX-r.left<0||e.clientX-r.left>32)return;
  gesture={pointer:e.pointerId,x:e.clientX,y:e.clientY,source:card.dataset.panelSource,id:card.dataset.characterId};
 });
 document.addEventListener('pointermove',e=>{if(!gesture||e.pointerId!==gesture.pointer)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){gesture=null;return;}if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.8&&e.cancelable)e.preventDefault();},{passive:false});
 document.addEventListener('pointerup',e=>{const g=gesture;gesture=null;if(!g||g.pointer!==e.pointerId)return;if(horizontalSwipe(e.clientX-g.x,e.clientY-g.y,g.close?-1:1)){if(g.close)close();else open(g.source,g.id);}});
 document.addEventListener('pointercancel',()=>{gesture=null;});
 window.addEventListener('hashchange',()=>{gesture=null;close();});
 return {open,close};
}
