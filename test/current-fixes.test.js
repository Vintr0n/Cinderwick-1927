import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,migrateGame} from '../server/sim/model.js';
import {observe} from '../server/sim/visibility.js';
import {validate,orders} from '../server/sim/orders/index.js';
import {createSoundtrack} from '../public/sound.js';
test('lost protection does not masquerade as a player business with a zero balance',()=>{
 const s=createGame(),b=s.buildings[1];s.intel.buildings[b.id]='gang-player';b.ownerId='gang-rival';b.heldIncome=40;
 const v=observe(s).buildings[1];assert.equal(v.ownerId,null);assert.equal(v.lostProtection,true);assert.equal(v.heldIncome,undefined);s.intel.buildings[b.id]='gang-rival';const revealed=observe(s).buildings[1];assert.equal(revealed.ownerId,'gang-rival');assert.equal(revealed.lostProtection,false);
});
test('purchased property restrictions apply to queue validation and arrival without consuming TNT',()=>{
 const s=createGame(),b=s.buildings[1],actor=s.hoods[1];b.ownerId=b.propertyOwnerId='gang-player';actor.inventory.bombs=1;
 for(const type of ['collect','investigate','bomb']){assert.throws(()=>validate(s,[{actorId:actor.id,type,targetId:b.id}],'gang-player'),/Purchased/);let failed=false;orders[type].resolve({state:s,actor,target:b,fail:()=>failed=true});assert.equal(failed,true);}
 assert.equal(actor.inventory.bombs,1);assert.throws(()=>validate(s,[{actorId:actor.id,type:'return'}],'gang-player'),/Already at HQ/);
 b.propertyOwnerId=null;for(const type of ['investigate','bomb','collect'])assert.doesNotThrow(()=>validate(s,[{actorId:actor.id,type,targetId:b.id}],'gang-player'));
});
test('legacy protection held by a purchased business is paid out once on migration',()=>{
 const s=createGame(),b=s.buildings[1];b.ownerId=b.propertyOwnerId='gang-player';b.heldIncome=60;const before=s.cash['gang-player'];migrateGame(s);migrateGame(s);assert.equal(b.heldIncome,0);assert.equal(s.cash['gang-player'],before+60);
});
test('each gun loops once per shooter until combat stops; repeated shots do not stack clips',()=>{
 const clips=[];class Audio{constructor(src){this.src=src;clips.push(this);}play(){this.paused=false;}pause(){this.paused=true;}addEventListener(){}}
 const s=createSoundtrack({AudioClass:Audio,storage:null});s.unlock();
 for(let i=0;i<10;i++)for(const [actorId,target,gun] of [['h-1','h-4','pistol'],['h-4','h-1','tommy']])s.event({type:'action_attempt',actorId,data:{kind:'gunfire',gun,targetHoodId:target}});
 assert.equal(clips.length,3);assert.ok(clips.slice(1).every(a=>a.loop&&!a.paused));s.event({type:'combat_end',data:{participants:['h-1','h-4']}});assert.ok(clips.slice(1).every(a=>a.paused));assert.equal(clips[0].paused,false);
});
