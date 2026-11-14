import test from 'node:test';import assert from 'node:assert/strict';
import {stats,startGame,emptyBandStatus,loadData,toggleFocus,nextRound,wound} from '../src/model.js';
const character=id=>({id,name:id,species:'マウス',level:3,fate:2,experience:3,photo:'',stats:Object.fromEntries(stats.map(s=>[s,'D8'])),equipment:'剣',skills:'',spells:'',notes:'維持'});
const band=()=>({id:'w',name:'バンド',status:{...emptyBandStatus(),rating:6},characters:[character('a'),character('b')]});
test('新規戦闘の集中は全員オフ、元データや前の戦闘の集中は引き継がない',()=>{
 const w=band();w.characters[0].focused=true;const before=structuredClone(w),g=startGame(w);assert.ok(g.characters.every(c=>c.focused===false));toggleFocus(g.characters[0]);assert.ok(startGame(w).characters.every(c=>c.focused===false));assert.deepEqual(w,before);
});
test('集中のオン・オフは対象のfocusedだけを更新し、ラウンド・負傷・行動とは独立',()=>{
 const w=band(),g=startGame(w),before=structuredClone(g);toggleFocus(g.characters[0]);const expected=structuredClone(before);expected.characters[0].focused=true;assert.deepEqual(g,expected);toggleFocus(g.characters[0]);assert.deepEqual(g,before);
 toggleFocus(g.characters[0]);g.characters[0].acted=true;wound(g.characters[0],17);nextRound(g);assert.equal(g.characters[0].focused,true);assert.equal(g.characters[1].focused,false);assert.equal(g.characters[0].wounds,17);assert.equal(g.characters[0].acted,true);
});
test('集中のない旧形式はオフとして扱い、集中のあるJSONは値を保つ',()=>{
 const w=band(),d={version:2,warbands:[w],game:startGame(w)};for(const c of d.game.characters)delete c.focused;const before=structuredClone(d),loaded=loadData(d);assert.deepEqual(d,before);assert.ok(loaded.game.characters.every(c=>(c.focused??false)===false));toggleFocus(loaded.game.characters[0]);assert.deepEqual(loadData(JSON.parse(JSON.stringify(loaded))),loaded);assert.equal(loaded.game.characters[0].focused,true);assert.equal(loaded.game.characters[1].focused,undefined);
});
test('明示的な不正な集中値は拒否し、trueとfalseは受け付ける',()=>{
 const w=band(),d={version:2,warbands:[w],game:startGame(w)};for(const value of [null,0,1,'true',[],{}]){const copy=structuredClone(d);copy.game.characters[0].focused=value;assert.throws(()=>loadData(copy));}for(const value of [true,false]){d.game.characters[0].focused=value;assert.equal(loadData(d).game.characters[0].focused,value);}
});
