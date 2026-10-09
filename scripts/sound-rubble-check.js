import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/index.js';
import {createStore} from '../server/data/store.js';
import {createGame} from '../server/sim/model.js';
import {simulate} from '../server/sim/engine.js';
const dir=mkdtempSync(join(tmpdir(),'cinderwick-sound-'));
const orders=[{actorId:'h-1',type:'bomb',targetId:'b-01'},{actorId:'h-2',type:'extort',targetId:'b-06'}];
let state;
for(let seed=1;seed<100;seed++){const game=createGame(seed);game.hoods[1].inventory.bombs=1;const r=simulate(game,orders);if(r.events.some(e=>e.data.detonated)&&r.events.some(e=>e.orderType==='extort'&&e.actorGangId==='gang-player'&&e.type==='action_result'&&e.outcome==='success')){state=game;break;}}
assert.ok(state);createStore(dir).saveGame({state,queue:orders,phase:'planning',deadline:Date.now()+600000});
const app=createApp({dataDir:dir,planningMs:600000});let browser;
try{
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const OriginalAudio=window.Audio;window.testAudio=[];window.Audio=function(src){const audio=new OriginalAudio(src);window.testAudio.push(audio);return audio;};});
 await page.goto('http://127.0.0.1:'+app.server.address().port);await page.waitForFunction(()=>document.getElementById('orderCount').textContent==='2');
 await page.click('#soundToggle');assert.equal(await page.locator('#soundToggle').innerText(),'Sound off');
 await page.click('#soundToggle');await page.waitForFunction(()=>window.testAudio[0].currentTime>0&&!window.testAudio[0].paused);
 assert.ok(await page.evaluate(()=>window.testAudio[0].loop));
 await page.click('#end');await page.locator('#playback').waitFor();await page.selectOption('#speed','4');
 await page.waitForFunction(()=>window.testAudio.some(a=>a.src.includes('bomb-1')));
 await page.click('#pause');await page.click('#soundToggle');assert.ok(await page.evaluate(()=>window.testAudio.every(a=>a.paused)));
 await page.click('#skip');await page.waitForFunction(()=>document.getElementById('week').textContent==='WEEK 02');
 await page.locator('#reportDialog [data-close]').click();await page.reload();await page.waitForFunction(()=>document.getElementById('week').textContent==='WEEK 02');
 assert.equal(await page.locator('#soundToggle').innerText(),'Sound off');assert.ok(await page.evaluate(()=>window.testAudio[0].paused));
 // Decode metadata for every supplied effect, including the less frequently chosen variants.
 const decoded=await page.evaluate(async()=>{
 const paths=['bomb-1.mp3','agree-1.wav','agree-2.mp3','agree-3.wav','reject-1.wav','reject-2.wav','handgun-1.wav','tommy-gun-1.wav'];
 return Promise.all(paths.map(path=>new Promise((resolve,reject)=>{const a=new Audio('/sounds/'+path);a.preload='metadata';a.onloadedmetadata=()=>resolve({path,duration:a.duration});a.onerror=()=>reject(Error('Cannot decode '+path));a.load();})));
 });assert.ok(decoded.every(a=>Number.isFinite(a.duration)&&a.duration>0));
 const rubble=await page.evaluate(async()=>{
 const {createScene}=await import('/scene.js');const host=document.createElement('div');host.style.cssText='position:fixed;inset:0;z-index:100';document.body.append(host);
 const s=createScene(host,()=>{});window.rubbleFixture=s;
 const state={week:1,hoods:[],buildings:[{id:'b-test',name:'Mercer Grocer',type:'shop',functionalInV1:true,ownerId:null,position:{x:2,y:2},closedUntilWeek:2}]};window.rubbleState=state;
 s.apply(state);const first=s.inspectBuilding('b-test');s.apply({...state,week:2});const next=s.inspectBuilding('b-test');s.apply({...state,week:3});const reopened=s.inspectBuilding('b-test');s.apply(state);
 return {first,next,reopened};
 });assert.deepEqual(rubble.first,{ruined:true,intactVisible:false});assert.equal(rubble.next.ruined,true);assert.deepEqual(rubble.reopened,{ruined:false,intactVisible:true});
 await page.mouse.move(650,450);await page.mouse.wheel(0,-700);await page.waitForTimeout(350);mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/rubble.png'});
 assert.deepEqual(errors,[]);console.log('Sound/rubble checks passed: real music playback, bomb and agreement cues, mute persistence, all eight effect files decode, rubble lasts two weeks and restores.');
}finally{await browser?.close();await app.close();rmSync(dir,{recursive:true,force:true});}
