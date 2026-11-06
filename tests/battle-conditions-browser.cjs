const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Stress startup without changing production assets. A slow IndexedDB read
 // must not let an assertion run before the battle snapshot has rendered.
 const readDelay=Number(process.env.TEST_DELAY_DB_READ_MS||0);
 if(readDelay){
   assert.ok(Number.isSafeInteger(readDelay)&&readDelay>0&&readDelay<=2000);
   await page.addInitScript(delay=>{
     const get=IDBObjectStore.prototype.get;
     IDBObjectStore.prototype.get=function(...args){
       const request=get.apply(this,args);
       if(this.name==='data'&&args[0]==='app')request.addEventListener('success',event=>{
         if(!event.isTrusted)return;
         event.stopImmediatePropagation();
         setTimeout(()=>request.dispatchEvent(new Event('success')),delay);
       });
       return request;
     };
   },readDelay);
 }

 await page.goto(process.env.TEST_URL||'http://127.0.0.1:5173');await page.getByRole('heading',{name:'冒険の準備'}).waitFor();
 const {stats,startGame,emptyBandStatus}=await import('../src/model.js');
 const c={id:'c',name:'アッシュ',species:'マウス',role:'leader',level:6,fate:2,experience:3,photo:'data:image/png;base64,'+fs.readFileSync('icon-192.png').toString('base64'),stats:Object.fromEntries(stats.map(s=>[s,'D10'])),equipment:'旧装備',equipmentSlots:{weapon1:'両手武器',weapon2:'',armour1:'ライトアーマー',armour2:'',item:'',special:''},skills:'Strong (2)',spells:'Heal',notes:'元のメモ'};
 const {parseEquipmentCatalog}=await import('../src/equipment.js');const catalog=parseEquipmentCatalog(JSON.parse(fs.readFileSync('data/bb2_general_store_ja_en.json')));c.equipmentSelections={weapon1:catalog[1],armour1:catalog[17]};c.equipmentSlots.weapon1=catalog[1].nameJa;c.equipmentSlots.armour1=catalog[17].nameJa;
 const w={id:'w',name:'戦闘テスト',status:emptyBandStatus(),characters:[c,{...structuredClone(c),id:'d',name:'バーチ',role:'none',photo:''}]};
 const data={version:2,warbands:[w],game:startGame(w)};delete data.game.vp;delete data.game.sideQuests;data.game.characters[0].effects=[{id:'old-effect',name:'自由な状態',description:'保持する説明'}];
 await page.evaluate(d=>new Promise(resolve=>{const r=indexedDB.open('bb-helper',1);r.onsuccess=()=>{const db=r.result,t=db.transaction('data','readwrite');t.objectStore('data').put(d,'app');t.oncomplete=()=>{db.close();resolve();};};}),data);
 await page.reload();await page.getByRole('link',{name:'戦闘',exact:true}).click();
 const card=page.locator('.battle[data-character-id="c"]');
 // Reload completes before app.js has necessarily finished reading IndexedDB.
 // Keep the photo expectation: wait for the snapshot, then verify the real image.
 await card.getByRole('heading',{name:c.name,exact:true}).waitFor();
 await card.locator('img').waitFor();
 assert.equal(await card.locator('img').getAttribute('src'),c.photo);
 await card.locator('img').evaluate(img=>img.decode());
 assert.equal(await card.locator('img').count(),1);await card.getByText('Lv. 06',{exact:true}).waitFor();assert.equal(await card.locator('.card-stats [aria-label]').count(),9);
 assert.equal(await page.locator('#battle-vp').textContent(),'0');assert.equal(await page.getByRole('button',{name:'VPを1減らす',exact:true}).isDisabled(),true);
 await card.locator('.ability-sources').getByText('ストロング',{exact:true}).waitFor();
 assert.equal(await card.locator('.gauge .filled').count(),0);assert.equal(await card.locator('.gauge .pip').count(),17);
 assert.doesNotMatch(await card.innerText(),/ペナルティ|未行動|0\s*\/\s*17/);
 assert.equal(await card.getByRole('checkbox',{name:'行動済み',exact:true}).isChecked(),false);
 await card.getByRole('button',{name:'装備・スキル・呪文を表示',exact:true}).click();
 const extras=card.locator('.character-extra');await extras.locator('.equipment-details > summary').first().click();await extras.locator('.skill-detail summary').click();await extras.locator('.spell-details summary').click();
 assert.ok(await extras.locator('details[open]').count()>=3);
 await card.locator('.condition-picker > summary').click();const labels=['スニーク','バーサーク','朦朧','麻痺','炎上','盲目'];
 for(const name of labels)await card.locator('.condition-picker').getByRole('checkbox',{name,exact:true}).check();
 await page.locator('#save-status').filter({hasText:'端末に保存済み'}).waitFor();
 const selectedSnapshot=await page.evaluate(()=>new Promise((resolve,reject)=>{
   const r=indexedDB.open('bb-helper',1);
   r.onerror=()=>reject(r.error);
   r.onsuccess=()=>{const db=r.result,q=db.transaction('data').objectStore('data').get('app');
     q.onsuccess=()=>{resolve(q.result);db.close();};q.onerror=()=>{reject(q.error);db.close();};};
 }));
 assert.deepEqual(selectedSnapshot.game.characters[0].conditions,['sneaking','berserk','stunned','paralysed','burning','blinded']);
 assert.deepEqual(selectedSnapshot.warbands,data.warbands);
 assert.equal(selectedSnapshot.game.characters[1].conditions,undefined);
 assert.deepEqual(selectedSnapshot.game.characters[0].effects,data.game.characters[0].effects);
 assert.equal(await card.locator('.condition-option.is-selected').count(),6);assert.equal(await card.locator('.condition-picker').evaluate(n=>n.open),true);
 const stunned=card.locator('[data-condition-id="stunned"]'),burning=card.locator('[data-condition-id="burning"]');
 const closed=await stunned.evaluate(n=>getComputedStyle(n).backgroundColor);
 await stunned.locator('summary').click();await burning.locator('summary').click();assert.notEqual(await stunned.evaluate(n=>getComputedStyle(n).backgroundColor),closed);
 await stunned.getByText(/Fortitude.*2個/).waitFor();await burning.getByText(/出目が6/).waitFor();
 await card.getByRole('checkbox',{name:'麻痺',exact:true}).uncheck();assert.equal(await card.locator('.condition-option.is-selected').count(),5);assert.equal(await stunned.evaluate(n=>n.open),true);
 assert.equal(await card.locator('.condition-picker').getByRole('checkbox',{name:'麻痺',exact:true}).isChecked(),false);
 await card.locator('.condition-picker').getByRole('checkbox',{name:'スニーク',exact:true}).uncheck();
 await card.getByText('保持する説明',{exact:true}).waitFor();
 const editor=card.locator('.effect-editor');
 await editor.getByRole('textbox',{name:'自由登録の状態名',exact:true}).fill('追加メモ');await editor.getByRole('textbox',{name:'説明・メモ',exact:true}).fill('手動処理');await editor.getByRole('button',{name:'登録',exact:true}).click();
 await card.getByRole('button',{name:'自由な状態を編集',exact:true}).click();
 await editor.getByRole('textbox',{name:'自由登録の状態名',exact:true}).fill('編集した旧状態');await editor.getByRole('textbox',{name:'説明・メモ',exact:true}).fill('編集後の説明');await editor.getByRole('button',{name:'更新',exact:true}).click();
 await card.getByText('編集後の説明',{exact:true}).waitFor();
 await editor.getByRole('textbox',{name:'自由登録の状態名',exact:true}).fill('消すメモ');await editor.getByRole('button',{name:'登録',exact:true}).click();await card.getByRole('button',{name:'消すメモを削除',exact:true}).click();
 assert.equal(await card.getByText('消すメモ',{exact:true}).count(),0);
 await card.locator('.condition-picker > summary').click();
 assert.doesNotMatch(await card.innerText(),/バーサーク|朦朧|炎上|盲目|編集した旧状態|追加メモ/);
 assert.equal(await card.locator(':scope > .condition-list, :scope > .condition-detail').count(),0);
 assert.equal(await card.getByRole('button',{name:'キャラクター詳細',exact:true}).count(),0);
 await page.getByRole('button',{name:'VPを1増やす',exact:true}).click();await page.getByRole('button',{name:'VPを1増やす',exact:true}).click();await page.getByRole('button',{name:'VPを1減らす',exact:true}).click();assert.equal(await page.locator('#battle-vp').textContent(),'1');await page.getByRole('button',{name:'VPを1減らす',exact:true}).click();assert.equal(await page.locator('#battle-vp').textContent(),'0');assert.equal(await page.getByRole('button',{name:'VPを1減らす',exact:true}).isDisabled(),true);await page.getByRole('button',{name:'VPを1増やす',exact:true}).click();
 const quests=['遺跡を調べる\n撤退まで保持','長いサイドクエスト<&>を編集'];
 await page.getByRole('textbox',{name:'サイドクエスト1',exact:true}).fill(quests[0]);await page.getByRole('textbox',{name:'サイドクエスト2',exact:true}).fill(quests[1]);
 assert.equal(await page.locator('.battle-objectives input[type=checkbox]').count(),0);

 for(let i=0;i<4;i++)await card.getByRole('button',{name:'アッシュの負傷を1増やす',exact:true}).click();assert.equal(await card.locator('.gauge .filled').count(),4);
 await card.getByRole('checkbox',{name:'行動済み',exact:true}).check();assert.equal(await page.locator('.battle').last().getAttribute('data-character-id'),'c');assert.equal(await card.evaluate(n=>n.classList.contains('acted')),true);
 await page.getByRole('button',{name:'次のラウンド',exact:true}).click();await page.getByRole('button',{name:'確認して実行',exact:true}).click();assert.equal(await card.getByRole('checkbox',{name:'行動済み',exact:true}).isChecked(),false);assert.equal(await card.locator('.condition-option.is-selected').count(),4);
 for(const mode of ['light','dark']){await page.emulateMedia({colorScheme:mode});for(const width of [320,375,390]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}if(!await card.locator('.condition-picker').evaluate(n=>n.open))await card.locator('.condition-picker > summary').click();if(!await stunned.evaluate(n=>n.open))await stunned.locator('summary').click();assert.notEqual(await stunned.locator('..').evaluate(n=>getComputedStyle(n).backgroundColor),'rgba(0, 0, 0, 0)');await page.screenshot({path:`/tmp/bb-battle-${mode}.png`,fullPage:true});}
 await page.locator('#save-status').filter({hasText:'端末に保存済み'}).waitFor();await page.reload();await page.getByRole('link',{name:'戦闘',exact:true}).click();await card.waitFor();assert.equal(await card.locator('.condition-option.is-selected').count(),4);assert.equal(await page.locator('#battle-vp').textContent(),'1');assert.equal(await page.getByRole('textbox',{name:'サイドクエスト1',exact:true}).inputValue(),quests[0]);
 await card.getByRole('checkbox',{name:'アッシュの運命点 5',exact:true}).check();assert.equal(await card.getByRole('checkbox',{name:'アッシュの運命点 5',exact:true}).isChecked(),true);
 await page.getByRole('link',{name:'ホーム',exact:true}).click();const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'JSON を書き出す'}).click()]);const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'bb-conditions-')),'backup.json');await download.saveAs(file);
 const exported=JSON.parse(fs.readFileSync(file));assert.deepEqual(exported.warbands,data.warbands);assert.equal(exported.game.vp,1);assert.deepEqual(exported.game.sideQuests,quests);assert.equal(exported.game.characters[0].effects[0].id,'old-effect');assert.equal(exported.game.characters[0].effects[0].name,'編集した旧状態');assert.equal(exported.game.characters[0].wounds,4);assert.equal(exported.game.characters[0].fate,5);assert.equal(exported.game.characters[0].effects.length,2);assert.deepEqual(exported.game.characters[0].conditions,['berserk','stunned','burning','blinded']);
 await page.locator('#restore-file').setInputFiles(file);await page.getByRole('button',{name:'確認して実行'}).click();await page.locator('#modal').waitFor({state:'hidden'});await page.reload();await page.getByRole('link',{name:'戦闘',exact:true}).click();await card.waitFor();assert.equal(await card.locator('.condition-option.is-selected').count(),4);
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await context.setOffline(true);await page.reload();await page.getByRole('link',{name:'戦闘',exact:true}).click();await card.locator('.condition-picker > summary').click();await card.locator('[data-condition-id="stunned"] summary').click();await card.getByText(/Fortitude.*2個/).waitFor();
 assert.equal(await page.locator('#battle-vp').textContent(),'1');assert.equal(await page.getByRole('textbox',{name:'サイドクエスト2',exact:true}).inputValue(),quests[1]);
 await card.getByText('編集後の説明',{exact:true}).waitFor();
 await page.getByRole('link',{name:'ホーム',exact:true}).click();await page.getByRole('link',{name:'ゲームを開始',exact:true}).click();await page.getByRole('button',{name:'このウォーバンドで開始'}).click();await page.getByRole('button',{name:'確認して実行',exact:true}).click();await page.locator('#battle-vp').waitFor();assert.equal(await page.locator('#battle-vp').textContent(),'0');for(const name of ['サイドクエスト1','サイドクエスト2'])assert.equal(await page.getByRole('textbox',{name,exact:true}).inputValue(),'');assert.equal(await card.locator('.condition-option.is-selected').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: unified six-condition and free-note CRUD panel, no outside badges/detail button, VP bounds and two quests across round/reload/JSON/offline, legacy defaults/new-session reset, photo/wounds/fate/order and 320px light/dark');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
