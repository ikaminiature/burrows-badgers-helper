import { skills } from "./skills.js";
import {equipmentReference,commonEquipmentRules,equipmentTables,magicEffect,magicEffects,equipmentReferenceNotes} from './equipment-rules.js';
import {equipmentDisplayName} from './equipment.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pages=p=>`<p class="muted reference-pages">参照：${p.map(n=>'p.'+n).join('、')}</p>`;
export function referenceTable(id) {
 const t=equipmentTables[id]; if(!t)return '';
 return `<section class="equipment-reference-table"><h4>${esc(t.name)}</h4><div class="reference-table-scroll" tabindex="0" aria-label="${esc(t.name)}"><table><thead><tr>${t.headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(row=>`<tr>${row.map((v,i)=>i===0?`<th scope="row">${esc(v)}</th>`:`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${pages(t.pages)}</section>`;
}
// Display labels only: effect/condition text and persisted data stay unchanged.
const performanceLabels = {
  'general-store-002': {strong:'Strong (3)／ストロング（3）'},
  'general-store-003': {strong:'Strong (1)／ストロング（1）'},
  'general-store-005': {strong:'Strong (1)／ストロング（1）'},
  'general-store-007': {strong:'Strong (2)／ストロング（2）'},
  'general-store-010': {strong:'Strong (1)／ストロング（1）'},
  'general-store-012': {strong:'使用条件：Strong (2)／ストロング（2）'},
  'general-store-013': {strong:'Strong (4)／ストロング（4）'},
  'general-store-015': {strong:'Strong (3)／ストロング（3）'},
  'general-store-017': {strong:'Strong (2)／ストロング（2）（魔法使い・不気味に対して）'},
  'general-store-018': {tough:'Tough (1)／タフ（1）'},
  'general-store-019': {tough:'Tough (2)／タフ（2）'},
  'general-store-022': {tough:'Tough (1)／タフ（1）'},
  'general-store-023': {tough:'Tough (4)／タフ（4）'},
  'general-store-032': {strong:'Strong (1)／ストロング（1）'},
  'general-store-034': {strong:'Strong (1)／ストロング（1）'},
  'general-store-035': {strong:'Strong (1)／ストロング（1）'},
  'general-store-036': {strong:'Strong (1)／ストロング（1）'},
  'general-store-093': {strong:'Strong (2)／ストロング（2）'},
  'general-store-095': {strong:'Strong (1)／ストロング（1）'},
};
export function ruleReference(id, labels={}) {
 if(id === "slots") return "";
 const r=commonEquipmentRules[id]; if(!r)return '';
 const label=labels[id] || ({strong:"ストロングの共通ルール",tough:"タフの共通ルール"}[id]) || r.name;
 return `<details class="equipment-shared-rule"><summary>${esc(label)}</summary><p class="detail-text">${esc(r.text)}</p>${r.sourceNote?`<p class="muted">${esc(r.sourceNote)}</p>`:''}${(r.tableIds||[]).map(referenceTable).join('')}${pages(r.pages)}</details>`;
}
function referenceBody(r, nested=false, labels={}) {
 return `${r.description?`<h4>効果説明</h4><p class="detail-text">${esc(r.description)}</p>`:''}${r.conditions?`<h4>使用条件・制限</h4><p class="detail-text">${esc(r.conditions)}</p>`:''}${(r.ruleIds||[]).map(id=>ruleReference(id,labels)).join('')}${(r.tableIds||[]).map(referenceTable).join('')}${(r.skillIds||[]).map(id=>{const skill=skills.find(s=>s.id===id);return skill?`<details><summary>関連スキル：${esc(labels[skill.id.replace("skill-", "")] || (skill.nameJa+" / "+skill.nameEn))}</summary><p class="detail-text">使用条件：${esc(skill.conditions)}</p><p class="detail-text">${esc(skill.description)}</p>${pages([skill.page])}</details>`:'';}).join('')}${!nested&&r.baseEquipmentId?`<details><summary>基本装備のルール（固有説明とあわせて参照）</summary>${referenceBody(equipmentReference(r.baseEquipmentId),true,performanceLabels[r.baseEquipmentId])}</details>`:''}${(r.relatedEquipmentIds||[]).map(id=>`<details><summary>関連する毒：${esc({'general-store-052':'麻痺毒','general-store-053':'激痛毒','general-store-054':'致死毒'}[id]||id)}</summary>${referenceBody(equipmentReference(id),true,performanceLabels[id])}</details>`).join('')}${pages(r.pages)}`;
}
export function equipmentDetails(item) {
 const r=equipmentReference(item.id);
 return `<details class="equipment-details" data-reference-id="${esc(item.id)}"><summary><span>${esc(equipmentDisplayName(item))}</span><span class="equipment-english">${esc(item.nameEn)}</span></summary><div class="equipment-description">${r?referenceBody(r,false,performanceLabels[item.id]):'<p>提供資料に対応する効果説明は未登録です。</p>'}</div></details>`;
}
export function magicDetails(value) {
 if(!value||(!value.effects.length&&!value.notes))return '';
 return `<details class="equipment-magic-details"><summary>登録した魔法効果</summary>${value.effects.map(v=>{
 const effect=magicEffect(v.id);
 return `<details><summary>${esc(effect?effect.nameJa+' / '+effect.nameEn:v.id)}${v.bonus!==null?' +'+esc(v.bonus):''}</summary>${effect?`<p class="detail-text">${esc(effect.description)}</p>${effect.ruleIds.map(id=>ruleReference(id, v.bonus !== null && id === "tough" ? {tough:`Tough (${v.bonus})／タフ（${v.bonus}）`} : {})).join('')}${pages(effect.pages)}`:'<p>カタログにない効果IDを保持しています。</p>'}</details>`;
 }).join('')}${value.notes?`<h4>登録した補足</h4><p class="detail-text">${esc(value.notes)}</p>`:''}</details>`;
}
export function magicReferenceLibrary() {
 return `<details class="magic-reference-library"><summary>魔法装備の共通ルール・各表</summary>${ruleReference('magic')}${ruleReference('enchanting')}<details><summary>魔法装備効果の説明（14種類）</summary>${magicEffects.map(effect=>`<details><summary>${esc(effect.nameJa)} / ${esc(effect.nameEn)}</summary><p class="detail-text">${esc(effect.description)}</p>${effect.ruleIds.map(id=>ruleReference(id)).join('')}${pages(effect.pages)}</details>`).join('')}</details><details><summary>資料の表記差</summary>${equipmentReferenceNotes.map(n=>`<p>${esc(n)}</p>`).join('')}</details></details>`;
}
