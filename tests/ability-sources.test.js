import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deriveAbilitySources,abilitySourcesHtml} from '../src/ability-sources.js';
import {parseEquipmentCatalog,searchEquipment} from '../src/equipment.js';
import {specialMagicItems} from '../src/equipment-rules.js';
import {emptyBandStatus,startGame,loadData,stats} from '../src/model.js';
const catalog=parseEquipmentCatalog(JSON.parse(readFileSync('data/bb2_general_store_ja_en.json')));
const base=()=>({id:'c',name:'保持',species:'任意',level:6,fate:2,experience:3,photo:'',stats:Object.fromEntries(stats.map(s=>[s,'D10'])),equipment:'旧装備原文',skills:'',spells:'呪文',notes:'メモ'});
const equip=(c,slot,n)=>{const item=typeof n==='number'?catalog[n-1]:specialMagicItems.find(i=>i.id===n);c.equipmentSlots||={weapon1:'',weapon2:'',armour1:'',armour2:'',item:'',special:''};c.equipmentSlots[slot]=item.nameJa;(c.equipmentSelections||={})[slot]=structuredClone(item);};
test('全6枠のカテゴリ固定は日英・最近順・魔法装備にも適用、スペシャルのみカテゴリ自由',()=>{
 const allowed={weapon1:['weapon'],weapon2:['weapon'],armour1:['armour'],armour2:['armour'],item:['item','ingredient','bonded_critter','stag_beetle_grub'],special:['weapon','armour','item','ingredient','bonded_critter','stag_beetle_grub']};
 for(const [slot,categories] of Object.entries(allowed)) {
  const found=searchEquipment(catalog,{slot,recent:['general-store-060','general-store-002']});
  assert.equal(found.length,catalog.filter(i=>categories.includes(i.category)).length);
  assert.ok(found.every(i=>categories.includes(i.category)));
  assert.ok(searchEquipment(specialMagicItems,{slot}).every(i=>categories.includes(i.category)));
  for(const category of ['weapon','armour','ingredient']) if(slot!=='special') assert.equal(searchEquipment(catalog,{slot,category}).length,found.length);
 }
 for(const query of ['両手武器','Two-handed weapon']){assert.equal(searchEquipment(catalog,{slot:'weapon1',query}).length,1);assert.equal(searchEquipment(catalog,{slot:'item',query}).length,0);}
 assert.equal(searchEquipment(catalog,{slot:'special',category:'ingredient'}).length,31);
 assert.equal(searchEquipment(catalog,{slot:'weapon1',recent:['general-store-060','general-store-002']})[0].id,'general-store-002');
});
test('4スキルの日英数値、重複・異なる値は合算せず内訳に保持、曖昧な自由入力は推測しない',()=>{
 const c=base();c.skillEntries=['Strong (2)','ストロング（2）','Tough (1)','ウィーク(3)','Delicate (4)','Strong (5)','Strong +8','ストロング（X）'];
 const result=deriveAbilitySources(c,catalog);
 assert.deepEqual(result.strong.skill.map(s=>s.value),[2,2,5]);
 assert.deepEqual(result.tough.skill.map(s=>s.value),[1]);assert.deepEqual(result.weak.skill.map(s=>s.value),[3]);assert.deepEqual(result.delicate.skill.map(s=>s.value),[4]);
 assert.match(abilitySourcesHtml(result),/技 複数/);assert.ok(!abilitySourcesHtml(result).includes('技 9'));
 assert.deepEqual(deriveAbilitySources({...base(),skills:'Strong (2)\nTough (1)'},catalog).strong.skill.map(s=>s.value),[2]);
});
test('武器・鎧・盾の効果値と使用条件を取得し、必要スキルや他能力のボーナスを数えない',()=>{
 const expected={2:['strong',3],3:['strong',1],5:['strong',1],7:['strong',2],10:['strong',1],13:['strong',4],15:['strong',3],17:['strong',2],18:['tough',1],19:['tough',2],22:['tough',1],23:['tough',4],32:['strong',1],34:['strong',1],35:['strong',1],36:['strong',1],93:['strong',2],95:['strong',1]};
 for(const [n,[ability,value]] of Object.entries(expected)){const c=base();equip(c,'special',Number(n));assert.deepEqual(deriveAbilitySources(c,catalog)[ability].equipment.map(e=>e.value),[value]);}
 for(const n of [1,12,16,39]){const c=base();equip(c,'special',n);assert.deepEqual(deriveAbilitySources(c,catalog).strong.equipment,[]);}
 const c=base();equip(c,'armour1',19);equip(c,'armour2',22);c.skills='Tough (1)';
 const result=deriveAbilitySources(c,catalog);assert.deepEqual(result.tough.equipment.map(e=>e.value),[2,1]);assert.equal(result.tough.skill[0].value,1);
 assert.ok(deriveAbilitySources({...c,skills:'Strong (2)'},catalog).strong.equipment.length===0);
});
test('自由入力は完全一致のみ参照、固定値のない魔法効果や未分類装備は推測せず、保護の数値は別内訳',()=>{
 const c=base();equip(c,'weapon1',2);delete c.equipmentSelections;c.equipmentSlots.weapon2='独自の武器';
 assert.equal(deriveAbilitySources(c,catalog).strong.equipment[0].value,3);
 c.equipmentSlots.weapon1='両手武器（独自）';assert.deepEqual(deriveAbilitySources(c,catalog).strong.equipment,[]);
 equip(c,'special','special-magic-selnab-necklace');assert.equal(deriveAbilitySources(c,catalog).delicate.equipment[0].value,null);
 equip(c,'armour1',19);c.equipmentMagic={armour1:{effects:[{id:'magic-effect-protection',bonus:3},{id:'magic-effect-wounding',bonus:5}],notes:''}};
 const result=deriveAbilitySources(c,catalog);assert.deepEqual(result.tough.equipment.map(e=>e.value),[2,3]);assert.equal(result.strong.equipment.length,1);assert.equal(result.strong.equipment[0].value,null);
 equip(c,'special','special-magic-ultimate-protection');assert.ok(deriveAbilitySources(c,catalog).tough.equipment.some(e=>e.value===6));
});
test('導出表示はデータを増やさずJSON・独立ゲーム・旧原文を維持',()=>{
 const c=base();c.skills='Strong (2)';equip(c,'weapon1',2);const w={id:'w',name:'保持',status:emptyBandStatus(),characters:[c]},d={version:2,warbands:[w],game:startGame(w)},before=structuredClone(d);
 abilitySourcesHtml(deriveAbilitySources(c,catalog));assert.deepEqual(d,before);assert.deepEqual(loadData(JSON.parse(JSON.stringify(d))),before);
 assert.equal(Object.hasOwn(c,'abilitySources'),false);c.skills='Strong (4)';assert.equal(deriveAbilitySources(d.game.characters[0],catalog).strong.skill[0].value,2);
});
