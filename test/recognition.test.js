import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,migrateGame} from '../server/sim/model.js';
import {identifyNearby,observe} from '../server/sim/visibility.js';
import {simulate,playerReplay} from '../server/sim/engine.js';
import {lineOfSight} from '../server/sim/navigation.js';

test('test treasury and new income rates preserve existing money on migration',()=>{
 const s=createGame();assert.equal(s.cash['gang-player'],1000);
 assert.deepEqual([...new Set(s.buildings.filter(b=>b.income).map(b=>b.income))].sort(),[20,30,40]);
 s.cash['gang-player']=123;s.buildings[1].heldIncome=140;s.buildings[1].income=70;
 migrateGame(s);assert.equal(s.cash['gang-player'],123);assert.equal(s.buildings[1].heldIncome,120);assert.equal(s.buildings[1].income,20);
});
test('recognition is probabilistic, throttled, and works outside HQ with clear sight',()=>{
 const s=createGame(),own=s.hoods[0],enemy=s.hoods[3],checks=new Map();
 own.indoors=enemy.indoors=false;own.position={x:4,y:4};
 let view=observe(s);assert.equal(view.bystanders.length,1);assert.equal(view.hoods.some(h=>h.id===enemy.id),false);
 assert.equal(JSON.stringify(view.bystanders).includes(enemy.name),false);
 assert.equal(identifyNearby(s,()=>.99,0,checks).length,0);
 assert.equal(identifyNearby(s,()=>0,500,checks).length,0);
 assert.equal(identifyNearby(s,()=>0,2000,checks).length,1);
 view=observe(s);assert.ok(view.hoods.some(h=>h.id===enemy.id));assert.equal(view.bystanders.length,0);
 own.indoors=true;assert.equal(observe(s).hoods.some(h=>h.id===enemy.id),false);assert.ok(s.intel.sightings[enemy.id]);
 const blocked=createGame();blocked.hoods[0].indoors=blocked.hoods[3].indoors=false;
 blocked.hoods[0].streetPosition=[-3,.15,0];blocked.hoods[3].streetPosition=[3,.15,0];
 assert.equal(identifyNearby(blocked,()=>0,0,new Map()).length,0);
});
test('patrol follows a complete unobstructed sidewalk circuit and returns home',()=>{
 const s=createGame();s.hoods=s.hoods.filter(h=>h.gangId==='gang-player');
 const r=simulate(s,[{actorId:'h-1',type:'patrol',targetId:'b-12'}]),moves=r.events.filter(e=>e.actorId==='h-1'&&e.data.journey==='patrol'&&e.type==='move');
 assert.equal(moves.length,5);
 for(const e of moves)for(let i=1;i<e.data.path.length;i++)assert.ok(lineOfSight(s,e.data.path[i-1],e.data.path[i]));
 assert.ok(r.events.some(e=>e.data.message?.includes('is patrolling '+s.buildings.find(b=>b.id==='b-12').name+'.')));
 assert.ok(!r.events.some(e=>e.data.message?.includes('12 seconds')));
 assert.equal(r.endState.hoods[1].indoors,true);
});
test('central patrol encounters rivals doing real jobs across several seeded campaigns',()=>{
 let contacts=0;for(let seed=1;seed<=8;seed++){
 const r=simulate(createGame(seed),[{actorId:'h-1',type:'patrol',targetId:'b-12'}]),view=playerReplay(r);
 assert.ok(view.events.some(e=>e.data.view.bystanders.some(p=>p.travel)));
 if(view.events.some(e=>e.data.view.hoods.some(h=>h.gangId==='gang-rival')))contacts++;
 assert.ok(r.events.some(e=>e.actorGangId==='gang-rival'&&e.orderType==='extort'&&e.type==='action_result'));
 }assert.ok(contacts>=6,'Most nearby patrols should recognize the working rivals');
});
