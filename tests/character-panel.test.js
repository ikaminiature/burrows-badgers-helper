import test from 'node:test';import assert from 'node:assert/strict';
import {horizontalSwipe} from '../src/character-panel.js';
import {abilitySourcesHtml} from '../src/ability-sources.js';
import {denUpgrades} from '../src/den-upgrades.js';import {denUpgradePicker,denUpgradeList} from '../src/den-upgrade-view.js';
test('横スワイプは方向・60px・縦横比を満たす場合だけ成立',()=>{
 for(const [dx,dy,direction,expected] of [[60,0,1,true],[59,0,1,false],[-70,4,-1,true],[70,4,-1,false],[70,50,1,false],[10,100,1,false],[0,0,1,false]])assert.equal(horizontalSwipe(dx,dy,direction),expected);
});
test('Strong/Toughは技装、Weak/Delicateは技のみ。計算結果は無変更',()=>{
 const result=Object.fromEntries(['strong','tough','weak','delicate'].map(id=>[id,{skill:[{name:'技',value:2}],equipment:[{name:'装備',value:9}]}])),before=structuredClone(result),html=abilitySourcesHtml(result);
 for(const id of ['weak','delicate']){const part=html.split(`data-ability="${id}"`)[1].split('</details>')[0];assert.match(part,/技 2/);assert.doesNotMatch(part,/装 9|装：装備|装備：9/);}
 for(const id of ['strong','tough'])assert.match(html.split(`data-ability="${id}"`)[1].split('</details>')[0],/装 9/);
 assert.deepEqual(result,before);
});
test('デン一覧は日英同一行・資源非表示、データは維持',()=>{
 const before=structuredClone(denUpgrades),s={denUpgrades:denUpgrades.map(v=>({id:v.id,choice:null}))};
 for(const html of [denUpgradePicker(s),denUpgradeList(s)]){assert.doesNotMatch(html,/den-cost|労働力|資材/);assert.match(html,/錬金術研究室 \/ <span/);}
 assert.deepEqual(denUpgrades,before);
});
