import test from 'node:test';
import assert from 'node:assert/strict';
import {skills,skillCategories,searchSkills,matchSkill,skillName} from '../src/skills.js';
import {speciesPresets} from '../src/species.js';
import {loadData,emptyBandStatus,startGame,stats} from '../src/model.js';
test('提供21ページの88スキル、カテゴリ、ID、全文・条件・数値指定',()=>{
 assert.equal(skills.length,88); assert.equal(new Set(skills.map(s=>s.id)).size,88);
 assert.deepEqual(skillCategories.map(c=>searchSkills('',c).length),[17,11,24,14,9,13]);
 assert.deepEqual([...new Set(skills.map(s=>s.page))].sort((a,b)=>a-b),[124,126,127,128,129,130,131,133,134,135,136,137,138,140,141,142,143,144,145,146,147]);
 for(const s of skills) {assert.ok(s.nameJa&&s.nameEn&&s.conditions&&s.description.length>20); assert.ok(skillCategories.includes(s.category));}
 assert.deepEqual(skills.filter(s=>s.parameterized).map(s=>s.nameEn),['STRONG (X)','TOUGH (X)','WEAK (X)','DELICATE (X)']);
 assert.equal(searchSkills('受け流し')[0].description,'敵の打撃に対する反応のタイミングを完璧に合わせることで、攻撃を容易に受け止め、いなすことができます。このモデルは、自分が行う【Block】ロールに +2 を加えてもよい。');
 assert.match(searchSkills('OTHERWORLDLY')[0].description,/スタブル・ガスト.*\+1/);
 assert.match(searchSkills('OTHERWORLDLY')[0].description,/5\+ 何事もなく/);
 assert.match(searchSkills('HEDGE MAGIC')[0].description,/12 Necromancy\/死霊術/);
 assert.match(searchSkills('UNRELIABLE')[0].description,/4\+ 何事もなく/);
 assert.match(searchSkills('POISONOUS')[0].description,/ターン終了まで状態「朦朧」/);
});
test('日英・全半角検索、完全一致のみの安全な旧スキル対応と数値保持',()=>{
 assert.equal(searchSkills('ＰａＲＲｙ')[0].nameJa,'受け流し');
 assert.equal(searchSkills('受け流し','Shooting').length,0);
 for(const s of skills) {
  for(const text of [s.nameJa,s.nameEn]) {
   const name=s.parameterized?text.replace('X','3'):text;
   const m=matchSkill(name);assert.equal(m.skill.id,s.id);assert.equal(m.value,s.parameterized?3:null);
  }
 }
 for(const text of ['Strong (1) extra','独自スキル','Parry: 自分のメモ','Strong (-1)','Strong (1.5)','Strong (X)']) assert.equal(matchSkill(text),null);
 assert.equal(matchSkill('Strong (1)').value,1);
 assert.equal(matchSkill('ストロング(2)').value,2);
 // Species names are never rewritten; known names can acquire catalog details at display time.
 for(const p of speciesPresets) for(const text of p.skills) {const m=matchSkill(text);if(m) assert.ok(skills.includes(m.skill));}
 const parry=searchSkills('PARRY')[0];assert.equal(matchSkill('自由入力',{id:parry.id,value:null}),null);
 assert.equal(skillName(searchSkills('TOUGH')[0],4),'タフ（4）');
});
test('旧原文と写真、数値別保存、JSON復元、戦闘スナップショットの独立',()=>{
 const c={id:'c',name:'旧キャラ',species:'独自',level:6,fate:2,experience:3,photo:'',stats:Object.fromEntries(stats.map(s=>[s,'D10'])),equipment:'昔の剣',skills:'Strong (1)\n独自スキル',spells:'自由呪文',notes:'メモ'};
 const w={id:'w',name:'旧バンド',status:emptyBandStatus(),characters:[c]};
 const d={version:2,warbands:[w],game:startGame(w)};
 const game=structuredClone(d.game); assert.deepEqual(loadData(d),d);
 c.skillEntries=['ストロング（3）','独自スキル','受け流し'];
 c.skillSelections=[{id:'skill-strong',value:3},null,{id:'skill-parry',value:null}];
 const loaded=loadData(JSON.parse(JSON.stringify(d)));assert.deepEqual(loaded,d);assert.deepEqual(loaded.game,game);
 loaded.warbands[0].characters[0].skillSelections[0].value=4;assert.deepEqual(loaded.game,game);
 for(const value of [-1,1.5,'3',Infinity]) {const bad=structuredClone(d);bad.warbands[0].characters[0].skillSelections[0].value=value;assert.throws(()=>loadData(bad));}
 const bad=structuredClone(d);bad.warbands[0].characters[0].skillSelections.pop();assert.throws(()=>loadData(bad));
});
