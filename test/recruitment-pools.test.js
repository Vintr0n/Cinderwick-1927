import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,migrateGame,makeHood} from '../server/sim/model.js';
import {refreshRecruitment} from '../server/sim/recruitment.js';
import recruit from '../server/sim/orders/recruit.js';
import investigate from '../server/sim/orders/investigate.js';
import {observe} from '../server/sim/visibility.js';
import {createSoundtrack} from '../public/sound.js';
import {random} from '../server/sim/random.js';

test('local recruitment pools deplete on success, replenish every two weeks and remain private',()=>{
 const state=migrateGame(createGame()),target=state.buildings[1],actor=state.hoods[0],messages=[];
 const attempt=roll=>recruit.resolve({state,target,actor,rng:()=>roll,emit(){},fail:m=>messages.push(m)});
 attempt(.9);assert.equal(state.recruitmentPools[target.id].available,2);
 attempt(0);attempt(0);attempt(0);assert.equal(state.hoods.length,8);assert.match(messages.at(-1),/No potential recruits/);
 state.week=2;refreshRecruitment(state);assert.equal(state.recruitmentPools[target.id].available,0);
 state.week=3;refreshRecruitment(state);refreshRecruitment(state);assert.equal(state.recruitmentPools[target.id].available,1);
 attempt(0);assert.equal(state.hoods.length,9);
 state.week=10;refreshRecruitment(state);assert.equal(state.recruitmentPools[target.id].available,2);
 assert.equal(observe(state).recruitmentPools,undefined);
 const saved=JSON.parse(JSON.stringify(state));migrateGame(saved);assert.deepEqual(saved.recruitmentPools,state.recruitmentPools);
});

test('expanded names support hundreds of unique period identities without numeric suffixes',()=>{
 const names=[],rng=random(1927);
 for(let i=0;i<300;i++)names.push(makeHood('h-'+i,'gang-player',{x:0,y:0},rng,false,names).name);
 assert.equal(new Set(names).size,300);assert.ok(names.every(n=>!/[0-9]/.test(n)));
});

test('fatal guarded investigation emits one non-looping pistol sound, respecting mute',()=>{
 const state=migrateGame(createGame()),actor=state.hoods[1],target=state.buildings.find(b=>b.type==='hq'&&b.ownerId==='gang-rival'),events=[];
 investigate.resolve({state,actor,target,rng:()=>0,kill(){actor.status='dead';},emit:(type,outcome,data)=>events.push({actorId:actor.id,type,outcome,data}),fail(){}});
 assert.equal(actor.status,'dead');assert.equal(events.length,1);assert.equal(events[0].data.kind,'investigation_shot');
 const clips=[];class Audio{constructor(src){this.src=src;clips.push(this);}play(){return Promise.resolve();}pause(){}addEventListener(){}}
 const sound=createSoundtrack({AudioClass:Audio,storage:null});sound.unlock();sound.event(events[0]);
 assert.equal(clips.at(-1).src,'/sounds/handgun-1.wav');assert.notEqual(clips.at(-1).loop,true);
 sound.setMuted(true);sound.event(events[0]);assert.equal(clips.length,2);
});
