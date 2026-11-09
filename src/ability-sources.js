import { characterInventory, equipmentCategories } from './model.js';
import { matchSkill } from './skills.js';
import { normalizeEquipmentSearch } from './equipment.js';
import { specialMagicItems, equipmentAbilityGrants } from './equipment-rules.js';
export const sourceAbilities = {strong:'ストロング',tough:'タフ',weak:'ウィーク',delicate:'デリケート'};
export function deriveAbilitySources(character={}, catalog=[]) {
 const inventory=characterInventory(character);
 const result=Object.fromEntries(Object.keys(sourceAbilities).map(id=>[id,{skill:[],equipment:[]}]));
 inventory.skillEntries.forEach((text,index)=>{
  const match=matchSkill(text,character.skillSelections?.[index]);
  const ability=match?.skill.id.replace('skill-','');
  if(result[ability]&&Number.isSafeInteger(match.value)) result[ability].skill.push({name:text,value:match.value,condition:''});
 });
 const all=[...catalog,...specialMagicItems];
 for(const [slot,label] of Object.entries(equipmentCategories)) {
  const name=inventory.equipmentSlots[slot]; if(!name.trim())continue;
  const selected=character.equipmentSelections?.[slot];
  let item=selected?.nameJa===name?selected:null;
  if(!item) {
   const matches=all.filter(i=>[i.nameJa,i.nameEn].some(n=>normalizeEquipmentSearch(n)===normalizeEquipmentSearch(name)));
   if(matches.length===1)item=matches[0];
  }
  const grant=equipmentAbilityGrants[item?.id];
  if(grant) {
   const [ability,value,condition]=grant;
   result[ability].equipment.push({name:label+'：'+name,value,condition});
  }
  if(item?.id==='special-magic-selnab-necklace') for(const ability of ['strong','delicate'])
   result[ability].equipment.push({name:label+'：'+name,value:null,condition:'アクション宣言時のd6で変動するため固定値は表示しません'});
  // Only Protection explicitly grants Tough. Smiting/Wounding and other
  // bonuses are not converted into Strong or any other different ability.
  for(const effect of character.equipmentMagic?.[slot]?.effects||[]) {
   if(effect.id==='magic-effect-protection'&&Number.isSafeInteger(effect.bonus)&&effect.bonus>=0)
    result.tough.equipment.push({name:label+'：'+name+'（魔法効果：保護）',value:effect.bonus,condition:''});
  }
 }
 return result;
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function sourceLabel(entries,empty="—") {
 const values=[...new Set(entries.map(e=>e.value).filter(Number.isSafeInteger))];
 if(!values.length)return empty;
 if(values.length>1)return '複数';
 const value=String(values[0]);
 return value.length>3?'詳細':value+(entries.some(e=>e.condition)?'※':'');
}
export function abilitySourcesHtml(result) {
 return Object.entries(sourceAbilities).map(([id,label])=>`<details class="ability-source" data-ability="${id}"><summary><span class="ability-name">${label}</span><span class="ability-source-values"><span>${["strong","tough"].includes(id)?"技 ":""}${sourceLabel(result[id].skill,["strong","tough"].includes(id)?"—":"")}</span>${["strong","tough"].includes(id)?`<span>装 ${sourceLabel(result[id].equipment)}</span>`:""}</span></summary><div class="ability-source-breakdown"><p>${label}の内訳（合算しません。※は条件付き）</p>${([['skill',['strong','tough'].includes(id)?'技：スキル':'スキル'],...(['strong','tough'].includes(id)?[['equipment','装：装備']]:[])]).map(([key,name])=>`<strong>${name}</strong><ul>${result[id][key].map(e=>`<li>${esc(e.name)}：${e.value===null?'固定値なし':esc(e.value)}${e.condition?'／'+esc(e.condition):''}</li>`).join('')||'<li>取得できる数値なし</li>'}</ul>`).join('')}</div></details>`).join('');
}
