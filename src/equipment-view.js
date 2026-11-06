import { skills } from "./skills.js";
import {equipmentReference,commonEquipmentRules,equipmentTables,magicEffect,magicEffects,equipmentReferenceNotes} from './equipment-rules.js';
import {equipmentDisplayName} from './equipment.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pages=p=>`<p class="muted reference-pages">参照：${p.map(n=>'p.'+n).join('、')}</p>`;
export function referenceTable(id) {
 const t=equipmentTables[id]; if(!t)return '';
 return `<section class="equipment-reference-table"><h4>${esc(t.name)}</h4><div class="reference-table-scroll" tabindex="0" aria-label="${esc(t.name)}"><table><thead><tr>${t.headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(row=>`<tr>${row.map((v,i)=>i===0?`<th scope="row">${esc(v)}</th>`:`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${pages(t.pages)}</section>`;
}
export function ruleReference(id) {
 const r=commonEquipmentRules[id]; if(!r)return '';
 return `<details class="equipment-shared-rule"><summary>${esc(r.name)}</summary><p class="detail-text">${esc(r.text)}</p>${r.sourceNote?`<p class="muted">${esc(r.sourceNote)}</p>`:''}${(r.tableIds||[]).map(referenceTable).join('')}${pages(r.pages)}</details>`;
}
function referenceBody(r, nested=false) {
 return `${r.description?`<h4>効果説明</h4><p class="detail-text">${esc(r.description)}</p>`:''}${r.conditions?`<h4>使用条件・制限</h4><p class="detail-text">${esc(r.conditions)}</p>`:''}${(r.ruleIds||[]).map(ruleReference).join('')}${(r.tableIds||[]).map(referenceTable).join('')}${(r.skillIds||[]).map(id=>{const skill=skills.find(s=>s.id===id);return skill?`<details><summary>関連スキル：${esc(skill.nameJa)} / ${esc(skill.nameEn)}</summary><p class="detail-text">使用条件：${esc(skill.conditions)}</p><p class="detail-text">${esc(skill.description)}</p>${pages([skill.page])}</details>`:'';}).join('')}${!nested&&r.baseEquipmentId?`<details><summary>基本装備のルール（固有説明とあわせて参照）</summary>${referenceBody(equipmentReference(r.baseEquipmentId),true)}</details>`:''}${(r.relatedEquipmentIds||[]).map(id=>`<details><summary>関連する毒：${esc({'general-store-052':'麻痺毒','general-store-053':'激痛毒','general-store-054':'致死毒'}[id]||id)}</summary>${referenceBody(equipmentReference(id),true)}</details>`).join('')}${pages(r.pages)}`;
}
export function equipmentDetails(item) {
 const r=equipmentReference(item.id);
 return `<details class="equipment-details" data-reference-id="${esc(item.id)}"><summary><span>${esc(equipmentDisplayName(item))}</span><span class="equipment-english">${esc(item.nameEn)}</span></summary><div class="equipment-description">${r?referenceBody(r):'<p>提供資料に対応する効果説明は未登録です。</p>'}</div></details>`;
}
export function magicDetails(value) {
 if(!value||(!value.effects.length&&!value.notes))return '';
 return `<details class="equipment-magic-details"><summary>登録した魔法効果</summary>${value.effects.map(v=>{
 const effect=magicEffect(v.id);
 return `<details><summary>${esc(effect?effect.nameJa+' / '+effect.nameEn:v.id)}${v.bonus!==null?' +'+esc(v.bonus):''}</summary>${effect?`<p class="detail-text">${esc(effect.description)}</p>${effect.ruleIds.map(ruleReference).join('')}${pages(effect.pages)}`:'<p>カタログにない効果IDを保持しています。</p>'}</details>`;
 }).join('')}${value.notes?`<h4>登録した補足</h4><p class="detail-text">${esc(value.notes)}</p>`:''}</details>`;
}
export function magicReferenceLibrary() {
 return `<details class="magic-reference-library"><summary>魔法装備の共通ルール・各表</summary>${ruleReference('magic')}${ruleReference('enchanting')}<details><summary>魔法装備効果の説明（14種類）</summary>${magicEffects.map(effect=>`<details><summary>${esc(effect.nameJa)} / ${esc(effect.nameEn)}</summary><p class="detail-text">${esc(effect.description)}</p>${effect.ruleIds.map(ruleReference).join('')}${pages(effect.pages)}</details>`).join('')}</details><details><summary>資料の表記差</summary>${equipmentReferenceNotes.map(n=>`<p>${esc(n)}</p>`).join('')}</details></details>`;
}
