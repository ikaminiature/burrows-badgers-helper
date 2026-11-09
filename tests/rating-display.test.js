import test from 'node:test';import assert from 'node:assert/strict';
import {stats,emptyBandStatus,startGame,loadData,warbandRating,updateWarbandRatings} from '../src/model.js';
import {abilitySourcesHtml} from '../src/ability-sources.js';
const character=(level,id)=>({id,name:id,species:'マウス',level,fate:0,experience:0,photo:'',stats:Object.fromEntries(stats.map(s=>[s,'D6'])),equipment:'',skills:'',spells:'',notes:'維持'});
const band=()=>({id:'w',name:'バンド',status:{...emptyBandStatus(),rating:999,treasury:123},characters:[3,4,2,5,3].map((v,i)=>character(v,'c'+i))});
test('レーティングは全レベル合計17、空バンドは0',()=>{assert.equal(warbandRating(band()),17);assert.equal(warbandRating({...band(),characters:[]}),0);});
test('旧データ再計算は登録側ratingだけ変更し、入力と戦闘の記録は維持',()=>{
 const w=band(),d={version:2,warbands:[w],game:startGame(w)};d.game.status.rating=88;const before=structuredClone(d),expected=structuredClone(d);expected.warbands[0].status.rating=17;
 assert.deepEqual(loadData(d),expected);assert.deepEqual(d,before);assert.equal(startGame(w).status.rating,17);
 assert.deepEqual(loadData(JSON.parse(JSON.stringify(expected))),expected);
});
test('追加・削除・レベル変更で再計算し、他の保存項目は変更しない',()=>{
 const w=band(),d={version:2,warbands:[w],game:startGame(w)},game=structuredClone(d.game);w.characters.push(character(7,'new'));updateWarbandRatings(d);assert.equal(w.status.rating,24);
 w.characters.pop();w.characters[0].level=10;updateWarbandRatings(d);assert.equal(w.status.rating,24);w.characters=[];updateWarbandRatings(d);assert.equal(w.status.rating,0);assert.equal(w.status.treasury,123);assert.deepEqual(d.game,game);
});
test('Weak/Delicateは技・装・未設定記号なし。明示的な0は表示する',()=>{
 const result=Object.fromEntries(['strong','tough','weak','delicate'].map(id=>[id,{skill:[],equipment:[]}]));result.delicate.skill=[{name:'Delicate',value:0}];const before=structuredClone(result),html=abilitySourcesHtml(result);
 const part=id=>html.split(`data-ability="${id}"`)[1].split('</summary>')[0];assert.match(part('weak'),/<span><\/span>/);assert.doesNotMatch(part('weak'),/技|装|—|ー<\/span>/);assert.match(part('delicate'),/>0<\/span>/);assert.match(part('strong'),/技 —/);assert.match(part('tough'),/装 —/);assert.deepEqual(result,before);
});
