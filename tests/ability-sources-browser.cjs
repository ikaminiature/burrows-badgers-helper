const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {enableRosterEditing}=require('./support/roster.cjs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try {
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TEST_URL||'http://127.0.0.1:5173');await page.getByRole('heading',{name:'冒険の準備'}).waitFor();
 const {stats,emptyBandStatus,startGame}=await import('../src/model.js');
 const {parseEquipmentCatalog}=await import('../src/equipment.js');
 const catalog=parseEquipmentCatalog(JSON.parse(fs.readFileSync('data/bb2_general_store_ja_en.json')));
 const c={id:'c',name:'値の出所確認',species:'旧種族',level:6,fate:2,experience:3,photo:'data:image/png;base64,'+fs.readFileSync('icon-192.png').toString('base64'),stats:Object.fromEntries(stats.map(s=>[s,'D10'])),equipment:'旧装備は保持',skills:'旧スキル原文',spells:'呪文原文',notes:'保持するメモ',skillEntries:['Strong (2)','Tough (1)','Weak (1)','Delicate (2)'],equipmentSlots:{weapon1:'角の粉',weapon2:'両手武器',armour1:'ヘビーアーマー',armour2:'ヘビーシールド',item:'自由な品',special:''},equipmentSelections:{weapon1:catalog[59],weapon2:catalog[1],armour1:catalog[18],armour2:catalog[21]}};
 const other={...structuredClone(c),id:'other',name:'別キャラクター',skillEntries:['Strong (1)'],equipmentSlots:{weapon1:'ポールアーム',weapon2:'',armour1:'',armour2:'',item:'',special:''}};delete other.equipmentSelections;
 const w={id:'w',name:'値の出所テスト',status:emptyBandStatus(),characters:[c,other]},data={version:2,warbands:[w],game:startGame(w),recentEquipmentIds:['general-store-060','general-store-010']};
 data.game.round=4;data.game.characters[0].wounds=8;
 await page.evaluate(d=>new Promise(resolve=>{const r=indexedDB.open('bb-helper',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('data','readwrite');tx.objectStore('data').put(d,'app');tx.oncomplete=()=>{db.close();resolve();};};}),data);await page.reload();
 const group=page.locator('.ability-sources[data-character-id="c"]'),second=page.locator('.ability-sources[data-character-id="other"]');
 const source=id=>group.locator('.ability-source[data-ability="'+id+'"]'),summary=id=>source(id).locator(':scope > summary');
 const card=page.locator('.roster-card').filter({has:group});
 async function roster(){await page.getByRole('link',{name:'ウォーバンド',exact:true}).click();await page.getByRole('button',{name:'開く',exact:true}).click();}
 async function edit(){await enableRosterEditing(page);await card.getByRole('button',{name:'編集',exact:true}).click();assert.equal(await page.locator('#modal .ability-sources').count(),0);assert.equal(await page.locator('#modal .ability-source').count(),0);}
 async function save(){await page.getByRole('button',{name:'保存',exact:true}).click();await page.locator('#modal').waitFor({state:'hidden'});await page.locator('#save-status').filter({hasText:'端末に保存済み'}).waitFor();}
 async function read(){return page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('bb-helper',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('data'),q=tx.objectStore('data').get('app');q.onsuccess=()=>resolve(q.result);tx.oncomplete=()=>db.close();};}));}
 async function picker(name){await page.getByRole('button',{name:name+'の装備を検索',exact:true}).click();await page.locator('#equipment-result-status').filter({hasText:/件/}).waitFor();}
 async function pick(id){await page.locator('.equipment-option[data-equipment-id="'+id+'"]').getByRole('button',{name:'選ぶ',exact:true}).click();}
 await roster();
 assert.equal(await page.locator('.roster-card .ability-sources').count(),2);assert.equal(await group.locator('.ability-source').count(),4);
 assert.ok(await group.evaluate(el=>el.previousElementSibling.classList.contains('card-stats')&&el.nextElementSibling.dataset.action==='character-panel'));
 await summary('strong').getByText('技 2',{exact:true}).waitFor();await summary('strong').getByText('装 3※',{exact:true}).waitFor();
 await summary('tough').getByText('技 1',{exact:true}).waitFor();await summary('tough').getByText('装 複数',{exact:true}).waitFor();
 await summary('weak').getByText('技 1',{exact:true}).waitFor();assert.doesNotMatch(await source('weak').innerText(),/装/);await summary('delicate').getByText('技 2',{exact:true}).waitFor();
 await second.locator('[data-ability="strong"] > summary').getByText('技 1',{exact:true}).waitFor();await second.locator('[data-ability="strong"] > summary').getByText('装 1※',{exact:true}).waitFor();
 await summary('tough').click();await source('tough').getByText('鎧1：ヘビーアーマー：2',{exact:true}).waitFor();await source('tough').getByText('鎧2：ヘビーシールド：1',{exact:true}).waitFor();await summary('tough').click();
 assert.equal(await group.locator('input').count(),0);assert.equal(await card.locator('.character-extra').isVisible(),false);
 for(const mode of ['view','edit']) {
  if(mode==='edit')await enableRosterEditing(page);
  assert.equal(await group.isVisible(),true);
  for(const scheme of ['light','dark']) {
   await page.emulateMedia({colorScheme:scheme});
   for(const width of [320,375,390]) {
    await page.setViewportSize({width,height:844});await group.scrollIntoViewIfNeeded();
    const boxes=await group.locator('.ability-source > summary').evaluateAll(nodes=>nodes.map(el=>({y:el.getBoundingClientRect().y,overflow:el.scrollWidth>el.clientWidth})));
    assert.equal(new Set(boxes.map(b=>b.y)).size,1);assert.ok(boxes.every(b=>!b.overflow));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   }
   await card.screenshot({path:'/tmp/roster-ability-'+mode+'-'+scheme+'.png'});
  }
 }
 await page.emulateMedia({colorScheme:'light'});assert.deepEqual(await read(),data);
 await edit();assert.equal(await page.getByRole('textbox',{name:'武器1',exact:true}).inputValue(),'角の粉');
 const expected=[['武器1',17,['weapon']],['武器2',17,['weapon']],['鎧1',6,['armour']],['鎧2',6,['armour']],['アイテム',73,['item','ingredient','bonded_critter','stag_beetle_grub']],['スペシャル',96,Object.keys((await import('../src/equipment.js')).equipmentCategoryLabels)]];
 for(const [label,count,categories] of expected) {
  await picker(label);assert.equal(await page.locator('.equipment-option').count(),count);assert.equal(await page.getByRole('combobox',{name:'カテゴリ',exact:true}).isVisible(),label==='スペシャル');
  const ids=await page.locator('.equipment-option').evaluateAll(nodes=>nodes.map(n=>n.dataset.equipmentId));assert.ok(ids.every(id=>categories.includes(catalog.find(i=>i.id===id).category)));
  if(label==='武器1'){assert.equal(ids[0],'general-store-010');await page.locator('#equipment-query').fill('Antler dust');assert.equal(await page.locator('.equipment-option').count(),0);}
  if(label==='アイテム'){await page.locator('#equipment-query').fill('角の粉');await page.locator('.equipment-option[data-equipment-id="general-store-060"]').waitFor();await page.locator('#equipment-query').fill('Two-handed');assert.equal(await page.locator('.equipment-option').count(),0);}
  if(label==='スペシャル'){await page.getByRole('combobox',{name:'カテゴリ',exact:true}).selectOption('ingredient');assert.equal(await page.locator('.equipment-option').count(),31);await page.locator('#equipment-query').fill('Powdered acorns');await page.locator('.equipment-option[data-equipment-id="general-store-082"]').waitFor();}
  await page.getByRole('button',{name:'装備検索を閉じる',exact:true}).click();
 }
 await page.getByRole('button',{name:'キャンセル',exact:true}).click();assert.deepEqual(await read(),data);await summary('strong').getByText('技 2',{exact:true}).waitFor();
 await edit();await page.getByRole('textbox',{name:'スキル 1',exact:true}).fill('Strong (4)');
 await page.getByRole('button',{name:'＋ スキル',exact:true}).click();await page.getByRole('textbox',{name:'スキル 5',exact:true}).fill('ストロング（1）');await save();await summary('strong').getByText('技 複数',{exact:true}).waitFor();
 await edit();await page.getByRole('button',{name:'スキル 5 を削除',exact:true}).click();await page.getByRole('button',{name:'武器2を未装備にする',exact:true}).click();await save();await summary('strong').getByText('技 4',{exact:true}).waitFor();await summary('strong').getByText('装 —',{exact:true}).waitFor();
 await edit();await picker('武器2');await page.locator('#equipment-query').fill('Pole-arm');await pick('general-store-003');await save();await summary('strong').getByText('装 1※',{exact:true}).waitFor();
 await edit();await page.getByRole('textbox',{name:'武器2',exact:true}).fill('独自の武器');await save();await summary('strong').getByText('装 —',{exact:true}).waitFor();
 await edit();await page.getByRole('textbox',{name:'武器2',exact:true}).fill('両手武器');await page.getByRole('button',{name:'鎧2を未装備にする',exact:true}).click();await save();await summary('strong').getByText('装 3※',{exact:true}).waitFor();await summary('tough').getByText('装 2',{exact:true}).waitFor();
 await page.getByRole('button',{name:'編集を終了',exact:true}).click();await summary('strong').getByText('技 4',{exact:true}).waitFor();await second.locator('[data-ability="strong"] > summary').getByText('技 1',{exact:true}).waitFor();
 await page.reload();await roster();await summary('strong').getByText('技 4',{exact:true}).waitFor();await summary('strong').getByText('装 3※',{exact:true}).waitFor();
 await page.getByRole('link',{name:'ホーム',exact:true}).click();const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'JSON を書き出す'}).click()]);
 const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'bb-ability-sources-')),'backup.json');await download.saveAs(file);const exported=JSON.parse(fs.readFileSync(file)),saved=exported.warbands[0].characters[0];
 assert.deepEqual(exported.game,data.game);assert.equal(saved.equipmentSlots.weapon1,'角の粉');assert.equal(saved.equipmentSelections.weapon1.id,'general-store-060');assert.deepEqual(exported.warbands[0].characters[1],other);
 for(const key of ['photo','stats','fate','experience','skills','spells','notes','equipment'])assert.deepEqual(saved[key],c[key]);assert.equal(Object.hasOwn(saved,'abilitySources'),false);assert.ok(!JSON.stringify(saved).includes('スキル・装備由来'));
 await page.locator('#restore-file').setInputFiles(file);await page.getByRole('button',{name:'確認して実行'}).click();await page.locator('#modal').waitFor({state:'hidden'});await page.reload();await roster();await summary('strong').getByText('技 4',{exact:true}).waitFor();
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await context.setOffline(true);await page.reload();await roster();await summary('strong').getByText('装 3※',{exact:true}).waitFor();await second.locator('[data-ability="strong"] > summary').getByText('装 1※',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS: per-character source values below 9 stats in view/edit roster cards, absent in editor, 320px/light/dark, saved edits refresh cards, separate legacy characters, slot scopes, no derived persistence, JSON/photo/game/offline');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
