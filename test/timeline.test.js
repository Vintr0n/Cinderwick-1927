import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../server/sim/model.js';
import {simulate,playerReplay} from '../server/sim/engine.js';
import {accrueIncome} from '../server/sim/economy.js';
import {lineOfSight,route,shotLimit} from '../server/sim/navigation.js';
import {weeklySummary} from '../public/reporting.js';
import {presentation} from '../public/playback.js';

test('protection accumulates, accrual is idempotent, and collection empties the full balance',()=>{
 const s=createGame(),business=s.buildings[1];business.ownerId='gang-player';
 accrueIncome(s);accrueIncome(s);assert.equal(business.heldIncome,20);
 s.week=2;accrueIncome(s);assert.equal(business.heldIncome,40);
 s.week=3;const r=simulate(s,[{actorId:'h-0',type:'collect',targetId:'b-01'}],42);
 assert.equal(r.endState.buildings[1].heldIncome,0);
 const summary=weeklySummary(playerReplay(r));assert.equal(summary.income,60);assert.equal(summary.wages,40);assert.equal(r.endState.cash['gang-player'],1020);
});
test('closed businesses accrue nothing, and enemy income is never counted as our income',()=>{
 const s=createGame();s.buildings[1].ownerId='gang-player';s.buildings[1].closedUntilWeek=2;
 accrueIncome(s);s.week=2;accrueIncome(s);assert.equal(s.buildings[1].heldIncome,0);
 s.week=3;accrueIncome(s);assert.equal(s.buildings[1].heldIncome,20);
 const r=playerReplay(simulate(createGame(),[],42));r.events.push({actorGangId:'gang-rival',orderType:'collect',outcome:'success',data:{cashDelta:70,message:'Collected $70 in protection.'}});
 assert.equal(weeklySummary(r).income,0);
 r.events.push({actorId:'h-1',orderType:'collect',outcome:'success',data:{message:'Collected $70 in protection.'}});assert.equal(weeklySummary(r).income,70);
});
test('streets route around buildings and every firing ray is obstructed by solid walls',()=>{
 const state=createGame();assert.equal(lineOfSight(state,[-3,.15,0],[3,.15,0]),false);
 assert.equal(lineOfSight(state,[-3,.15,2.5],[3,.15,2.5]),true);
 const path=route(state,[-3,.15,0],[3,.15,0]);assert.ok(path.length>2);
 for(let i=1;i<path.length;i++)assert.ok(lineOfSight(state,path[i-1],path[i]));
});
function combatFixture(gun){const s=createGame();s.hoods[1].inventory.gun=gun;s.hoods[1].stats.firearms=1;s.hoods[4].inventory.gun=null;s.hoods[4].position={x:0,y:0};s.hoods[4].indoors=false;return s;}
test('patrol fires 10/20 individually checked shots, then an unarmed survivor flees for ten seconds',()=>{
 for(const gun of ['pistol','tommy']){
 let found=false;
 for(let seed=1;seed<100&&!found;seed++){
 const r=simulate(combatFixture(gun),[{actorId:'h-1',type:'patrol',targetId:'b-00'}],seed);
 const shots=r.events.filter(e=>e.data.kind==='gunfire'&&e.actorId==='h-1');
 assert.ok(shots.length<=shotLimit(gun));
 for(const shot of shots){assert.equal(shot.data.chance,.05);assert.ok(lineOfSight(shot.data.view,shot.data.fromWorld,shot.data.toWorld));assert.ok(shot.data.message.includes('shot'));}
 const flee=r.events.find(e=>e.type==='flee'&&e.actorId==='h-4');if(!flee)continue;
 found=true;assert.equal(shots.length,shotLimit(gun));assert.equal(flee.data.durationMs,10000);
 const end=r.events.find(e=>e.type==='flee_end'&&e.actorId==='h-4');assert.equal((end.tick-flee.tick)*500,10000);
 for(const h of r.endState.hoods.filter(h=>h.status==='alive'))assert.equal(h.indoors,true);
 }
 assert.ok(found,'A missed volley must allow fleeing');
 }
});
test('departures are half a second apart and week completion has no artificial tail',()=>{
 const r=simulate(createGame(),[{actorId:'h-0',type:'extort',targetId:'b-01'},{actorId:'h-1',type:'recruit',targetId:'b-02'},{actorId:'h-2',type:'patrol',targetId:'b-03'}],42);
 const starts=r.events.filter(e=>e.type==='order_start'&&e.actorGangId==='gang-player');
 assert.deepEqual(starts.map(e=>e.tick*500),[0,500,1000]);
 assert.equal(presentation(playerReplay(r)).duration,r.durationMs);
 const arrivals=r.events.filter(e=>e.type==='arrive'&&e.data.journey==='return');assert.equal(r.durationMs,Math.max(...arrivals.map(e=>e.tick))*500);
 assert.ok(r.endState.hoods.filter(h=>h.status==='alive').every(h=>h.indoors));
});
test('a missing hit target triggers a bounded search before returning home',()=>{
 const s=createGame();s.hoods[1].inventory.gun='pistol';s.intel.sightings['h-4']={id:'h-4',gangId:'gang-rival',status:'alive',position:{x:0,y:0}};
 const r=simulate(s,[{actorId:'h-1',type:'hit',targetId:'h-4'}],42),searches=r.events.filter(e=>e.actorId==='h-1'&&e.type==='move'&&e.data.journey==='search');
 assert.ok(searches.length>0&&searches.length<=4);for(const e of searches)assert.ok(e.toPosition.x+e.toPosition.y<=1);
 assert.equal(r.endState.hoods.find(h=>h.id==='h-1').indoors,true);
});
test('report counts both dead and deserted crew without counting prior losses again',()=>{
 const r=playerReplay(simulate(createGame(),[],42));r.endState.hoods[1].status='dead';r.endState.hoods[2].status='deserted';assert.equal(weeklySummary(r).lost,2);
 r.startState.hoods[1].status='dead';assert.equal(weeklySummary(r).lost,1);
});
