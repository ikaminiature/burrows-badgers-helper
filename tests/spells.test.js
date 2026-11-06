import test from 'node:test';
import assert from 'node:assert/strict';
import {spells,spellArchetypes,searchSpells,matchSpell,archetypeConditions} from '../src/spells.js';
import {spellDetails} from '../src/spell-view.js';
import {loadData,emptyBandStatus,startGame,stats} from '../src/model.js';
test('提供資料の全76呪文・12種類・元素4分野・口よせの両働き',()=>{
 assert.equal(spells.length,76);assert.equal(new Set(spells.map(s=>s.id)).size,76);
 assert.deepEqual(spellArchetypes.map(a=>searchSpells('',a.id).length),[6,6,6,6,6,6,6,6,6,6,8,8]);
 for(const s of spells){assert.ok(s.nameJa&&s.nameEn&&s.range&&s.confirmed);assert.ok(Number.isInteger(s.difficulty));assert.ok(s.description||s.shallow&&s.deep);assert.ok(s.materials.every(m=>m.name&&m.effect));assert.ok(archetypeConditions(s).includes('〈Cast〉'));}
 for(const element of ['火','土','風','水'])assert.equal(searchSpells('','elementalism',element).length,2);
 for(const s of searchSpells('','channelling')){assert.ok(s.shallow&&s.deep);assert.match(s.fate.condition,/失敗しても/);assert.match(s.fate.effect,/同時には発動しない/);}
 assert.match(archetypeConditions(searchSpells('Firebolt')[0]),/-2/);
 assert.match(archetypeConditions(searchSpells('Healing Hands')[0]),/課さない/);
});
test('日英・全半角・アポストロフィ検索と安全な完全一致',()=>{
 for(const s of spells)for(const n of [s.nameJa,s.nameEn])assert.equal(matchSpell(n).id,s.id);
 assert.equal(searchSpells('ＦＩＲＥＢＯＬＴ')[0].nameJa,'ファイアボルト');
 assert.equal(searchSpells("bear's strength")[0].nameJa,'熊の剛力');
 assert.equal(searchSpells('ヒール','dark').length,0);
 for(const t of ['独自の呪文','Heal メモ','祝福：独自効果'])assert.equal(matchSpell(t),null);
 assert.equal(matchSpell('自由入力',{id:spells[0].id}),null);
 assert.equal(matchSpell('ヘイスト',{id:'future-id'}),null);
 assert.ok(spellDetails('<img src=x onerror=alert(1)>').includes('&lt;img'));
 assert.match(spellDetails('不明'),/未確認/);
 assert.match(spellDetails('祝福'),/Bless/);assert.match(spellDetails('粉砕'),/深い働き/);
});
test('原資料の数値・例外を保持し、本文の食い違いも推測修正しない',()=>{
 const s=n=>searchSpells(n)[0];
 assert.deepEqual(['Haste','Curse','Cure','Luck','Lightning','Push'].map(n=>s(n).difficulty),[5,3,3,3,2,4]);
 assert.match(s('Push').description,/3″高い/);
 assert.match(s('Regrowth').shallow,/ベースコンタクト/);assert.equal(s('Regrowth').range,'12″');
 assert.match(s('Evade').description,/術者/);assert.equal(s('Evade').range,'18″');
 assert.match(s('The Burning').description,/アーマー由来のタフの値を.*加える/);
 assert.match(s('Storm Call').description,/味方はd8、敵はd6/);
 assert.match(s('Curse of the Centuries').description,/最低1負傷/);
 assert.match(s('Mortal Wound').conditions,/未確認/);
});
test('旧原文・写真・JSON復元・独立戦闘スナップショットと不正メタデータ',()=>{
 const c={id:'c',name:'旧キャラ',species:'独自',level:6,fate:2,experience:3,photo:'',stats:Object.fromEntries(stats.map(s=>[s,'D10'])),equipment:'旧剣',skills:'独自技',spells:'Heal\n自由呪文',notes:'保持'};
 const w={id:'w',name:'バンド',status:emptyBandStatus(),characters:[c]},d={version:2,warbands:[w],game:startGame(w)};
 const old=structuredClone(d),game=structuredClone(d.game);assert.deepEqual(loadData(d),old);
 c.spellEntries=['ヒール','独自'];c.spellSelections=[{id:searchSpells('Heal')[0].id},null];
 assert.deepEqual(loadData(JSON.parse(JSON.stringify(d))),d);assert.deepEqual(d.game,game);
 c.spellSelections[0].id='future-id';assert.deepEqual(loadData(d),d);
 for(const selections of [[],[null],[{id:1},null],[{id:''},null],{},[false,null]]){const bad=structuredClone(d);bad.warbands[0].characters[0].spellSelections=selections;assert.throws(()=>loadData(bad));}
});
