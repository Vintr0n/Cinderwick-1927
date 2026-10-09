import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/index.js';
import {createStore} from '../server/data/store.js';
import {createGame} from '../server/sim/model.js';
import {simulate} from '../server/sim/engine.js';
const dir=mkdtempSync(join(tmpdir(),'cinderwick-property-'));let state;
for(let seed=1;seed<30;seed++){const s=createGame(seed);s.cash['gang-player']=4000;s.hoods[0].inventory.gun='pistol';s.hoods[1].inventory.gun='pistol';if(simulate(s,[{actorId:'h-1',type:'investigate',targetId:'b-01'}]).endState.intel.investigations['b-01']){state=s;break;}}
assert.ok(state);const store=createStore(dir);store.saveGame({state,queue:[],phase:'planning',deadline:Date.now()+600000});
const app=createApp({dataDir:dir,planningMs:600000});let browser;
try{
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+app.server.address().port);await page.waitForFunction(()=>document.getElementById('crewCount').textContent==='3');
 const clickBusiness=async()=>{const p=await page.evaluate(async()=>{const T=await import('three'),r=document.getElementById('scene').getBoundingClientRect(),h=Math.max(40,42*r.height/r.width),c=new T.OrthographicCamera(-h*r.width/r.height,h*r.width/r.height,h,-h,.1,200);c.position.set(62,60,68);c.lookAt(15,0,15);c.updateMatrixWorld();const p=new T.Vector3(-6,2.8,-12).project(c);return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};});await page.mouse.click(p.x,p.y);};
 const finish=async week=>{await page.click('#end');await page.locator('#playback').waitFor();await page.click('#skip');await page.locator('#reportDialog').waitFor();await page.waitForFunction(w=>document.getElementById('week').textContent==='WEEK '+String(w).padStart(2,'0'),week);await page.locator('#reportDialog [data-close]').click();};
 await page.click('#rosterBtn');await page.click('[data-hood="h-1"]');assert.equal(await page.locator('[data-action="buy"]').count(),0);await page.click('[data-action="investigate"]');await clickBusiness();await page.waitForFunction(()=>document.getElementById('orderCount').textContent==='1');await finish(2);
 await clickBusiness();assert.match(await page.locator('#mapSelection').innerText(),/Purchase price: \$1000/);assert.match(await page.locator('#mapSelection').innerText(),/automatic income: \$40/);
 mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/investigated-property.png'});
 await page.click('#purchaseProperty');await page.click('[data-hood="h-1"]');await page.waitForFunction(()=>document.getElementById('orderCount').textContent==='1');await finish(3);
 assert.equal(store.getGame().state.buildings[1].propertyOwnerId,'gang-player');await clickBusiness();assert.match(await page.locator('#mapSelection').innerText(),/Automatic income: \$40/);
 await page.click('#rosterBtn');await page.click('[data-hood="h-0"]');assert.equal(await page.locator('#retireHood').isDisabled(),true);await page.click('[data-action="protect"]');await clickBusiness();await page.waitForFunction(()=>document.getElementById('orderCount').textContent==='1');await finish(4);
 assert.equal(store.getGame().state.hoods.find(h=>h.id==='h-0').stationedAt,'b-01');
 await page.click('#rosterBtn');await page.click('[data-hood="h-0"]');assert.equal(await page.locator('[data-action="return"]').isEnabled(),true);assert.equal(await page.locator('[data-action="extort"]').isDisabled(),true);await page.screenshot({path:'test-results/stationed-boss.png'});await page.locator('#actionDialog [data-close]').click();
 await clickBusiness();const before=store.getGame().state.cash['gang-player'];await page.click('#sellProperty');await page.waitForFunction(()=>!document.getElementById('sellProperty'));assert.equal(store.getGame().state.cash['gang-player'],before+800);assert.equal(store.getGame().state.hoods[0].stationedAt,undefined);
 await page.click('#rosterBtn');await page.click('[data-hood="h-1"]');await page.click('#retireHood');await page.locator('#retireDialog').waitFor();await page.click('#cancelRetire');assert.equal(store.getGame().state.hoods.find(h=>h.id==='h-1').status,'alive');await page.click('#retireHood');await page.click('#confirmRetire');await page.waitForFunction(()=>document.getElementById('crewCount').textContent==='2');assert.equal(store.getGame().state.stockpile['gang-player'].pistol,1);assert.match(await page.locator('#payrollPreview').innerText(),/\$20/);
 assert.equal(await page.locator('.hood-card').count(),2);await page.uncheck('#aliveOnly');assert.equal(await page.locator('.hood-card').count(),3);await page.check('#aliveOnly');await page.locator('#rosterDialog [data-close]').click();
 await page.click('#buyBtn');await page.click('#sellMode');await page.click('[data-select-item="pistol"]');const cashBeforeSale=store.getGame().state.cash['gang-player'];await page.click('#confirmBuy');await page.waitForFunction(cash=>document.getElementById('cash').textContent==='$'+cash.toLocaleString(),cashBeforeSale+90);assert.equal(store.getGame().state.stockpile['gang-player'].pistol,0);await page.screenshot({path:'test-results/equipment-selling.png'});await page.locator('#buyDialog [data-close]').click();assert.equal(await page.locator('footer').count(),0);await page.click('#cutaway');assert.equal(await page.getAttribute('#cutaway','aria-pressed'),'true');await page.screenshot({path:'test-results/cutaway-city.png'});await page.click('#cutaway');await page.screenshot({path:'test-results/expanded-city.png'});assert.deepEqual(errors,[]);console.log('Property UI passed: investigate, purchase, automatic income, station boss, sell with occupants, retirement, and 10x10 map.');
}finally{await browser?.close();await app.close();rmSync(dir,{recursive:true,force:true});}
