import test from 'node:test';
import assert from 'node:assert/strict';
import {stats,startGame,emptyBandStatus,loadData,nextRound,validateData} from '../src/model.js';
import {setCharacterNotes,setWarbandNotes} from '../src/notes.js';
const character=id=>({id,name:id,species:'マウス',level:1,fate:1,experience:0,photo:'',stats:Object.fromEntries(stats.map(s=>[s,'D6'])),equipment:'剣',skills:'',spells:'',notes:'元のメモ'});
function fixture(){const w={id:'w',name:'バンド',status:{...emptyBandStatus(),rating:2},characters:[character('c'),character('other')]};return {version:2,warbands:[w],game:startGame(w)};}
test('双方向同期はnotesだけを更新し、戦闘の負傷等や別キャラを維持',()=>{
 const d=fixture();d.game.characters[0].wounds=7;d.game.characters[0].acted=true;const before=structuredClone(d);
 assert.equal(setCharacterNotes(d,'battle',null,'c','戦闘から\n更新'),true);
 assert.equal(d.warbands[0].characters[0].notes,'戦闘から\n更新');
 assert.equal(setCharacterNotes(d,'roster','w','c','登録から更新'),true);
 assert.equal(d.game.characters[0].notes,'登録から更新');
 assert.equal(setCharacterNotes(d,'roster','w','c','登録から更新'),false);
 for(const copy of [d,before]){copy.warbands[0].characters[0].notes='比較';copy.game.characters[0].notes='比較';}assert.deepEqual(d,before);
});
test('旧戦闘は一意のIDだけ同期。曖昧なID・削除済み・他バンドには波及しない',()=>{
 const d=fixture();delete d.game.sourceWarbandId;
 setCharacterNotes(d,'battle',null,'c','旧形式');assert.equal(d.warbands[0].characters[0].notes,'旧形式');
 d.warbands.push({...structuredClone(d.warbands[0]),id:'another'});
 setCharacterNotes(d,'battle',null,'c','曖昧');assert.equal(d.warbands[0].characters[0].notes,'旧形式');
 d.game.sourceWarbandId='w';setCharacterNotes(d,'battle',null,'c','特定');assert.equal(d.warbands[0].characters[0].notes,'特定');assert.equal(d.warbands[1].characters[0].notes,'旧形式');
 d.warbands.shift();setCharacterNotes(d,'battle',null,'c','削除後');assert.equal(d.warbands[0].characters[0].notes,'旧形式');
 assert.equal(setCharacterNotes(d,'battle',null,'missing','x'),false);
});
test('戦闘専用notesは旧データに補完しラウンド・JSONで維持、新規戦闘は空欄',()=>{
 const d=fixture();delete d.game.notes;const old=structuredClone(d),loaded=loadData(d);assert.equal(loaded.game.notes,'');assert.deepEqual(d,old);
 loaded.game.notes='ゲームメモ';nextRound(loaded.game);assert.equal(loaded.game.notes,'ゲームメモ');
 assert.equal(loaded.game.characters[0].notes,'元のメモ');assert.deepEqual(loadData(JSON.parse(JSON.stringify(loaded))),loaded);
 assert.equal(startGame(loaded.warbands[0]).notes,'');loaded.game.notes=10;assert.throws(()=>validateData(loaded));
});

test('ウォーバンド直接メモはstatus.notesだけを更新し個別・戦闘メモや他バンドは維持',()=>{
 const d=fixture();d.warbands[0].status.notes='既存メモ';d.warbands.push({...structuredClone(d.warbands[0]),id:'other'});const expected=structuredClone(d);expected.warbands[0].status.notes='直接変更\n２行目';
 assert.equal(setWarbandNotes(d,'w','直接変更\n２行目'),true);assert.deepEqual(d,expected);assert.equal(setWarbandNotes(d,'w','直接変更\n２行目'),false);assert.equal(setWarbandNotes(d,'missing','x'),false);assert.throws(()=>setWarbandNotes(d,'w','x'.repeat(20001)));assert.deepEqual(d,expected);assert.equal(setWarbandNotes(d,'w',''),true);assert.equal(d.warbands[0].status.notes,'');
});
