import test from 'node:test';
import assert from 'node:assert/strict';
import {startGame,emptyBandStatus,loadData,nextRound,adjustVP} from '../src/model.js';
const band=()=>({id:'w',name:'バンド',status:emptyBandStatus(),characters:[]});
test('旧戦闘へVPと2クエストのみを補完し、入力は変更せず既存値・JSON往復を保持',()=>{
 const w=band(),g=startGame(w);delete g.vp;delete g.sideQuests;g.round=3;
 const input={version:2,warbands:[w],game:g},original=structuredClone(input);
 const loaded=loadData(input);assert.deepEqual(input,original);assert.equal(loaded.game.vp,0);assert.deepEqual(loaded.game.sideQuests,['','']);
 const expected=structuredClone(original);expected.game.vp=0;expected.game.sideQuests=['',''];assert.deepEqual(loaded,expected);
 loaded.game.vp=12;loaded.game.sideQuests=['日本語\n改行<&>',''];assert.deepEqual(loadData(JSON.parse(JSON.stringify(loaded))),loaded);
 nextRound(loaded.game);assert.equal(loaded.game.round,4);assert.equal(loaded.game.vp,12);assert.equal(loaded.game.sideQuests[0],'日本語\n改行<&>');assert.deepEqual(loaded.warbands,[w]);
 assert.deepEqual(startGame(w).sideQuests,['','']);assert.equal(startGame(w).vp,0);
 assert.equal(loadData({version:2,warbands:[w],game:null}).game,null);
});
test('VPは非負整数、独立した2枠、明示的な不正値は補完で隠さず拒否',()=>{
 const d={version:2,warbands:[band()],game:startGame(band())};
 adjustVP(d.game,-1);assert.equal(d.game.vp,0);adjustVP(d.game,1);assert.equal(d.game.vp,1);adjustVP(d.game,1);assert.equal(d.game.vp,2);adjustVP(d.game,-1);assert.equal(d.game.vp,1);
 d.game.vp=Number.MAX_SAFE_INTEGER;adjustVP(d.game,1);assert.equal(d.game.vp,Number.MAX_SAFE_INTEGER);
 for(const vp of [-1,1.5,'1',null,Infinity,Number.MAX_SAFE_INTEGER+1]){const bad=structuredClone(d);bad.game.vp=vp;assert.throws(()=>loadData(bad));}
 for(const quests of [[],[''],['','',''],[null,''],{},null,['x'.repeat(20001),'']]){const bad=structuredClone(d);bad.game.sideQuests=quests;assert.throws(()=>loadData(bad));}
 assert.throws(()=>adjustVP(d.game,1.5));
 const a=startGame(band()),b=startGame(band());a.sideQuests[0]='変更';assert.equal(b.sideQuests[0],'');
});
