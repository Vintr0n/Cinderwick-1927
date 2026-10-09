import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../server/sim/model.js';
import {simulate,playerReplay} from '../server/sim/engine.js';
import {validate} from '../server/sim/orders/index.js';
const queue=[{actorId:'h-0',type:'recruit'},{actorId:'h-1',type:'extort',targetId:'b-01'},{actorId:'h-2',type:'bomb',targetId:'b-24'}];
test('identical seeds and shuffled input arrays produce byte-identical replay',()=>{
 const state=createGame(),copy=structuredClone(state);copy.hoods.reverse();copy.buildings.reverse();
 assert.equal(JSON.stringify(simulate(state,queue,42)),JSON.stringify(simulate(copy,[...queue].reverse(),42)));
 assert.equal(state.hoods.length,6);
});
test('events have fixed ticks, stable sequence and matching views',()=>{
 const r=simulate(createGame(),queue,8);
 assert.match(r.replayId,/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
 for(let i=1;i<r.events.length;i++)assert.ok(r.events[i].tick>r.events[i-1].tick||r.events[i].seq>r.events[i-1].seq);
 assert.equal(r.tickLengthMs,500);
});
test('recruit is free, adds wages, and rolls all four stats',()=>{
 const r=Array.from({length:20},(_,i)=>simulate(createGame(),[{actorId:'h-0',type:'recruit'}],i)).find(r=>r.endState.hoods.length===7);assert.ok(r);
 assert.equal(r.endState.hoods.length,7);assert.equal(r.endState.cash['gang-player'],940);
 assert.ok(Object.values(r.endState.hoods.at(-1).stats).every(s=>s>=1&&s<=5));
});
test('duplicate actors and inert business targets are rejected',()=>{
 assert.throws(()=>validate(createGame(),[queue[0],queue[0]],'gang-player'));
 assert.throws(()=>validate(createGame(),[{actorId:'h-0',type:'extort',targetId:'b-07'}],'gang-player'));
});
test('fog hides distant enemies and their undiscovered ownership',()=>{
 const r=playerReplay(simulate(createGame(),[]));
 assert.equal(r.startState.hoods.length,3);
 assert.equal(r.startState.buildings.find(b=>b.id==='b-24').ownerId,null);
 assert.ok(!JSON.stringify(r).includes('h-3'));
});
test('protection pays once per building each week',()=>{
 const s=createGame();s.buildings[1].ownerId='gang-player';
 const r=simulate(s,[{actorId:'h-0',type:'collect',targetId:'b-01'},{actorId:'h-1',type:'collect',targetId:'b-01'}]);
 assert.equal(r.endState.cash['gang-player'],980);
});
test('boss death ends simulation and both win and loss are reachable',()=>{
 let win=false,loss=false;
 for(let seed=1;seed<150;seed++){
 const s=createGame();s.hoods[0].inventory.gun='pistol';s.hoods[3].position={x:0,y:0};s.hoods[3].indoors=false;const r=simulate(s,[{actorId:'h-0',type:'patrol',targetId:'b-00'}],seed);
 win ||= r.endState.winner==='gang-player';loss ||= r.endState.winner==='gang-rival';
 if(r.endState.winner){const d=r.events.find(e=>e.type==='death'&&['h-0','h-3'].includes(e.data.victimId));assert.equal(r.events.at(-1).tick,d.tick);}
 }
 assert.ok(win);assert.ok(loss);
});
