import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../server/sim/model.js';
import {simulate,playerReplay} from '../server/sim/engine.js';
import recruit from '../server/sim/orders/recruit.js';
import {createSoundtrack} from '../public/sound.js';

test('recruitment succeeds below .5 and fails at or above .5 without a fee',()=>{
 for(const roll of [0,.49999,.5,.999]){
 const state=createGame(),cash=state.cash['gang-player'],events=[];
 recruit.resolve({state,actor:state.hoods[0],rng:()=>roll,emit:(...e)=>events.push(e),fail:m=>events.push(['fail',m])});
 assert.equal(state.hoods.length,roll<.5?7:6);assert.equal(state.cash['gang-player'],cash);
 assert.equal(events[0][0],roll<.5?'action_result':'fail');
 }
});
test('shoot on sight interrupts a noncombat order; every shot shows both fighters and guns survive',()=>{
 for(const gun of ['pistol','tommy']){
 const s=createGame();s.hoods[1].inventory.gun=gun;s.hoods[1].shootOnSight=true;
 s.hoods[4].position={x:0,y:0};s.hoods[4].indoors=false;s.intel.identified={'h-4':true};
 const r=simulate(s,[{actorId:'h-1',type:'extort',targetId:'b-12'}],8),view=playerReplay(r);
 assert.ok(r.events.some(e=>e.type==='combat_start'&&e.actorId==='h-1'&&e.data.message.includes('shoot on sight')));
 for(const e of view.events.filter(e=>e.data.kind==='gunfire')){
 assert.ok(e.data.view.hoods.some(h=>h.id===e.actorId));assert.ok(e.data.view.hoods.some(h=>h.id===e.data.targetHoodId));
 }
 const hood=r.endState.hoods.find(h=>h.id==='h-1');
 assert.equal((hood.inventory.gun===gun?1:0)+r.endState.stockpile['gang-player'][gun],1);
 for(const e of view.events.filter(e=>e.type==='death')){
 const body=e.data.view.hoods.find(h=>h.id===e.data.victimId);assert.ok(body);assert.equal(body.status,'dead');assert.equal(body.position,null);assert.equal(body.deathPosition.length,3);
 }
 }
});
test('equipped guns persist across uneventful weeks',()=>{
 let s=createGame();s.hoods[1].inventory.gun='pistol';s.hoods[2].inventory.gun='tommy';
 for(let i=0;i<3;i++){s=simulate(s,[],42).endState;s.week++;assert.equal(s.hoods[1].inventory.gun,'pistol');assert.equal(s.hoods[2].inventory.gun,'tommy');}
});
test('death and exhausted combat stop both gun clips immediately without stopping music',()=>{
 const clips=[];class Audio{constructor(src){this.src=src;clips.push(this);}play(){this.paused=false;}pause(){this.paused=true;}addEventListener(){}}
 const sound=createSoundtrack({AudioClass:Audio,storage:null});sound.unlock();
 const shot=(actor,target,gun)=>sound.event({type:'action_attempt',actorId:actor,data:{kind:'gunfire',gun,targetHoodId:target}});
 shot('h-1','h-4','pistol');shot('h-4','h-1','tommy');
 sound.event({type:'death',data:{victimId:'h-4'}});assert.ok(clips.slice(1).every(c=>c.paused&&c.currentTime===0));assert.equal(clips[0].paused,false);
 shot('h-1','h-5','tommy');sound.event({type:'combat_end',data:{participants:['h-1','h-5']}});assert.equal(clips.at(-1).paused,true);
});
