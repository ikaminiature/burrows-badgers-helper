// A single owner for every native dialog, including overlapping/replaced dialogs.
export function canScrollAxis(position, viewport, extent, delta) {
  return extent>viewport+1 && (delta<0 ? position>1 : delta>0 && position+viewport<extent-1);
}
export function createOverlayScrollManager(doc, win) {
  const active=new Set(),bound=new WeakSet();let saved=null,touch=null;
  const bodyProps=['position','top','left','width','overflow','padding-right'];
  const rootProps=['overflow','overscroll-behavior','scroll-behavior'];
  const capture=(node,props)=>props.map(p=>[p,node.style.getPropertyValue(p),node.style.getPropertyPriority(p)]);
  const restore=(node,props)=>{for(const [p,value,priority] of props)value?node.style.setProperty(p,value,priority):node.style.removeProperty(p);};
  function lock(){
    if(saved)return;
    const body=doc.body,root=doc.documentElement;
    const gap=Math.max(0,win.innerWidth-root.clientWidth),padding=parseFloat(win.getComputedStyle(body).paddingRight)||0;
    saved={x:win.scrollX,y:win.scrollY,body:capture(body,bodyProps),root:capture(root,rootProps)};
    root.style.setProperty('overflow','hidden');root.style.setProperty('overscroll-behavior','none');root.style.setProperty('scroll-behavior','auto');
    body.style.setProperty('position','fixed');body.style.setProperty('top',-saved.y+'px');body.style.setProperty('left',-saved.x+'px');body.style.setProperty('width','100%');body.style.setProperty('overflow','hidden');body.style.setProperty('padding-right',padding+gap+'px');
    root.classList.add('overlay-scroll-locked');
  }
  function unlock(){
    if(!saved)return;const previous=saved;saved=null;touch=null;
    restore(doc.body,previous.body);restore(doc.documentElement,previous.root);doc.documentElement.classList.remove('overlay-scroll-locked');
    win.scrollTo({left:previous.x,top:previous.y,behavior:'instant'});
  }
  function release(dialog){if(dialog.isConnected&&dialog.open)return;active.delete(dialog);if(!active.size)unlock();}
  function acquire(dialog){if(active.has(dialog))return;lock();active.add(dialog);if(!bound.has(dialog)){bound.add(dialog);dialog.addEventListener('close',()=>release(dialog));}}
  function reconcile(){
    for(const dialog of doc.querySelectorAll('dialog[open]'))acquire(dialog);
    for(const dialog of active)if(!dialog.isConnected||!dialog.open)active.delete(dialog);
    if(!active.size)unlock();
  }
  function open(dialog){
    if(!dialog.open)active.delete(dialog); // A rapid reopen becomes the topmost dialog again.
    acquire(dialog);
    try{if(!dialog.open)dialog.showModal();}
    catch(error){release(dialog);throw error;}
  }
  function closeAll(){for(const dialog of doc.querySelectorAll('dialog[open]'))dialog.close();reconcile();}
  function topDialog(){return [...active].reverse().find(d=>d.isConnected&&d.open);}
  function allowed(target,dx,dy){
    const dialog=topDialog();if(!dialog||!dialog.contains(target))return false;
    const horizontal=Math.abs(dx)>Math.abs(dy),delta=horizontal?dx:dy;
    // Let native text selection/cursor gestures work; the fixed body stays locked.
    if(horizontal&&target.closest('input,textarea,[contenteditable="true"]'))return true;
    for(let node=target;node&&dialog.contains(node);node=node.parentElement){
      const style=win.getComputedStyle(node),overflow=horizontal?style.overflowX:style.overflowY;
      if(/auto|scroll/.test(overflow)&&canScrollAxis(horizontal?node.scrollLeft:node.scrollTop,horizontal?node.clientWidth:node.clientHeight,horizontal?node.scrollWidth:node.scrollHeight,delta))return true;
    }
    return false;
  }
  doc.addEventListener('touchstart',e=>{touch=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;},{passive:true});
  doc.addEventListener('touchmove',e=>{
    if(!active.size||!touch||e.touches.length!==1)return;
    const t=e.touches[0],dx=touch.x-t.clientX,dy=touch.y-t.clientY;touch={x:t.clientX,y:t.clientY};
    if((dx||dy)&&!allowed(e.target,dx,dy)&&e.cancelable)e.preventDefault();
  },{passive:false});
  doc.addEventListener('touchend',()=>{touch=null;},{passive:true});
  doc.addEventListener('touchcancel',()=>{touch=null;},{passive:true});
  doc.addEventListener('wheel',e=>{if(!e.ctrlKey&&active.size&&!allowed(e.target,e.deltaX,e.deltaY)&&e.cancelable)e.preventDefault();},{passive:false});
  const observer=new win.MutationObserver(reconcile);observer.observe(doc.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
  return {open,closeAll};
}
let manager;
const current=()=>manager??=createOverlayScrollManager(document,window);
export const openDialog=dialog=>current().open(dialog);
export const closeAllDialogs=()=>current().closeAll();
