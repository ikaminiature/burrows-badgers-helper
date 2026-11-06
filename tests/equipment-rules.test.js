import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {equipmentRules,commonEquipmentRules,equipmentTables,magicEffects,specialMagicItems,equipmentReference,equipmentReferenceNotes} from '../src/equipment-rules.js';
import {equipmentDetails,magicDetails,magicReferenceLibrary} from '../src/equipment-view.js';
import {parseEquipmentCatalog,searchEquipment} from '../src/equipment.js';
import {loadData,emptyBandStatus,startGame,stats} from '../src/model.js';
const raw=JSON.parse(readFileSync('data/bb2_general_store_ja_en.json'));
const catalog=parseEquipmentCatalog(raw);
test('既存96件の安定ID全件に共通参照、素材31件の架空効果なし、別魔法装備12件',()=>{
 assert.equal(catalog.length,96);assert.equal(Object.keys(equipmentRules).length,96);
 assert.deepEqual(Object.keys(equipmentRules).sort(),catalog.map(i=>i.id).sort());
 for(const item of catalog) {const r=equipmentReference(item.id);assert.ok(r.pages.length);assert.ok(r.description||item.category==='ingredient');assert.ok(equipmentDetails(item).includes(item.nameEn.replace(/&/g,"&amp;").replace(/'/g,"&#39;")));}
 const ingredients=catalog.filter(i=>i.category==='ingredient');assert.equal(ingredients.length,31);
 for(const i of ingredients){assert.equal(equipmentRules[i.id].description,'');assert.ok(equipmentRules[i.id].ruleIds.includes('ingredients'));}
 assert.equal(catalog.find(i=>i.id==='general-store-060').nameJa,'角の粉');
 assert.equal(catalog.find(i=>i.id==='general-store-082').nameJa,'粉末ドングリ');
 assert.equal(specialMagicItems.length,12);assert.deepEqual(specialMagicItems.map(i=>i.roll),Array.from({length:12},(_,i)=>i+1));
 assert.equal(new Set([...catalog,...specialMagicItems].map(i=>i.id)).size,108);
 assert.equal(searchEquipment(specialMagicItems,{query:'ＳＥＲＰＥＮＴ'} )[0].nameJa,'蛇の指輪');
 assert.equal(searchEquipment(specialMagicItems,{query:'抵抗の指輪'})[0].id,'special-magic-ring-resistance');
 for(const r of [...Object.values(equipmentRules),...Object.values(commonEquipmentRules),...specialMagicItems]){
  for(const id of r.ruleIds||[]) assert.ok(commonEquipmentRules[id],id);
  for(const id of r.tableIds||[]) assert.ok(equipmentTables[id],id);
  for(const id of r.relatedEquipmentIds||[]) assert.ok(equipmentRules[id],id);
 }
 const sourcePages=[...new Set([...Object.values(equipmentRules),...Object.values(commonEquipmentRules),...Object.values(equipmentTables),...specialMagicItems].flatMap(r=>r.pages))].filter(p=>p!==138).sort((a,b)=>a-b);
 assert.deepEqual(sourcePages,[98,99,100,101,102,103,105,106,107,108,110,111,112,113,114,115,117,118,119,120,121,122]);
 assert.equal(equipmentReference('custom-id'),null);
});
test('武器条件・共通特殊ルール・カイロ表・防具枠とペナルティ・単回使用',()=>{
 assert.match(equipmentRules['general-store-012'].conditions,/ストロング\(2\)/);
 assert.match(equipmentRules['general-store-013'].conditions,/ストロング\(1\)/);
 assert.match(equipmentRules['general-store-014'].conditions,/大胆不敵.*Shooting/);
 assert.deepEqual(equipmentTables['cheirosiphon-modes'].rows,[['Short（短射）','8″','d8','d6'],['Medium（中射）','12″','d12','2d6'],['Sustained（連続噴射）','18″','d20','3d6']]);
 assert.deepEqual(equipmentTables['cheirosiphon-misfire'].rows.map(r=>r[0]),['1','2','3–5','6']);
 assert.match(equipmentTables['cheirosiphon-misfire'].rows[3][1],/d20\+7.*Misfire.*振りません/);
 for(const n of ['007','010','011','013','015']) assert.ok(equipmentRules['general-store-'+n].ruleIds.includes('slow'));
 assert.match(commonEquipmentRules.temperamental.text,/まず〈Interact〉.*その後.*〈Interact〉/);
 assert.match(equipmentRules['general-store-019'].conditions,/2つとも使用/);
 assert.match(equipmentRules['general-store-023'].description,/タフ\(4\).*\n?【Nimbleness】.*-2/);
 assert.match(equipmentRules['general-store-022'].description,/タフ\(1\).*\n?【Nimbleness】.*-1/s);
 assert.match(equipmentRules['general-store-031'].description,/d8\+2.*\n.*削除/s);
 assert.match(equipmentRules['general-store-054'].description,/追加で6点.*軽減されません/);
});
test('魔法効果14件と全決定表、原資料の訳語差、初期閉状態・HTML安全性',()=>{
 assert.equal(magicEffects.length,14);assert.equal(new Set(magicEffects.map(e=>e.id)).size,14);
 assert.equal(magicEffects.filter(e=>e.needsBonus).length,11);
 assert.deepEqual(equipmentTables.bonus.rows,[['1–4','+1'],['5–7','+2'],['8','+3']]);
 assert.equal(equipmentTables['enchanted-type'].rows.length,14);
 assert.equal(equipmentTables['item-effects'].rows.length,9);
 assert.equal(equipmentTables['weapon-effects'].rows.length,5);
 assert.equal(equipmentTables['armour-effects'].rows.length,8);
 assert.match(equipmentTables['weapon-effects'].rows[2][1],/強打/);
 assert.match(magicEffects.find(e=>e.id==='magic-effect-smiting').nameJa,/討伐/);
 assert.equal(equipmentReferenceNotes.length,3);
 const html=equipmentDetails(catalog[13]);assert.ok(!html.includes(' open'));assert.match(html,/暴発表/);assert.match(html,/カイロサイフォン/);
 assert.match(equipmentDetails({...catalog[0],nameJa:'<img src=x onerror=alert(1)>'}),/&lt;img/);
 assert.match(magicDetails({effects:[{id:'<script>',bonus:null}],notes:'<img>'}),/&lt;script&gt;/);
 assert.match(magicReferenceLibrary(),/魔法装備効果の説明/);
});
test('魔法効果はIDと数値のみ、旧データ・JSON・ゲームを独立して保持し不正値を拒否',()=>{
 const c={id:'c',name:'保持',species:'自由種族',level:4,fate:3,experience:2,photo:'',stats:Object.fromEntries(stats.map(s=>[s,'D8'])),equipment:'古い装備',skills:'旧スキル',spells:'呪文',notes:'メモ'};
 const w={id:'w',name:'保持バンド',status:emptyBandStatus(),characters:[c]},d={version:2,warbands:[w],game:startGame(w)};
 assert.deepEqual(loadData(d),d);const game=structuredClone(d.game);
 c.equipmentMagic={weapon1:{effects:[{id:'magic-effect-smiting',bonus:3},{id:'magic-effect-flame',bonus:null}],notes:'手動の補足'}};
 const loaded=loadData(JSON.parse(JSON.stringify(d)));assert.deepEqual(loaded,d);assert.deepEqual(loaded.game,game);
 assert.ok(!JSON.stringify(loaded).includes('ボーナスレベルをロール'));
 const newGame=startGame(w);newGame.characters[0].equipmentMagic.weapon1.effects[0].bonus=1;assert.equal(c.equipmentMagic.weapon1.effects[0].bonus,3);
 for(const v of [false,[],null,{weapon7:{effects:[],notes:''}},{weapon1:{effects:[{id:'x',bonus:-1}],notes:''}},{weapon1:{effects:[{id:'x',bonus:1.5}],notes:''}}]) {const bad=structuredClone(d);bad.warbands[0].characters[0].equipmentMagic=v;assert.throws(()=>loadData(bad));}
});
test('性能見出しのみ具体値、装備枠を非表示、説明本文・参照データは不変',()=>{
 const before=structuredClone(equipmentRules), commonBefore=structuredClone(commonEquipmentRules);
 const expected={2:['strong',3],3:['strong',1],5:['strong',1],7:['strong',2],10:['strong',1],12:['strong',2],13:['strong',4],15:['strong',3],17:['strong',2],18:['tough',1],19:['tough',2],22:['tough',1],23:['tough',4],32:['strong',1],34:['strong',1],35:['strong',1],36:['strong',1],93:['strong',2],95:['strong',1]};
 for(const [n,[rule,value]] of Object.entries(expected)) {
  const item=catalog[Number(n)-1], html=equipmentDetails(item);
  const summaries=[...html.matchAll(/<summary>(.*?)<\/summary>/gs)].map(m=>m[1]);
  assert.ok(summaries.some(text=>text.includes(`${rule==='strong'?'ストロング':'タフ'}（${value}）`)),item.nameJa);
  assert.ok(summaries.every(text=>!text.includes('装備枠')&&!/[(（]X[)）]/.test(text)),item.nameJa);
  assert.ok(html.includes(commonEquipmentRules[rule].text), '共通説明は原文のまま');
  assert.ok(html.includes(equipmentRules[item.id].description), '個別説明は原文のまま');
 }
 assert.match(equipmentDetails(catalog[11]),/使用条件：Strong \(2\)/);
 assert.match(equipmentDetails(catalog[16]),/ストロング（2）（魔法使い・不気味に対して）/);
 assert.match(magicDetails({effects:[{id:'magic-effect-protection',bonus:3}],notes:''}),/タフ（3）/);
 assert.deepEqual(equipmentRules,before);assert.deepEqual(commonEquipmentRules,commonBefore);
});
