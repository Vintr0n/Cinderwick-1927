import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WebSocket} from 'ws';
import {createApp} from '../server/index.js';
function client(url){
 const ws=new WebSocket(url),backlog=[],waiting=[];
 ws.on('message',raw=>{const data=JSON.parse(raw);const i=waiting.findIndex(w=>w.type===data.type);if(i>=0){const [w]=waiting.splice(i,1);clearTimeout(w.timer);w.resolve(data);}else backlog.push(data);});
 return {ws,send:v=>ws.send(JSON.stringify(v)),get:type=>new Promise((resolve,reject)=>{const i=backlog.findIndex(d=>d.type===type);if(i>=0)return resolve(backlog.splice(i,1)[0]);const w={type,resolve};w.timer=setTimeout(()=>reject(Error('Timed out: '+type)),4000);waiting.push(w);})};
}
test('WebSocket campaign persists queue and replay, rejects hidden hits, advances and restores',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cinderwick-test-'));let app=createApp({dataDir:dir,planningMs:60000});
 try{
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const url='ws://127.0.0.1:'+app.server.address().port,c=client(url);
 const start=await c.get('state');assert.equal(start.state.hoods.length,3);assert.equal(start.phase,'setup');assert.equal(start.deadline,null);c.send({type:'setup',profile:{bossName:'Mara Ash',outfitName:'Ash Crew',color:'#b568cf'}});const configured=await c.get('state');assert.equal(configured.phase,'planning');assert.equal(configured.state.profile.outfitName,'Ash Crew');c.send({type:'buy',itemId:'pistol'});assert.equal((await c.get('state')).state.stockpile.pistol,1);c.send({type:'equip',actorId:'h-0',itemId:'pistol'});assert.equal((await c.get('state')).state.hoods[0].inventory.gun,'pistol');
 c.send({type:'queue',orders:[{actorId:'h-0',type:'hit',targetId:'h-3'}]});assert.match((await c.get('error')).message,/target/i);
 c.send({type:'stance',actorId:'h-1',shootOnSight:true});assert.equal((await c.get('state')).state.hoods.find(h=>h.id==='h-1').shootOnSight,true);
 c.send({type:'queue',orders:[{actorId:'h-1',type:'recruit'}]});assert.equal((await c.get('state')).queue.length,1);
 c.send({type:'end'});const r=(await c.get('replay')).replay;assert.equal(r.endState.hoods.filter(h=>h.gangId==='gang-player').length,3);
 c.send({type:'queue',orders:[]});assert.match((await c.get('error')).message,/closed/i);
 c.send({type:'report',week:1});assert.equal((await c.get('report')).replay.replayId,r.replayId);
 await app.close();
 app=createApp({dataDir:dir,planningMs:60000});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const d=client('ws://127.0.0.1:'+app.server.address().port);
 assert.equal((await d.get('state')).phase,'playback');assert.equal((await d.get('replay')).replay.replayId,r.replayId);
 d.send({type:'playback_complete',replayId:r.replayId});const next=await d.get('state');assert.equal(next.state.week,2);assert.equal(next.phase,'planning');assert.equal(next.state.hoods.find(h=>h.id==='h-1').shootOnSight,true);assert.equal(next.state.hoods.find(h=>h.id==='h-0').inventory.gun,'pistol');assert.ok(next.deadline>Date.now());
 d.send({type:'playback_complete',replayId:r.replayId});const duplicate=await d.get('state');assert.equal(duplicate.deadline,next.deadline);assert.equal(duplicate.state.week,2);
 const response=await fetch('http://127.0.0.1:'+app.server.address().port+'/');assert.match(await response.text(),/CINDERWICK/);
 const audio=await fetch('http://127.0.0.1:'+app.server.address().port+'/sounds/background-loop.wav',{headers:{Range:'bytes=0-63'}});assert.equal(audio.status,206);assert.equal(audio.headers.get('content-type'),'audio/wav');assert.equal((await audio.arrayBuffer()).byteLength,64);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
test('planning timer automatically locks and computes the week',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cinderwick-timer-')),app=createApp({dataDir:dir,planningMs:100});
 try{await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const c=client('ws://127.0.0.1:'+app.server.address().port);await c.get('state');c.send({type:'setup',profile:{bossName:'Mara Ash',outfitName:'Ash Crew',color:'#b568cf'}});const r=await c.get('replay');assert.equal(r.replay.week,1);}finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
