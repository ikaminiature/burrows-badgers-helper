import {sideQuests,questById,questRange} from './side-quests.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function questBody(q){
 return `<p class="detail-text">${esc(q.text)}</p>${q.table?`<div class="quest-table-scroll" tabindex="0" aria-label="${esc(q.table.name)}"><table><caption>${esc(q.table.name)}</caption><thead><tr>${q.table.headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${q.table.rows.map(([roll,result])=>`<tr><th scope="row">${esc(roll)}</th><td>${esc(result)}</td></tr>`).join('')}</tbody></table></div><p class="detail-text">${esc(q.table.after)}</p>`:''}<small>日本語訳 第2版 ${q.page}ページ（一覧：246ページ）</small>`;
}
export function questSlotHtml(g,index){
 const selected=g.sideQuestSelections?.[index],q=questById(selected?.id),wild=q?.id==='wild-card';
 const choice=wild?questById(selected.wildCardChoice):null;
 const options=(items,value)=>`<option value="">未選択</option>${items.map(v=>`<option value="${v.id}" ${v.id===value?'selected':''}>${questRange(v)} ${esc(v.nameJa)} / ${esc(v.nameEn)}</option>`).join('')}`;
 return `<div class="quest-slot" data-quest-slot-panel="${index}"><label>サイドクエスト${index+1}<select data-quest-slot="${index}">${selected&&!q?`<option value="${esc(selected.id)}" selected>未確認（保存済み：${esc(selected.id)}）</option>`:''}${options(sideQuests,selected?.id)}</select></label>${wild?`<label>サイドクエスト${index+1}のワイルドカード選択<select data-wild-quest-slot="${index}">${selected.wildCardChoice&&!choice?`<option value="${esc(selected.wildCardChoice)}" selected>未確認（保存済み：${esc(selected.wildCardChoice)}）</option>`:''}${options(sideQuests.filter(v=>v.id!=='wild-card'),selected.wildCardChoice)}</select></label>`:''}${q?`<details class="quest-details"><summary>${esc(q.nameJa)}${choice?'：'+esc(choice.nameJa):''}<span lang="en" class="quest-english">${esc(q.nameEn)}${choice?' / '+esc(choice.nameEn):''}</span></summary><p class="muted">D100：${questRange(q)}</p>${questBody(q)}${choice?`<h4>${esc(choice.nameJa)} / ${esc(choice.nameEn)}</h4>${questBody(choice)}`:''}</details>`:selected?'<p class="muted">未確認のクエストIDを保持しています。ルールは表示できません。</p>':''}${g.sideQuests?.[index]?`<details class="legacy-quest"><summary>旧サイドクエスト${index+1}の原文（保持）</summary><p class="detail-text">${esc(g.sideQuests[index])}</p></details>`:''}</div>`;
}
export function selectQuest(g,index,id){
 if(![0,1].includes(index)||id&&!questById(id))throw Error('クエスト選択が不正です');
 g.sideQuestSelections ||= [null,null];
 g.sideQuestSelections[index]=id?{id,wildCardChoice:null}:null;
}
export function selectWildQuest(g,index,id){
 if(![0,1].includes(index)||g.sideQuestSelections?.[index]?.id!=='wild-card'||id&&(!questById(id)||id==='wild-card'))throw Error('ワイルドカード選択が不正です');
 g.sideQuestSelections[index].wildCardChoice=id||null;
}
