import test from 'node:test';
import assert from 'node:assert/strict';
import {denUpgrades,denUpgradeById,selectDenUpgrade,chooseDenEffect} from '../src/den-upgrades.js';
import {denUpgradePicker,denUpgradeList} from '../src/den-upgrade-view.js';
import {emptyBandStatus,startGame,loadData} from '../src/model.js';
test('提供4ページの18種類と全コスト・2結果表・祠の2効果',()=>{
 assert.equal(denUpgrades.length,18);assert.equal(new Set(denUpgrades.map(v=>v.id)).size,18);
 assert.deepEqual(denUpgrades.map(v=>[v.labour,v.materials]),[[12,4],[10,4],[8,2],[15,5],[6,3],[8,3],[8,2],[8,2],[8,6],[12,3],[8,2],[16,5],[8,2],[14,3],[12,4],[8,3],[14,3],[10,3]]);
 assert.deepEqual(denUpgrades.map(v=>v.page),[180,180,180,180,180,182,182,182,182,182,182,183,183,183,184,184,184,184]);
 for(const v of denUpgrades)assert.ok(v.nameJa&&v.nameEn&&v.text.length>0);
 assert.deepEqual(denUpgradeById('chapel').table.map(v=>v[0]),['1〜2','3','4','5〜6']);assert.match(denUpgradeById('chapel').table[1][1],/3d6/);
 assert.deepEqual(denUpgradeById('occult-laboratory').table.map(v=>v[0]),['1〜4','5','6']);assert.match(denUpgradeById('occult-laboratory').table[0][1],/運命点5点/);
 assert.deepEqual(denUpgradeById('shrine').choices.map(v=>v.id),['woods-and-shadows','spirit-world']);assert.match(denUpgradeById('shrine').choices[0].text,/Concealment.*\+1/);assert.match(denUpgradeById('shrine').choices[1].text,/Cast.*\+1/);
 assert.match(denUpgradeById('smithy').text,/12ペニー.*36ペニー/s);assert.match(denUpgradeById('secret-tunnels').text,/8″以上/);assert.match(denUpgradeById('gambling-den').text,/最大7個.*d4/s);
});
test('複数登録・解除・祠の選択・旧原文・独立戦闘とJSON、推測移行と自動効果なし',()=>{
 const s=emptyBandStatus();s.labour=45;s.materials=12;s.upgrades=[{id:'old',name:'祠<&>\n自由な原文'}];const old=structuredClone(s);
 const w={id:'w',name:'バンド',status:s,characters:[]},d={version:2,warbands:[w],game:startGame(w)},game=structuredClone(d.game);
 assert.deepEqual(loadData(d),d);assert.equal(s.denUpgrades,undefined);
 for(const v of denUpgrades)selectDenUpgrade(s,v.id,true);selectDenUpgrade(s,'library',true);assert.equal(s.denUpgrades.length,18);
 chooseDenEffect(s,'shrine','spirit-world');assert.equal(s.denUpgrades.find(v=>v.id==='shrine').choice,'spirit-world');
 assert.deepEqual({...s,denUpgrades:undefined},{...old,denUpgrades:undefined});assert.deepEqual(d.game,game);
 const restored=loadData(JSON.parse(JSON.stringify(d)));assert.deepEqual(restored,d);assert.equal(restored.warbands[0].status.denUpgrades.find(v=>v.id==='shrine').choice,'spirit-world');
 const snapshot=startGame(w);chooseDenEffect(s,'shrine','woods-and-shadows');assert.equal(snapshot.status.denUpgrades.find(v=>v.id==='shrine').choice,'spirit-world');
 selectDenUpgrade(s,'shrine',false);selectDenUpgrade(s,'shrine',true);assert.equal(s.denUpgrades.find(v=>v.id==='shrine').choice,null);
 assert.throws(()=>chooseDenEffect(s,'shrine','unknown'));assert.throws(()=>selectDenUpgrade(s,'unknown',true));
 assert.ok(!denUpgradePicker(s).includes('<textarea'));for(const html of [denUpgradeList(s),denUpgradePicker(s)]){assert.doesNotMatch(html,/旧アップグレードの原文|自由な原文|legacy-den-upgrades/);}assert.deepEqual(s.upgrades,old.upgrades);
});
test('任意メタデータの検証、旧値は無変更、未知IDは保持して未確認表示',()=>{
 const s=emptyBandStatus(),w={id:'w',name:'バンド',status:s,characters:[]},d={version:2,warbands:[w],game:null};
 for(const value of [null,{},[null],[{id:'',choice:null}],[{id:'library',choice:3}],[{id:'library',choice:null},{id:'library',choice:null}]]){s.denUpgrades=value;assert.throws(()=>loadData(d));}
 s.denUpgrades=[{id:'future-id',choice:'future-choice'}];assert.deepEqual(loadData(d),d);assert.match(denUpgradeList(s),/未確認/);assert.match(denUpgradePicker(s),/future-id/);
});
