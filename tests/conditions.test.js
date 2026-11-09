import test from 'node:test';
import assert from 'node:assert/strict';
import {conditions,setCondition} from '../src/conditions.js';
import {stats,startGame,emptyBandStatus,loadData,nextRound,wound,penalty,sorted} from '../src/model.js';
const fixture=()=>{const c={id:'c',name:'状態テスト',species:'独自',level:6,fate:2,experience:3,photo:'',stats:Object.fromEntries(stats.map(s=>[s,'D10'])),equipment:'旧装備',skills:'旧技',spells:'旧呪文',notes:'メモ'};const w={id:'w',name:'バンド',status:{...emptyBandStatus(),rating:c.level},characters:[c]};return {version:2,warbands:[w],game:startGame(w)};};
test('提供36–37ページの6状態と数値・例外、Stunnedの訳語',()=>{
 assert.deepEqual(conditions.map(c=>c.nameJa),['スニーク','バーサーク','朦朧','麻痺','炎上','盲目']);
 assert.equal(new Set(conditions.map(c=>c.id)).size,6);
 const get=id=>conditions.find(c=>c.id===id).description;
 assert.match(get('sneaking'),/6″を超えて/);assert.match(get('sneaking'),/-2/);assert.match(get('sneaking'),/Concealment/);
 assert.match(get('berserk'),/\+6/);assert.match(get('berserk'),/-3/);assert.match(get('berserk'),/大胆不敵と堅忍/);
 assert.match(get('stunned'),/Fortitude.*2個/);assert.match(get('paralysed'),/出目は0/);
 assert.match(get('burning'),/出目が6.*負傷を受けず/);assert.match(get('burning'),/Interact.*2回/);
 assert.match(get('blinded'),/Awareness.*2個/);
});
test('複数状態、個別解除、旧自由入力、JSON互換と戦闘セッションの独立',()=>{
 const d=fixture(),roster=structuredClone(d.warbands),c=d.game.characters[0];
 c.effects.push({id:'free',name:'毒のメモ',description:'旧原文'});
 assert.deepEqual(loadData(JSON.parse(JSON.stringify(d))),d);assert.equal(Object.hasOwn(c,'conditions'),false);
 for(const v of conditions)setCondition(c,v.id,true);
 setCondition(c,'stunned',true);assert.equal(c.conditions.length,6);
 setCondition(c,'burning',false);assert.equal(c.conditions.length,5);assert.ok(c.conditions.includes('stunned'));
 assert.deepEqual(loadData(JSON.parse(JSON.stringify(d))),d);assert.deepEqual(d.warbands,roster);
 assert.deepEqual(c.effects,[{id:'free',name:'毒のメモ',description:'旧原文'}]);
 c.acted=true;nextRound(d.game);assert.equal(c.acted,false);assert.equal(c.conditions.length,5);
 wound(c,17);assert.equal(c.acted,true);assert.equal(penalty(c.wounds),'戦闘不能');nextRound(d.game);assert.equal(c.acted,true);
 wound(c,-1);assert.equal(penalty(c.wounds),'-4');assert.equal(c.acted,true);
 assert.deepEqual(sorted([c,{wounds:0,acted:false}]).map(c=>c.wounds),[0,16]);
 const fresh=startGame(d.warbands[0]);assert.equal(fresh.characters[0].conditions,undefined);assert.deepEqual(fresh.characters[0].effects,[]);
 for(const value of [['unknown'],['stunned','stunned'],{},null,[1]]){const bad=structuredClone(d);bad.game.characters[0].conditions=value;assert.throws(()=>loadData(bad));}
 assert.throws(()=>setCondition(c,'unknown',true));
});
