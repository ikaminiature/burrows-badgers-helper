import test from 'node:test';
import assert from 'node:assert/strict';
import {stats,startGame,emptyBandStatus,loadData,nextRound,validateData} from '../src/model.js';
import {setCharacterNotes,setCharacterNotes2,setWarbandNotes,majorInjuries,searchMajorInjuries} from '../src/notes.js';
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

test('メモ2は別項目として保存・復元され、旧データや通常のメモに影響しない',()=>{
 const d=fixture();
 assert.equal(loadData(d).warbands[0].characters[0].notes2,undefined);
 assert.equal(setCharacterNotes2(d,'roster','w','c',''),false);
 const expected=structuredClone(d);
 expected.warbands[0].characters[0].notes2=expected.game.characters[0].notes2='Lv.2\n能力を追加';
 assert.equal(setCharacterNotes2(d,'roster','w','c','Lv.2\n能力を追加'),true);
 assert.deepEqual(loadData(JSON.parse(JSON.stringify(d))),expected);
 assert.equal(startGame(d.warbands[0]).characters[0].notes2,'Lv.2\n能力を追加');
 assert.throws(()=>setCharacterNotes2(d,'roster','w','c','x'.repeat(20001)));
 d.warbands[0].characters[0].notes2=42;assert.throws(()=>validateData(d));
});

test('冒険の思い出は別項目として保存・復元し、不正なレベルと出目は拒否する',()=>{
 const d=fixture(),c=d.warbands[0].characters[0];
 c.adventure={injuries:['chest-wound','chest-wound'],rolls:[{level:2,result:8}]};
 assert.deepEqual(loadData(JSON.parse(JSON.stringify(d))),d);
 assert.equal(c.notes,'元のメモ');
 for(const invalid of [{level:0,result:8},{level:2,result:0},{level:2,result:1.5}]){
  c.adventure.rolls=[invalid];assert.throws(()=>validateData(d));
 }
});

test('第2版の重傷表は全出目に対応し、出目と名前で検索できる',()=>{
 assert.equal(majorInjuries.length,19);
 assert.equal(new Set(majorInjuries.map(v=>v.id)).size,19);
 for(let i=1;i<=20;i++)assert.equal(searchMajorInjuries(String(i)).length,1);
 assert.deepEqual(searchMajorInjuries('６').map(v=>v.label),['胸部負傷']);
 assert.deepEqual(searchMajorInjuries('胸部').map(v=>v.roll),['6']);
 assert.deepEqual(searchMajorInjuries('Chest Wound').map(v=>v.roll),['6']);
 assert.deepEqual(searchMajorInjuries('19-20').map(v=>v.label),['見た目ほどひどくはない']);
});
