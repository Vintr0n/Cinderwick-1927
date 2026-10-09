import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoundtrack} from '../public/sound.js';
test('sound uses supplied files, loops music, and mute stops active and future effects',()=>{
 const clips=[];class FakeAudio{constructor(src){this.src=src;this.paused=true;clips.push(this);}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}addEventListener(){}}
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 let clock=0;const s=createSoundtrack({AudioClass:FakeAudio,storage,random:()=>0,now:()=>clock});s.unlock();assert.equal(clips[0].loop,true);assert.equal(clips[0].paused,false);
 const event=(orderType,outcome,data={})=>{clock+=5000;s.event({actorId:'h-1',type:'action_result',orderType,outcome,data});};
 event('bomb','fail',{detonated:false});assert.equal(clips.length,1);
 event('bomb','success',{detonated:true});assert.ok(clips.at(-1).src.endsWith('bomb-1.mp3'));
 for(let i=0;i<3;i++)event('extort','success');
 assert.deepEqual(new Set(clips.slice(2).map(c=>c.src)),new Set(['/sounds/agree-1.wav','/sounds/agree-2.mp3','/sounds/agree-3.wav']));
 for(let i=0;i<2;i++)event('extort','fail');assert.ok(clips.some(c=>c.src.endsWith('reject-1.wav')));assert.ok(clips.some(c=>c.src.endsWith('reject-2.wav')));
 s.setMuted(true);assert.ok(clips.every(c=>c.paused));const count=clips.length;event('bomb','success',{detonated:true});s.unlock();assert.equal(clips.length,count);assert.equal(clips[0].paused,true);
 assert.equal(createSoundtrack({AudioClass:FakeAudio,storage}).muted,true);
 s.setMuted(false);assert.equal(clips[0].paused,false);event('bomb','success',{detonated:true});assert.equal(clips.at(-1).paused,false);s.stopEffects();assert.equal(clips.at(-1).paused,true);
});
test('voice cues are occasional and simultaneous agreements cannot produce a chorus',()=>{
 const clips=[];class FakeAudio{constructor(src){this.src=src;clips.push(this);}play(){return Promise.resolve();}pause(){}addEventListener(){}}
 let clock=0,roll=0;const s=createSoundtrack({AudioClass:FakeAudio,storage:null,random:()=>roll,now:()=>clock});s.unlock();
 const event={actorId:'h-1',type:'action_result',orderType:'extort',outcome:'success',data:{}};
 for(let i=0;i<10;i++)s.event(event);assert.equal(clips.length,2);
 clock=5000;roll=.9;s.event(event);assert.equal(clips.length,2);
 roll=.49;s.event({...event,outcome:'fail'});assert.equal(clips.length,3);
});

test('gunfire always plays the equipped weapon sound, while mute still suppresses it',()=>{
 const clips=[];class FakeAudio{constructor(src){this.src=src;clips.push(this);}play(){return Promise.resolve();}pause(){}addEventListener(){}}
 const s=createSoundtrack({AudioClass:FakeAudio,storage:null,random:()=>.99});s.unlock();
 for(const gun of ['pistol','tommy'])s.event({actorId:gun==='pistol'?'h-1':'h-4',type:'action_attempt',data:{kind:'gunfire',gun}});
 assert.deepEqual(clips.slice(1).map(c=>c.src),['/sounds/handgun-1.wav','/sounds/tommy-gun-1.wav']);
 s.setMuted(true);s.event({actorId:'h-1',type:'action_attempt',data:{kind:'gunfire',gun:'tommy'}});assert.equal(clips.length,3);
});
