import test from 'node:test';
import assert from 'node:assert/strict';
import {sideQuests,questById,questRange} from '../src/side-quests.js';
import {questSlotHtml,selectQuest,selectWildQuest} from '../src/side-quest-view.js';
import {hasConditions} from '../src/conditions.js';
import {startGame,emptyBandStatus,loadData,nextRound} from '../src/model.js';
test('246ページ全39件・順序・D100全出目・3専用表と本文の例外',()=>{
 const names=['Deliver the Message','Secure','Assassinate','Invade','Devastate','Deny','Capture','Purge','Bring Down the Beast','Defend','Scavenger Run','Blockade','Conserve','Push Through','Break Them','Isolate','Attrition','Split Them Up','Escort','Reclaim','Rescue','Destroy','Locate','Mark','Test a Spell','Test Some Armour','Bounty Hunt','Test a Weapon','Survey','Loot','Show down','Scorched Earth','Pierce the Veil','Second sight','Imbibe','Intoxicating Gas','Serve a Notice','Habeas Corpus','Wild Card'];
 assert.deepEqual(sideQuests.map(q=>q.range),[[1,3],[4,5],[6,7],[8,10],[11,12],[13,15],[16,17],[18,19],[20,22],[23,24],[25,26],[27,28],[29,30],[31,32],[33,34],[35,37],[38,40],[41,42],[43,45],[46,48],[49,51],[52,54],[55,57],[58,60],[61,63],[64,65],[66,68],[69,71],[72,74],[75,77],[78,80],[81,83],[84,86],[87,89],[90,92],[93,94],[95,97],[98,99],[100,100]]);
 assert.deepEqual(sideQuests.map(q=>q.nameEn),names);assert.equal(new Set(sideQuests.map(q=>q.id)).size,39);
 assert.deepEqual(sideQuests.flatMap(q=>Array.from({length:q.range[1]-q.range[0]+1},(_,i)=>q.range[0]+i)),Array.from({length:100},(_,i)=>i+1));
 for(const q of sideQuests){assert.ok(q.nameJa&&q.text.length>25);assert.ok([247,248,249,250,251,252,253,255,256].includes(q.page));}
 assert.equal(questRange(sideQuests[0]),'01–03');assert.equal(questRange(sideQuests.at(-1)),'100');
 assert.deepEqual(sideQuests.filter(q=>q.table).map(q=>q.id),['test-a-spell','test-some-armour','test-a-weapon']);
 for(const q of sideQuests.filter(q=>q.table)){assert.deepEqual(q.table.rows.map(r=>r[0]),['1','2','3','4','5','6']);assert.ok(q.table.rows.every(r=>r[1].length>20));assert.match(q.table.after,/毎回もう一度ロール/);assert.match(q.table.after,/経験点\+1/);}
 assert.match(questById('test-a-spell').text,/射程6″、難易度3/);assert.match(questById('test-some-armour').text,/タフのボーナスは一切与えない/);
 assert.match(questById('test-a-weapon').table.rows[5][1],/重傷/);assert.match(questById('blockade').text,/24″.*代わりに\+2/s);
 assert.match(questById('pierce-the-veil').text,/浄化を行った魔法使いは\+1を得る/);
 assert.match(questById('habeas-corpus').text,/Movement系およびInnate系/);
});
test('2枠独立・ワイルドカード・旧原文の不変・JSON／ラウンド保持と新規初期化',()=>{
 const w={id:'w',name:'バンド',status:emptyBandStatus(),characters:[]},g=startGame(w);g.sideQuests=['旧自由入力<&>\n原文','他の記録'];delete g.sideQuestSelections;
 const old=structuredClone(g),legacy=structuredClone(g.sideQuests);
 const d=loadData({version:2,warbands:[w],game:g});assert.deepEqual(d.game,old);
 selectQuest(g,0,'secure');selectQuest(g,1,'wild-card');selectWildQuest(g,1,'capture');
 assert.deepEqual(g.sideQuestSelections,[{id:'secure',wildCardChoice:null},{id:'wild-card',wildCardChoice:'capture'}]);assert.deepEqual(g.sideQuests,legacy);
 assert.deepEqual(loadData(JSON.parse(JSON.stringify({version:2,warbands:[w],game:g}))).game,g);
 const selections=structuredClone(g.sideQuestSelections);nextRound(g);assert.deepEqual(g.sideQuestSelections,selections);
 const html=questSlotHtml(g,0);assert.match(html,/旧自由入力&lt;&amp;&gt;/);assert.ok(!html.includes('<textarea'));assert.match(html,/旧サイドクエスト1の原文/);
 selectQuest(g,0,'');assert.equal(g.sideQuestSelections[0],null);assert.equal(g.sideQuestSelections[1].wildCardChoice,'capture');assert.deepEqual(g.sideQuests,legacy);
 assert.throws(()=>selectWildQuest(g,1,'wild-card'));assert.throws(()=>selectQuest(g,2,'secure'));assert.throws(()=>selectQuest(g,0,'unknown'));
 assert.deepEqual(startGame(w).sideQuestSelections,[null,null]);
 for(const bad of [[],[null],[{id:'',wildCardChoice:null},null],[{id:'secure',wildCardChoice:5},null]]){const input={version:2,warbands:[w],game:structuredClone(g)};input.game.sideQuestSelections=bad;assert.throws(()=>loadData(input));}
 const future=structuredClone(g);future.sideQuestSelections[0]={id:'future-quest',wildCardChoice:null};assert.deepEqual(loadData({version:2,warbands:[w],game:future}).game,future);assert.match(questSlotHtml(future,0),/未確認/);
});
test('通知は基本状態または自由登録の有無だけから導出し保存値を増やさない',()=>{
 for(const [conditions,effects,expected] of [[[],[],false],[['stunned'],[],true],[[],[{id:'e'}],true],[['stunned','burning'],[{id:'e'}],true]]){const c={conditions,effects},old=structuredClone(c);assert.equal(hasConditions(c),expected);assert.deepEqual(c,old);}
});
