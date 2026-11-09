const {openPanel,closePanel}=require('./support/panel.cjs');
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {enableRosterEditing}=require('./support/roster.cjs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TEST_URL||'http://127.0.0.1:5173');await page.getByRole('heading',{name:'冒険の準備'}).waitFor();
 const {emptyBandStatus,startGame,stats}=await import('../src/model.js');
 const c={id:'c',name:'呪文テスト',species:'独自',level:6,fate:2,experience:3,photo:'data:image/png;base64,'+fs.readFileSync('icon-192.png').toString('base64'),stats:Object.fromEntries(stats.map(s=>[s,'D10'])),equipment:'原文装備',skills:'Strong (1)',spells:'Heal\n自由な旧呪文',notes:'保持するメモ'};
 const w={id:'w',name:'呪文バンド',status:emptyBandStatus(),characters:[c]},data={version:2,warbands:[w],game:startGame(w)};
 data.game.characters[0].wounds=7;
 // Seed current-format fixtures with their calculated rating.
    data.warbands.forEach(w=>{w.status.rating=w.characters.reduce((sum,c)=>sum+c.level,0);});
    await page.evaluate(d=>new Promise(resolve=>{const r=indexedDB.open('bb-helper',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('data','readwrite');tx.objectStore('data').put(d,'app');tx.oncomplete=()=>{db.close();resolve();};};}),data);
 await page.reload();
 async function roster(){await closePanel(page);await page.getByRole('link',{name:'ウォーバンド',exact:true}).click();await page.getByRole('button',{name:'開く',exact:true}).click();}
 async function noInputFocus(button){
   await button.scrollIntoViewIfNeeded();
   await page.evaluate(()=>{window.characterFocusEvents=[];document.addEventListener('pointerdown',()=>{window.characterOpenScroll={x:scrollX,y:scrollY};},{once:true});document.addEventListener('focusin',e=>{if(e.target.matches('#character-form input,#character-form textarea,#character-form select'))window.characterFocusEvents.push(e.target.tagName);});});
   await button.click();
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   assert.deepEqual(await page.evaluate(()=>window.characterFocusEvents),[]);
   assert.equal(await page.evaluate(()=>document.activeElement.tagName),'H2');
   assert.equal(await page.locator('#modal').evaluate(n=>n.scrollTop),0);
   assert.deepEqual(await page.evaluate(()=>({x:scrollX,y:scrollY})),await page.evaluate(()=>window.characterOpenScroll));
   await page.getByRole('textbox',{name:'名前',exact:true}).tap();
   assert.equal(await page.locator('#character-form input[name=name]').evaluate(n=>n===document.activeElement),true);
 }
 async function edit(){await closePanel(page);await enableRosterEditing(page);await noInputFocus(page.getByRole('button',{name:'編集',exact:true}));}
 async function saved(){await page.locator('#save-status').filter({hasText:'端末に保存済み'}).waitFor();}
 await roster();
 await noInputFocus(page.getByRole('button',{name:'＋ キャラクター登録',exact:true}));
 await page.getByRole('button',{name:'キャンセル',exact:true}).click();
 await edit();
 // Unrelated saves preserve old field absence and original strings.
 await page.getByRole('button',{name:'保存',exact:true}).click();await saved();
 const untouched = await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('bb-helper',1);r.onsuccess=()=>{const db=r.result,t=db.transaction('data'),q=t.objectStore('data').get('app');q.onsuccess=()=>resolve(q.result.warbands[0].characters[0]);t.oncomplete=()=>db.close();};}));
 assert.equal(Object.hasOwn(untouched,'spellSelections'),false);assert.equal(untouched.spells,c.spells);
 await edit();
 assert.equal(await page.getByRole('textbox',{name:'呪文 1',exact:true}).inputValue(),'Heal');
 await page.locator('#spell-picker summary').first().click();assert.equal(await page.locator('.spell-option').count(),76);assert.equal(await page.locator('#spell-element').isVisible(),false);
 await page.locator('#spell-archetype').selectOption('elementalism');assert.equal(await page.locator('#spell-element').isVisible(),true);assert.equal(await page.locator('.spell-option').count(),8);
 await page.locator('#spell-element').selectOption('水');assert.equal(await page.locator('.spell-option').count(),2);
 assert.equal(await page.locator('#spell-query').count(),0);assert.equal(await page.locator('#spell-picker input').count(),0);
 await page.getByRole('button',{name:'豪雨を追加',exact:true}).click();
 await page.locator('#spell-archetype').selectOption('channelling');assert.equal(await page.locator('.spell-option').count(),6);
 const crushOption=page.locator('.spell-option').filter({has:page.getByRole('button',{name:'粉砕を追加',exact:true})});await crushOption.locator('summary').click();await crushOption.getByText('浅い働き',{exact:true}).waitFor();await crushOption.getByText('深い働き',{exact:true}).waitFor();
 await page.getByRole('button',{name:'粉砕を追加',exact:true}).click();
 await page.getByRole('button',{name:'＋ 呪文',exact:true}).click();await page.getByRole('textbox',{name:'呪文 5',exact:true}).fill('<独自呪文>');
 await page.getByRole('button',{name:'呪文 2 を削除',exact:true}).click();
 await page.getByRole('button',{name:'保存',exact:true}).click();await saved();await page.reload();await roster();
 await openPanel(page,null,'呪文');
 const cards=page.locator('.character-extra .spell-details');assert.equal(await cards.count(),4);
 assert.deepEqual(await cards.evaluateAll(ns=>ns.map(n=>n.open)),[false,false,false,false]);
 const heal=cards.filter({hasText:'ヒール'}),crush=cards.filter({hasText:'粉砕'});
 const closed=await heal.evaluate(n=>getComputedStyle(n).backgroundColor);
 await heal.locator('summary').click();await crush.locator('summary').click();
 assert.notEqual(await heal.evaluate(n=>getComputedStyle(n).backgroundColor),closed);assert.equal(await crush.evaluate(n=>n.open),true);
 await heal.getByText('難易度',{exact:true}).waitFor();await heal.getByText('素材と使用時の効果',{exact:true}).waitFor();
 await cards.last().locator('summary').click();await cards.last().getByText(/未確認/).waitFor();
 for(const mode of ['light','dark']){await page.emulateMedia({colorScheme:mode});for(const width of [320,375,390]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}await page.screenshot({path:`/tmp/bb-spells-${mode}.png`,fullPage:true});}
 await heal.locator('summary').click();assert.equal(await heal.evaluate(n=>n.open),false);assert.equal(await crush.evaluate(n=>n.open),true);
 await edit();await page.getByRole('textbox',{name:'呪文 3',exact:true}).fill('粉砕の独自メモ');await page.getByRole('button',{name:'保存',exact:true}).click();await saved();
 await page.getByRole('link',{name:'ホーム',exact:true}).click();
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'JSON を書き出す'}).click()]);
 const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'bb-spells-')),'backup.json');await download.saveAs(file);
 const exported=JSON.parse(fs.readFileSync(file)),sc=exported.warbands[0].characters[0];
 assert.equal(sc.spells,c.spells);assert.equal(sc.photo,c.photo);assert.equal(sc.equipment,c.equipment);assert.equal(sc.skills,c.skills);assert.deepEqual(sc.stats,c.stats);assert.deepEqual(exported.game,data.game);
 assert.deepEqual(sc.spellEntries,['Heal','豪雨','粉砕の独自メモ','<独自呪文>']);assert.deepEqual(sc.spellSelections,[{id:'spell-light-heal'},{id:'spell-elementalism-downpour'},null,null]);
 await page.locator('#restore-file').setInputFiles(file);await page.getByRole('button',{name:'確認して実行'}).click();await page.locator('#modal').waitFor({state:'hidden'});await page.reload();await roster();await edit();assert.equal(await page.getByRole('textbox',{name:'呪文 2',exact:true}).inputValue(),'豪雨');await page.getByRole('button',{name:'キャンセル',exact:true}).click();
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await context.setOffline(true);await page.reload();await roster();await edit();await page.locator('#spell-picker summary').first().click();await page.locator('#spell-archetype').selectOption('necromancy');await page.getByRole('button',{name:'呼び戻しを追加',exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: 76 spells, archetype/element selection without text search, CRUD, free text, independent tinted details, 320px light/dark, JSON/photos/battle isolation and offline');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
