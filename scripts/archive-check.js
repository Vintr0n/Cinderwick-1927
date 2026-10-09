import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/index.js';
import {createStore} from '../server/data/store.js';
const source=createStore('data'),session=source.getGame(),all=source.listReplays(session.state.id),weeks=[all.at(-1),all[Math.floor(all.length/2)],all[0]];
assert.equal(session.phase,'ended');
const dir=mkdtempSync(join(tmpdir(),'replay-check-')),copy=createStore(dir);copy.saveGame(session);for(const week of weeks)copy.appendReplay(source.getReplay(session.state.id,week));
const app=createApp({dataDir:dir});let browser;
try {
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install();
 await page.goto('http://127.0.0.1:'+app.server.address().port);await page.click('#endReports');await page.locator('#reportDialog').waitFor();
 for(const week of weeks){
  await page.evaluate(w=>{const select=document.getElementById('reportWeek');select.value=String(w);select.dispatchEvent(new Event('change'));if(!document.getElementById('replayBtn').disabled)throw Error('Replay must wait for selected report');},week);
  await page.waitForFunction(w=>document.getElementById('reportTitle').textContent==='Week '+w+' / The dispatch'&&!document.getElementById('replayBtn').disabled,week);
  await page.click('#replayBtn');await page.clock.runFor(1500);assert.equal(await page.locator('#playback').isVisible(),true);await page.click('#pause');const frozen=await page.locator('#playTime').innerText();await page.clock.runFor(500);assert.equal(await page.locator('#playTime').innerText(),frozen);await page.click('#pause');
  await page.clock.fastForward(1800000);await page.locator('#reportDialog').waitFor();assert.equal(await page.locator('#week').innerText(),'WEEK '+String(session.state.week).padStart(2,'0'));assert.equal(await page.locator('#cash').innerText(),'$'+session.state.cash['gang-player'].toLocaleString());assert.equal(await page.locator('#end').isDisabled(),true);
 }
 // Switching reports during archival playback must stop the old timeline cleanly.
 await page.click('#replayBtn');await page.click('#reportsBtn');await page.locator('#reportDialog').waitFor();assert.equal(await page.locator('#playback').isVisible(),false);assert.equal(await page.locator('#replayBtn').isDisabled(),false);
 assert.deepEqual(errors,[]);assert.deepEqual(source.getGame(),session);console.log('Finished-campaign archive checks passed: weeks '+weeks.join(', ')+', natural completion, pause/resume, report switching, restored campaign and untouched save.');
}finally{await browser?.close();await app.close();rmSync(dir,{recursive:true,force:true});}
