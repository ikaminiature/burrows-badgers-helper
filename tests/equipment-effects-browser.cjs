const {openPanel,closePanel}=require('./support/panel.cjs');
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
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
 const selection=Object.fromEntries([['weapon1',10],['armour1',19],['item',60],['special',82]].map(([k,n])=>[k,catalog[n-1]]));
 const c={id:'c',name:'装備参照の長いキャラクター名',species:'種族を維持',level:6,fate:2,experience:3,photo:'data:image/png;base64,'+fs.readFileSync('icon-192.png').toString('base64'),stats:Object.fromEntries(stats.map(s=>[s,'D10'])),equipment:'旧装備の原文',skills:'旧スキル',spells:'旧呪文',notes:'メモ',equipmentSlots:{weapon1:'ピストル',weapon2:'自由な剣',armour1:'ヘビーアーマー',armour2:'',item:'角の粉',special:'粉末ドングリ'},equipmentSelections:selection};
 const w={id:'w',name:'装備効果確認',status:emptyBandStatus(),characters:[c]},data={version:2,warbands:[w],game:startGame(w)};
 data.game.round=3;data.game.characters[0].wounds=6;
 // Seed current-format fixtures with their calculated rating.
    data.warbands.forEach(w=>{w.status.rating=w.characters.reduce((sum,c)=>sum+c.level,0);});
    await page.evaluate(d=>new Promise(resolve=>{const r=indexedDB.open('bb-helper',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('data','readwrite');tx.objectStore('data').put(d,'app');tx.oncomplete=()=>{db.close();resolve();};};}),data);
 await page.reload();
 async function roster(){await closePanel(page);await page.getByRole('link',{name:'ウォーバンド',exact:true}).click();await page.getByRole('button',{name:'開く',exact:true}).click();}
 async function edit(){await closePanel(page);await enableRosterEditing(page);await page.getByRole('button',{name:'編集',exact:true}).click();}
 async function saved(){await page.locator('#save-status').filter({hasText:'端末に保存済み'}).waitFor();}
 async function read(){return page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('bb-helper',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('data');const get=tx.objectStore('data').get('app');get.onsuccess=()=>resolve(get.result);tx.oncomplete=()=>db.close();};}));}
 await roster();await openPanel(page);
 const panel=page.locator('.character-extra');assert.equal(await panel.locator('.equipment-details').count(),4);
 assert.deepEqual(await panel.locator('.equipment-details').evaluateAll(nodes=>nodes.map(n=>n.open)),[false,false,false,false]);
 const pistol=panel.locator('[data-reference-id="general-store-010"]');
 await pistol.locator(':scope > summary').getByText('ピストル（12″）',{exact:true}).waitFor();await pistol.getByText('Pistol',{exact:true}).waitFor();
 await pistol.locator(':scope > summary').click();await pistol.getByText(/ピストルによる射撃はストロング/).waitFor();
 const slow=pistol.locator('.equipment-shared-rule').filter({hasText:'Slow／スロウ'});await slow.locator('summary').click();await slow.getByText(/再装填しなければ/).waitFor();
 assert.equal(await panel.locator('[data-reference-id="general-store-019"]').getAttribute('open'),null);
 await panel.getByText('自由な剣',{exact:true}).waitFor();
 for(const id of ['060','082']) {const node=panel.locator('[data-reference-id="general-store-'+id+'"]');await node.locator(':scope > summary').click();const materials=node.locator('.equipment-shared-rule').filter({hasText:'魔法使いのポーチと素材'});await materials.locator('summary').click();await materials.getByText(/最大6個/).waitFor();}
 assert.deepEqual(await read(),data); // Viewing references must never migrate or save data.
 await closePanel(page);
 // UI-only states: separate equipment colors and persistent editing indicator.
 async function colors(node){return node.evaluate(el=>{const c=getComputedStyle(el);return {bg:c.backgroundColor,fg:c.color};});}
 function contrast({bg,fg}) {
  const luminance = color => {const rgb=color.match(/[\d.]+/g).slice(0,3).map(n=>Number(n)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
  const a=luminance(bg),b=luminance(fg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
 }
 assert.equal(await page.getByRole('button',{name:'備考',exact:true}).count(),0);
 for(const scheme of ['light','dark']) {
  await page.emulateMedia({colorScheme:scheme});
  const header=page.locator('body > header'), original=await colors(header);
  await page.getByRole('button',{name:'編集モード',exact:true}).click();
  await page.getByRole('button',{name:'編集を終了',exact:true}).waitFor();
  await page.locator('#editing-indicator').getByText('編集中',{exact:true}).waitFor();
  for(const width of [320,390]) {await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  const editingColor=await colors(header);assert.notEqual(editingColor.bg,original.bg);assert.ok(contrast(editingColor)>=4.5);
  await openPanel(page);
  const rows=page.locator('#character-panel .equipment-detail-grid > div'), firstRow=rows.nth(0), armourRow=rows.nth(2), normal=(await colors(firstRow)).bg;
  await firstRow.locator('.equipment-details > summary').click();
  await armourRow.locator('.equipment-details > summary').click();
  const expanded=await colors(firstRow);assert.notEqual(expanded.bg,normal);assert.equal((await colors(armourRow)).bg,expanded.bg);assert.notEqual(expanded.bg,editingColor.bg);assert.ok(contrast(expanded)>=4.5);
  assert.equal(await panel.locator('summary').filter({hasText:/^装備枠$/}).count(),0);
  await firstRow.locator('.equipment-details > summary').click();assert.equal((await colors(firstRow)).bg,normal);assert.equal((await colors(armourRow)).bg,expanded.bg);
  await closePanel(page);
  await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));
  assert.ok(Math.abs((await header.boundingBox()).y)<1);
  assert.ok(await page.locator('#editing-indicator').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));
  await page.screenshot({path:'/tmp/equipment-edit-'+scheme+'.png'});
  await page.getByRole('button',{name:'編集を終了',exact:true}).click();
  assert.equal(await page.locator('#editing-indicator').isVisible(),false);assert.equal((await colors(header)).bg,original.bg);
  assert.deepEqual(await read(),data);
 }
 await page.emulateMedia({colorScheme:'light'});

 await edit();await page.getByRole('button',{name:'武器1の装備を検索',exact:true}).click();
 await page.locator('.equipment-option').first().waitFor();assert.equal(await page.locator('.equipment-option').count(),17);
 const q=page.locator('#equipment-query');
 // Variable range and multi-page tables are available from the candidate disclosure.
 await q.fill('Cheirosiphon');const siphon=page.locator('.equipment-option[data-equipment-id="general-store-014"]');
 const candidateNormal=(await colors(siphon)).bg;
 await siphon.locator('.equipment-details > summary').click();assert.notEqual((await colors(siphon)).bg,candidateNormal);await siphon.getByText(/大胆不敵が必要/).waitFor();
 await siphon.getByRole('heading',{name:'カイロサイフォンの射撃方式',exact:true}).waitFor();await siphon.getByText(/d20\+7/).waitFor();
 await siphon.locator('.equipment-details > summary').click();assert.equal((await colors(siphon)).bg,candidateNormal);
 await page.getByRole('button',{name:'装備検索を閉じる',exact:true}).click();
 const slot=page.locator('#magic-editor-weapon1');await page.locator('.magic-slot-editor').filter({hasText:'武器1の魔法効果を設定'}).locator(':scope > summary').click();
 await slot.getByRole('button',{name:'＋ 魔法効果',exact:true}).click();await slot.locator('[data-magic-id="0"]').selectOption('magic-effect-smiting');await slot.locator('[data-magic-bonus="0"]').fill('3');
 await slot.getByRole('button',{name:'＋ 魔法効果',exact:true}).click();await slot.locator('[data-magic-id="1"]').selectOption('magic-effect-flame');
 assert.equal(await slot.locator('[data-magic-bonus="1"]').count(),0);
 await slot.getByRole('button',{name:'＋ 魔法効果',exact:true}).click();
 await slot.getByRole('button',{name:'武器1の魔法効果 3 を削除',exact:true}).click();
 assert.equal(await slot.locator('.magic-entry').count(),2);
 await slot.locator('[data-magic-notes]').fill('手動で登録した補足');
 await page.getByRole('button',{name:'スペシャルの装備を検索',exact:true}).click();await page.locator('#equipment-source').selectOption('special');
 assert.equal(await page.locator('.equipment-option').count(),12);
 await q.fill('Serpent');const serpent=page.locator('.equipment-option[data-equipment-id="special-magic-serpents-ring"]');
 await serpent.getByText('蛇の指輪',{exact:true}).waitFor();await serpent.locator('.equipment-details > summary').click();await serpent.getByText(/使用者はd6点/).waitFor();
 await serpent.getByRole('button',{name:'選ぶ',exact:true}).click();
 await page.getByRole('button',{name:'保存',exact:true}).click();await saved();
 await page.reload();await roster();await openPanel(page);
 const magic=page.locator('.equipment-detail-grid .equipment-magic-details');await magic.locator(':scope > summary').click();await magic.locator('summary').filter({hasText:'討伐'}).click();await magic.getByText(/白兵武器なら/).waitFor();await magic.getByText('手動で登録した補足',{exact:true}).waitFor();
 for(const width of [320,375,390]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await page.setViewportSize({width:375,height:844});await page.screenshot({path:'/tmp/equipment-effects-mobile.png',fullPage:true});
 await closePanel(page);await page.getByRole('link',{name:'ホーム',exact:true}).click();const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'JSON を書き出す'}).click()]);
 const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'bb-equipment-effects-')),'backup.json');await download.saveAs(file);const exported=JSON.parse(fs.readFileSync(file)),stored=exported.warbands[0].characters[0];
 assert.equal(stored.equipmentSelections.weapon1.id,'general-store-010');assert.equal(stored.equipmentSelections.special.id,'special-magic-serpents-ring');
 assert.deepEqual(stored.equipmentMagic.weapon1,{effects:[{id:'magic-effect-smiting',bonus:3},{id:'magic-effect-flame',bonus:null}],notes:'手動で登録した補足'});
 assert.ok(!JSON.stringify(exported).includes('希少で異国的な複数の蛇'));assert.ok(!JSON.stringify(exported).includes('白兵武器なら'));
 for(const key of ['photo','stats','skills','spells','fate','experience','level','notes','equipment']) assert.deepEqual(stored[key],c[key]);
 assert.deepEqual(exported.game,data.game);
 await page.locator('#restore-file').setInputFiles(file);await page.getByRole('button',{name:'確認して実行'}).click();await page.locator('#modal').waitFor({state:'hidden'});await page.reload();await roster();await edit();
 assert.equal(await page.getByRole('textbox',{name:'武器1',exact:true}).inputValue(),'ピストル');
 assert.equal(await page.locator('#magic-editor-weapon1 [data-magic-bonus="0"]').inputValue(),'3');
 await page.getByRole('button',{name:'武器1を未装備にする',exact:true}).click();assert.equal(await page.locator('#magic-editor-weapon1 .magic-entry').count(),0);
 await page.getByRole('button',{name:'キャンセル',exact:true}).click();
 assert.deepEqual((await read()).warbands[0].characters[0],stored);
 await page.getByRole('link',{name:'戦闘',exact:true}).click();await page.locator(".gauge").first().waitFor();
  assert.equal(await page.locator(".gauge").locator(".filled").count(),6);
 await openPanel(page);assert.equal(await page.locator('#character-panel .character-extra .equipment-magic-details').count(),0);await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await context.setOffline(true);await page.reload();await roster();await edit();await page.getByRole('button',{name:'スペシャルの装備を検索',exact:true}).click();
 await page.locator('#equipment-source').selectOption('special');await q.fill('抵抗の指輪');await page.locator('.equipment-option').getByText('抵抗の指輪',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS: 96 unchanged catalog + 12 magic, independent default-closed bilingual/range/effect references, shared rules and tables, numeric manual effects, JSON/photo/legacy/game isolation, 320px/offline');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
