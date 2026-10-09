import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,migrateGame,configureGame} from '../server/sim/model.js';
import {buyEquipment,equipEquipment,settleWages,equipment} from '../server/sim/economy.js';
import {simulate} from '../server/sim/engine.js';
import {validate} from '../server/sim/orders/index.js';
import {npcOrders} from '../server/sim/ai.js';
import {observe,identifyNearby} from '../server/sim/visibility.js';
import {hitChance,shotLimit} from '../server/sim/navigation.js';
test('setup validates names and colors, and changes the boss identity',()=>{
 const s=createGame();configureGame(s,{bossName:'Mara Ash',outfitName:'Ash Crew',color:'#B568CF'});assert.equal(s.hoods[0].name,'Mara Ash');assert.equal(s.profile.color,'#b568cf');
 assert.throws(()=>configureGame(s,{bossName:'x',outfitName:'Crew',color:'red'}));
});
test('stockpile purchases and equipment transfers conserve cash and items, and enforce attack equipment',()=>{
 const s=createGame(),options={checkAvailability:true};s.intel.sightings['h-4']={id:'h-4',position:{x:1,y:1},status:'alive'};
 assert.throws(()=>validate(s,[{actorId:'h-1',type:'bomb',targetId:'b-01'}],'gang-player',options),/bomb/);
 assert.throws(()=>validate(s,[{actorId:'h-1',type:'hit',targetId:'h-4'}],'gang-player',options),/gun/);
 buyEquipment(s,'pistol');buyEquipment(s,'bomb');assert.equal(s.hoods[1].inventory.gun,null);assert.equal(s.stockpile['gang-player'].pistol,1);equipEquipment(s,'h-1','pistol');equipEquipment(s,'h-1','bomb');assert.equal(s.cash['gang-player'],700);assert.equal(s.hoods[1].inventory.bombs,1);
 assert.doesNotThrow(()=>validate(s,[{actorId:'h-1',type:'hit',targetId:'h-4'}],'gang-player',options));
 buyEquipment(s,'tommy');equipEquipment(s,'h-1','tommy');assert.equal(s.stockpile['gang-player'].pistol,1);equipEquipment(s,'h-2','pistol');assert.equal(s.hoods[2].inventory.gun,'pistol');equipEquipment(s,'h-1','bomb',true);assert.equal(s.stockpile['gang-player'].bomb,1);equipEquipment(s,'h-2','bomb');assert.equal(s.stockpile['gang-player'].bomb,0);assert.throws(()=>equipEquipment(s,'h-1','bomb'),/stockpile/);assert.equal(s.cash['gang-player'],450);s.cash['gang-player']=0;assert.equal(s.hoods[1].inventory.gun,'tommy');assert.throws(()=>buyEquipment(s,'bomb'),/cash/);assert.throws(()=>equipEquipment(s,'h-4','bomb'));
});
test('wages exclude bosses; unpaid wages produce debt and deterministic desertions',()=>{
 const s=createGame();const first=settleWages(s,()=>1);assert.equal(first['gang-player'].current,40);assert.equal(s.cash['gang-player'],960);assert.equal(s.hoods[0].status,'alive');
 s.cash['gang-player']=10;const second=settleWages(s,()=>0);assert.equal(second['gang-player'].paid,10);assert.equal(second['gang-player'].debt,30);assert.equal(second['gang-player'].deserters.length,2);
 for(const h of s.hoods.slice(1,3)){assert.equal(h.status,'deserted');assert.equal(h.position,null);}assert.equal(s.hoods[0].status,'alive');
 s.cash['gang-player']=50;settleWages(s,()=>1);assert.equal(s.wageDebt['gang-player'],0);assert.equal(s.cash['gang-player'],20);
});
test('every actual bomb attempt consumes one bomb, including failures',()=>{
 let success=false,fail=false;
 for(let seed=1;seed<40;seed++){const s=createGame();s.hoods[1].inventory.bombs=2;const r=simulate(s,[{actorId:'h-1',type:'bomb',targetId:'b-01'}],seed);assert.equal(r.endState.hoods.find(h=>h.id==='h-1').inventory.bombs,1);success||=r.events.some(e=>e.data.detonated===true);fail||=r.events.some(e=>e.data.detonated===false);}
 assert.ok(success&&fail);
});
test('firearms stars give 5-9 percent per shot and weapon budgets are 10/20',()=>{
 assert.deepEqual([1,2,3,4,5].map(hitChance),[.05,.06,.07,.08,.09]);assert.equal(shotLimit('pistol'),10);assert.equal(shotLimit('tommy'),20);
});

