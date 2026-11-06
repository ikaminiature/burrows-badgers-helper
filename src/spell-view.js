import { matchSpell, spellArchetypes, archetypeConditions } from './spells.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function spellDetails(text,selection) {
 const s=matchSpell(text,selection);
 if(!s) return `<details class="spell-details"><summary>${esc(text)||'（未入力）'}</summary><p class="detail-text">未確認（自由入力）。原文を保持しています。</p></details>`;
 const a=spellArchetypes.find(a=>a.id===s.archetype);
 const field=(label,value)=>`<div><dt>${label}</dt><dd class="detail-text">${esc(value)}</dd></div>`;
 return `<details class="spell-details"><summary><span>${esc(s.nameJa)}</span><span class="spell-english" lang="en">${esc(s.nameEn)}</span></summary><dl class="spell-fields">${field('魔術アーキタイプ',a.nameJa+' / '+a.nameEn)}${s.element?field('専門分野',s.element):''}${field('難易度',s.difficulty)}${field('射程',s.range)}${s.description?field('効果',s.description):''}${s.shallow?field('浅い働き',s.shallow):''}${s.deep?field('深い働き',s.deep):''}${field('素材と使用時の効果',s.materials.length?s.materials.map(m=>m.name+'：'+m.effect).join('\n'):'なし')}${field('運命点',s.fate?s.fate.condition+'\n'+s.fate.effect:'追加効果の記載なし')}${field('その他の条件',archetypeConditions(s))}${field('資料',`日本語訳 第2版 ${s.page}ページ`)}</dl></details>`;
}
