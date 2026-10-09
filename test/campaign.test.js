import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,distance} from '../server/sim/model.js';
import {simulate} from '../server/sim/engine.js';
import {observe} from '../server/sim/visibility.js';
import {validate} from '../server/sim/orders/index.js';
import {portrait} from '../public/portraits.js';
test('survivors and new recruits return indoors at their own HQ, with return replay moves',()=>{
 const r=simulate(createGame(),[{actorId:'h-1',type:'extort',targetId:'b-06'},{actorId:'h-2',type:'recruit',targetId:'b-02'}],42);
 for(const h of r.endState.hoods.filter(h=>h.status==='alive')){const hq=r.endState.buildings.find(b=>b.type==='hq'&&b.ownerId===h.gangId);assert.equal(distance(h.position,hq.position),0,h.id);assert.equal(h.indoors,true,h.id);}
 assert.ok(r.events.some(e=>e.type==='move'&&e.data.journey==='return'&&e.actorId==='h-1'));
 assert.ok(r.events.some(e=>e.type==='arrive'&&e.data.journey==='return'&&e.actorGangId==='gang-rival'));
});
test('a successful extortion transfers an enemy business',()=>{
 const s=createGame();s.hoods[1].inventory.bombs=1;s.buildings[1].ownerId='gang-rival';
 let won=false;for(let seed=1;seed<30;seed++){const r=simulate(s,[{actorId:'h-1',type:'extort',targetId:'b-01'}],seed);if(r.events.some(e=>e.type==='ownership_change'&&e.targetId==='b-01'&&e.actorGangId==='gang-player')){assert.equal(r.endState.buildings[1].ownerId,'gang-player');won=true;break;}}assert.ok(won);
});
test('bomb closures block collections this week and next, then reopen',()=>{
 const s=createGame();s.hoods[1].inventory.bombs=1;s.buildings[1].ownerId='gang-rival';
 let bomb;for(let seed=1;seed<30;seed++){const r=simulate(s,[{actorId:'h-1',type:'bomb',targetId:'b-01'}],seed);if(r.endState.buildings[1].closedUntilWeek===2){bomb=r;break;}}
 assert.ok(bomb);assert.ok(bomb.events.some(e=>e.data.detonated===true));
 const base=structuredClone(bomb.endState);base.buildings[1].ownerId='gang-player';base.winner=null;
 for(const week of [1,2,3]){const copy=structuredClone(base);copy.week=week;const r=simulate(copy,[{actorId:'h-0',type:'collect',targetId:'b-01'}],42);assert.equal(r.endState.cash['gang-player']-copy.cash['gang-player']+r.endState.lastPayroll['gang-player'].paid,week===3?20:0);}
});
test('known contacts can be assigned hits while hidden; unknown contacts cannot',()=>{
 const s=createGame();s.hoods[1].inventory.gun='pistol';s.intel.sightings['h-4']={id:'h-4',gangId:'gang-rival',name:'Clara Moss',position:{x:1,y:1},week:1,status:'alive'};
 const view=observe(s);assert.equal(view.hoods.some(h=>h.id==='h-4'),false);
 const q=validate(view,[{actorId:'h-1',type:'hit',targetId:'h-4'}],'gang-player');assert.deepEqual(q[0].targetPosition,{x:1,y:1});
 assert.throws(()=>validate(view,[{actorId:'h-1',type:'hit',targetId:'h-5'}],'gang-player'));
 const r=simulate(s,q,42);assert.ok(r.events.some(e=>e.actorId==='h-1'&&e.type==='search'));assert.ok(r.events.some(e=>(e.type==='order_fail'&&e.actorId==='h-1')||(e.type==='combat_start'&&(e.actorId==='h-1'||e.data.targetHoodId==='h-1'))));
});
test('portraits are stable and distinct across both crews',()=>{const h=createGame().hoods;const images=h.map(portrait);assert.equal(new Set(images).size,h.length);assert.equal(portrait(h[0]),images[0]);});
test('rubble rejects building orders, blocks queued actions, and allows them after reopening',()=>{
 const s=createGame();s.hoods[1].inventory.bombs=1;s.buildings[1].closedUntilWeek=2;
 for(const type of ['recruit','extort','collect','patrol','bomb']){
 const queue=[{actorId:'h-1',type,targetId:'b-01'}];
 assert.throws(()=>validate(s,queue,'gang-player',{checkAvailability:true}),/rubble/);
 const r=simulate(s,queue,42);assert.ok(r.events.some(e=>e.actorId==='h-1'&&e.type==='order_fail'&&e.data.message.includes('rubble')));
 const reopened=structuredClone(s);reopened.week=3;assert.doesNotThrow(()=>validate(reopened,queue,'gang-player',{checkAvailability:true}));
 }
});
