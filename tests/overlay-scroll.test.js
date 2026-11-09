import test from 'node:test';import assert from 'node:assert/strict';import {canScrollAxis} from '../src/overlay-scroll.js';
test('スクロール範囲と方向を確認し、端から背景にスクロールを連鎖させない',()=>{
 assert.equal(canScrollAxis(0,100,400,20),true);assert.equal(canScrollAxis(0,100,400,-20),false);
 assert.equal(canScrollAxis(300,100,400,20),false);assert.equal(canScrollAxis(300,100,400,-20),true);
 assert.equal(canScrollAxis(120,100,400,-20),true);assert.equal(canScrollAxis(120,100,400,20),true);
 assert.equal(canScrollAxis(0,100,100,20),false);assert.equal(canScrollAxis(0,100,100,-20),false);assert.equal(canScrollAxis(120,100,400,0),false);
});