test('rivals ignore hidden player orders, leave HQ, and retain street contacts instead of HQ sightings',()=>{
 const s=createGame();assert.deepEqual(npcOrders(s,[]),npcOrders(s,[{actorId:'h-0',type:'hit',targetId:'h-3'}]));
 assert.ok(npcOrders(s).every(o=>o.targetId!=='b-24'));
 const r=simulate(s,[],42);assert.ok(r.events.some(e=>e.actorGangId==='gang-rival'&&e.type==='move'));
 s.hoods[0].indoors=false;s.hoods[0].position={x:4,y:3};s.hoods[3].indoors=false;assert.equal(observe(s).hoods.some(h=>h.id==='h-3'),false);
 s.hoods[3].position={x:4,y:3};identifyNearby(s,()=>0,0,new Map());observe(s);s.hoods[3].position={x:4,y:4};s.hoods[3].indoors=true;observe(s);assert.deepEqual(s.intel.sightings['h-3'].position,{x:4,y:3});
});
test('legacy migration keeps four rated stats and clears dead positions without inventing equipment',()=>{
 const s=createGame();s.hoods[1].stats={intelligence:2,intimidation:4,firearms:3,fists:5,knives:1};delete s.hoods[1].inventory;s.hoods[1].status='dead';migrateGame(s);
 assert.deepEqual(Object.keys(s.hoods[1].stats),['intelligence','intimidate','firearms','explosives']);assert.equal(s.hoods[1].stats.intimidate,4);assert.equal(s.hoods[1].position,null);assert.equal(s.hoods[1].inventory.gun,null);
});
test('death reports have casualty outcomes, null positions, and staggered departures',()=>{
 let casualty=false;
 for(let seed=1;seed<60;seed++){
 const s=createGame();s.hoods[0].inventory.gun='pistol';s.hoods[3].position={x:0,y:0};s.hoods[3].indoors=false;const r=simulate(s,[{actorId:'h-0',type:'patrol',targetId:'b-00'},{actorId:'h-1',type:'extort',targetId:'b-06'}],seed);
 for(const e of r.events.filter(e=>e.type==='death')){casualty=true;assert.equal(e.outcome,null);assert.equal(r.endState.hoods.find(h=>h.id===e.data.victimId).position,null);}
 const starts=r.events.filter(e=>e.type==='order_start'&&e.actorGangId==='gang-player');if(starts.length===2)assert.ok(starts[1].tick>starts[0].tick);
 }assert.ok(casualty);
});

test('cash reconciles purchases, two weeks of wages, recruitment and one collection',()=>{
 const s=createGame();buyEquipment(s,'pistol');equipEquipment(s,'h-1','pistol');
 const first=simulate(s,[],42);assert.equal(first.endState.cash['gang-player'],860);
 const secondStart=first.endState;secondStart.week=2;secondStart.buildings.find(b=>b.id==='b-01').ownerId='gang-player';
 const second=simulate(secondStart,[{actorId:'h-0',type:'collect',targetId:'b-01'},{actorId:'h-1',type:'recruit',targetId:'b-00'},{actorId:'h-2',type:'collect',targetId:'b-01'}],42);
 const flows=second.events.filter(e=>e.actorGangId==='gang-player'&&e.data.cashDelta!==undefined);
 assert.equal(flows.filter(e=>e.data.cashDelta>0).reduce((n,e)=>n+e.data.cashDelta,0),20);
 assert.equal(second.endState.cash['gang-player'],840);
 assert.equal(second.endState.cash['gang-player'],second.startState.cash['gang-player']+flows.reduce((n,e)=>n+e.data.cashDelta,0));
 assert.equal(second.endState.lastPayroll['gang-player'].current,40);
});
