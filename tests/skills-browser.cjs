const {openPanel,closePanel}=require('./support/panel.cjs');
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {enableRosterEditing}=require('./support/roster.cjs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try {
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TEST_URL||'http://127.0.0.1:5173');
 await page.getByRole('heading',{name:'冒険の準備'}).waitFor();
 const {emptyBandStatus,startGame,stats}=await import('../src/model.js');
 const c={id:'c',name:'スキル確認用の長いキャラクター名',species:'旧種族',level:6,fate:2,experience:3,photo:'data:image/png;base64,'+fs.readFileSync('icon-192.png').toString('base64'),stats:Object.fromEntries(stats.map(s=>[s,'D10'])),equipment:'旧装備',skills:'Strong (1)\n未知の技',spells:'自由呪文',notes:'保持するメモ'};
 const w={id:'w',name:'スキルテスト',status:emptyBandStatus(),characters:[c]}, data={version:2,warbands:[w],game:startGame(w)};
 data.game.characters[0].wounds=7;
 await page.evaluate(d=>new Promise(resolve=>{const r=indexedDB.open('bb-helper',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('data','readwrite');tx.objectStore('data').put(d,'app');tx.oncomplete=()=>{db.close();resolve();};};}),data);
 await page.reload();
 async function roster(){await closePanel(page);await page.getByRole('link',{name:'ウォーバンド',exact:true}).click();await page.getByRole('button',{name:'開く',exact:true}).click();}
 async function edit(){await closePanel(page);await enableRosterEditing(page);await page.getByRole('button',{name:'編集',exact:true}).click();}
 async function saved(){await page.locator('#save-status').filter({hasText:'端末に保存済み'}).waitFor();}
 await roster();await edit();
 assert.equal(await page.getByRole('textbox',{name:'スキル 1',exact:true}).inputValue(),'Strong (1)');
 await page.locator('#skill-picker summary').click();
 assert.equal(await page.locator('.skill-option').count(),88);
 await page.getByRole('combobox',{name:'スキルカテゴリ',exact:true}).selectOption('Shooting');
 assert.equal(await page.locator('.skill-option').count(),11);
 await page.getByRole('searchbox',{name:'スキル検索',exact:true}).fill('ＰＡＲＲＹ');
 assert.equal(await page.locator('.skill-option').count(),0);
 await page.getByRole('combobox',{name:'スキルカテゴリ',exact:true}).selectOption('');
 const parry=page.locator('[data-skill-id="skill-parry"]');
 await parry.getByText('受け流し',{exact:true}).waitFor();await parry.getByText('PARRY',{exact:true}).waitFor();
 await parry.getByRole('button',{name:'追加',exact:true}).click();
 await page.getByRole('searchbox',{name:'スキル検索',exact:true}).fill('タフ');
 const tough=page.locator('[data-skill-id="skill-tough"]');await tough.getByRole('spinbutton').fill('3');await tough.getByRole('button',{name:'追加',exact:true}).click();
 await page.getByRole('button',{name:'＋ スキル',exact:true}).click();await page.getByRole('textbox',{name:'スキル 5',exact:true}).fill('自由な技');
 await page.getByRole('button',{name:'スキル 2 を削除',exact:true}).click();
 await page.getByRole('textbox',{name:'スキル 4',exact:true}).fill('自由な技を編集');
 // Parameter editing is separate from the catalog label and is persisted.
 await page.locator('[data-skill-value="0"]').fill('2');
 await page.getByRole('button',{name:'保存',exact:true}).click();await saved();
 await page.reload();await roster();
 await openPanel(page,null,'スキル');
 const details=page.locator('.character-extra .skill-detail details');
 assert.equal(await details.count(),3);
 assert.deepEqual(await details.evaluateAll(nodes=>nodes.map(n=>n.open)),[false,false,false]);
 const p=details.filter({hasText:'PARRY'});await p.locator('summary').click();
 await p.getByText('カテゴリ',{exact:true}).waitFor();await p.getByText('使用条件',{exact:true}).waitFor();
 await p.getByText(/敵の打撃に対する反応/).waitFor();
 assert.equal(await details.first().getAttribute('open'),null);
 await p.locator('summary').click();assert.equal(await p.getAttribute('open'),null);
 for(const width of [320,375,390]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await closePanel(page);await page.getByRole('link',{name:'ホーム',exact:true}).click();
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'JSON を書き出す'}).click()]);
 const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'bb-skills-')),'backup.json');await download.saveAs(file);
 const exported=JSON.parse(fs.readFileSync(file)),savedChar=exported.warbands[0].characters[0];
 assert.equal(savedChar.skills,c.skills);assert.equal(savedChar.photo,c.photo);assert.deepEqual(savedChar.stats,c.stats);assert.deepEqual(exported.game,data.game);
 assert.deepEqual(savedChar.skillEntries,['ストロング（2）','受け流し','タフ（3）','自由な技を編集']);
 assert.deepEqual(savedChar.skillSelections,[{id:'skill-strong',value:2},{id:'skill-parry',value:null},{id:'skill-tough',value:3},null]);
 await page.locator('#restore-file').setInputFiles(file);await page.getByRole('button',{name:'確認して実行'}).click();await page.locator('#modal').waitFor({state:'hidden'});
 await page.reload();await roster();await edit();assert.equal(await page.getByRole('textbox',{name:'スキル 3',exact:true}).inputValue(),'タフ（3）');
 await page.getByRole('button',{name:'キャンセル',exact:true}).click();
 await page.getByRole('link',{name:'戦闘',exact:true}).click();
 await openPanel(page,null,'スキル');
 await page.locator('#character-panel .character-extra').getByText('ストロング（1）',{exact:true}).waitFor();await page.locator('#character-panel .character-extra').getByText('未知の技',{exact:true}).waitFor();
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();
 await context.setOffline(true);await page.reload();await roster();await edit();await page.locator('#skill-picker summary').click();
 await page.getByRole('searchbox',{name:'スキル検索',exact:true}).fill('DARKSENSE');await page.locator('[data-skill-id="skill-darksense"]').getByText('暗視',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS: 88 skills, bilingual/category search, numeric edits, free text CRUD, independent disclosures, 320px layout, photos/legacy/JSON and battle isolation, offline catalog');
 } finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
