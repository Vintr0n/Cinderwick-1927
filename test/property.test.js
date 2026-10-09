import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,migrateGame} from '../server/sim/model.js';
import {simulate} from '../server/sim/engine.js';
import {observe} from '../server/sim/visibility.js';
import {orders,validate} from '../server/sim/orders/index.js';
import {purchase,sellProperty,retire,payBusinessIncome,refreshHousing,terms,residents} from '../server/sim/property.js';
import {settleWages,equipment,accrueIncome} from '../server/sim/economy.js';
import {npcOrders} from '../server/sim/ai.js';
function context(state,target='b-01',rolls=[0]){
 let i=0;const events=[];return {state,target:state.buildings.find(b=>b.id===target),actor:state.hoods[1],rng:()=>rolls[Math.min(i++,rolls.length-1)],events,emit:(type,outcome,data)=>events.push({type,outcome,...data}),fail:message=>events.push({type:'fail',message}),kill:h=>{h.status='dead';if(h.boss)state.winner=h.gangId==='gang-player'?'gang-rival':'gang-player';},evacuate:h=>{h.evacuated=true;}};
}
test('city contains 100 unique blocks; legacy expansion preserves existing cash and ownership',()=>{
 const s=createGame();assert.equal(s.buildings.length,100);assert.equal(new Set(s.buildings.map(b=>b.position.x+','+b.position.y)).size,100);
 s.buildings=s.buildings.slice(0,25);s.schemaVersion=5;s.cash['gang-player']=321;s.buildings[1].ownerId='gang-player';migrateGame(s);
 assert.equal(s.buildings.length,100);assert.equal(s.cash['gang-player'],321);assert.equal(s.buildings[1].ownerId,'gang-player');
 assert.equal(equipment.bomb.price,200);
});
test('enemy ownership is revealed by extortion or successful investigation, never proximity',()=>{
 const s=createGame();s.hoods[0].indoors=false;s.buildings[1].ownerId='gang-rival';
 assert.equal(observe(s).buildings[1].ownerId,null);
 const c=context(s,'b-01',[.99]);orders.extort.resolve(c);assert.equal(observe(s).buildings[1].ownerId,'gang-rival');
});
test('investigation uses 35% + 2% per intelligence star and returns property terms',()=>{
 for(const stars of [1,5])for(const success of [true,false]){
 const s=createGame();s.hoods[1].stats.intelligence=stars;const c=context(s,'b-01',[.35+.02*stars+(success?-.00001:0)]);orders.investigate.resolve(c);
 const report=s.intel.investigations['b-01'];assert.equal(!!report,success);if(report){assert.equal(report.price,1000);assert.equal(report.income,40);}
 }
});
test('armed indoor protection intercepts investigators at 70%, preventing reports',()=>{
 const s=createGame(),c=context(s,'b-24',[.699,0]);orders.investigate.resolve(c);assert.equal(c.actor.status,'dead');assert.equal(s.intel.investigations['b-24'],undefined);
 const safe=createGame(),d=context(safe,'b-24',[.7,0]);orders.investigate.resolve(d);assert.ok(safe.intel.investigations['b-24'].residents.some(h=>h.boss));
});
test('purchased businesses use tier prices and automatic income, not protection collection',()=>{
 for(const size of ['small','medium','large']){
 const s=createGame(),b=s.buildings.find(b=>b.businessSize===size);s.cash['gang-player']=10000;
 orders.investigate.resolve(context(s,b.id));const price=purchase(s,s.hoods[1],b);assert.equal(price,terms(b).price);
 accrueIncome(s);assert.equal(b.heldIncome,0);const before=s.cash['gang-player'];payBusinessIncome(s);payBusinessIncome(s);assert.equal(s.cash['gang-player']-before,terms(b).income);
 const enemy=context(s,b.id);enemy.actor=s.hoods[4];orders.extort.resolve(enemy);assert.equal(b.ownerId,'gang-player');assert.equal(enemy.events[0].type,'fail');
 b.closedUntilWeek=2;s.week=2;const closed=s.cash['gang-player'];payBusinessIncome(s);assert.equal(s.cash['gang-player'],closed);assert.throws(()=>sellProperty(s,b.id),/rubble/);
 s.week=3;payBusinessIncome(s);assert.equal(sellProperty(s,b.id),price*.8);assert.equal(b.propertyOwnerId,null);
 }
});
test('buy and assassinate prerequisites are enforced by server validation and execution',()=>{
 const s=createGame();s.hoods[1].inventory.gun='pistol';assert.throws(()=>validate(s,[{actorId:'h-1',type:'buy',targetId:'b-01'}],'gang-player'));
 assert.throws(()=>validate(s,[{actorId:'h-1',type:'assassinate',targetId:'b-24'}],'gang-player'));
 orders.investigate.resolve(context(s));s.buildings[1].ownerId='gang-rival';assert.throws(()=>purchase(s,s.hoods[1],s.buildings[1]),/enemy/);
});
test('protect persists across weeks, armed crew return by order, selling evacuates occupants',()=>{
 const s=createGame(),b=s.buildings[1];b.propertyOwnerId=b.ownerId='gang-player';s.hoods[1].inventory.gun='pistol';
 let r=simulate(s,[{actorId:'h-1',type:'protect',targetId:b.id}],42);let h=r.endState.hoods.find(h=>h.id==='h-1');assert.equal(h.stationedAt,b.id);assert.equal(h.indoors,true);
 r.endState.week++;refreshHousing(r.endState);assert.deepEqual(h.position,b.position);assert.throws(()=>validate(r.endState,[{actorId:h.id,type:'patrol',targetId:b.id}],'gang-player'),/return/);
 r=simulate(r.endState,[{actorId:h.id,type:'return'}],42);h=r.endState.hoods.find(h=>h.id==='h-1');assert.equal(h.stationedAt,undefined);assert.deepEqual(h.position,{x:0,y:0});
 const c=context(s);orders.protect.resolve(c);sellProperty(s,b.id);assert.equal(c.actor.stationedAt,undefined);assert.equal(c.actor.relocationPending,true);assert.deepEqual(c.actor.position,b.position);const moved=simulate(s,[],42);assert.deepEqual(moved.endState.hoods.find(h=>h.id===c.actor.id).position,{x:0,y:0});assert.ok(moved.events.some(e=>e.actorId===c.actor.id&&e.type==='move'));
});
test('retirement returns equipment, cancels future wages, and forbids retiring boss',()=>{
 const s=createGame();s.hoods[1].inventory={gun:'tommy',bombs:2};retire(s,'h-1');assert.equal(s.stockpile['gang-player'].tommy,1);assert.equal(s.stockpile['gang-player'].bomb,2);assert.equal(settleWages(s,()=>1)['gang-player'].current,20);assert.throws(()=>retire(s,'h-0'),/boss/);
});
test('assassination checks armed guards individually before the 1% + stars roll',()=>{
 const s=createGame(),b=s.buildings.find(b=>b.id==='b-24');s.hoods[1].inventory.gun='pistol';s.hoods[1].stats.firearms=5;s.intel.investigations[b.id]={residents:[{id:'h-3',boss:true,gangId:'gang-rival'}]};
 const fail=context(s,b.id,[.99,.099,0]);orders.assassinate.resolve(fail);assert.equal(fail.actor.status,'dead');assert.equal(s.winner,null);
 fail.actor.status='alive';const win=context(s,b.id,[.1,.1,.05999]);orders.assassinate.resolve(win);assert.equal(s.winner,'gang-player');
 const stale=createGame();stale.hoods[1].inventory.gun='pistol';stale.intel.investigations[b.id]=s.intel.investigations[b.id];stale.hoods[3].indoors=false;const c=context(stale,b.id);orders.assassinate.resolve(c);assert.match(c.events[0].message,/no longer here/);
});
test('TNT has 20% + 5% per star detonation and 1% per occupant casualties',()=>{
 const s=createGame();s.hoods[1].inventory.bombs=2;s.hoods[1].stats.explosives=5;
 const miss=context(s,'b-24',[.45]);orders.bomb.resolve(miss);assert.equal(miss.events[0].detonated,false);assert.equal(s.hoods[1].inventory.bombs,1);
 const hit=context(s,'b-24',[.44999,.01,.009,.99]);orders.bomb.resolve(hit);assert.equal(s.hoods[3].evacuated,true);assert.equal(s.hoods[4].status,'dead');assert.equal(s.hoods[5].evacuated,true);assert.equal(s.hoods[1].inventory.bombs,0);assert.equal(hit.target.closedUntilWeek,2);
});
test('destroyed safe houses put survivors into hiding until repair, with wages still due',()=>{
 const s=createGame();s.buildings[0].closedUntilWeek=2;refreshHousing(s);assert.ok(s.hoods.slice(0,3).every(h=>h.status==='hiding'));assert.equal(settleWages(s,()=>1)['gang-player'].current,40);
 assert.throws(()=>validate(s,[{actorId:'h-1',type:'recruit'}],'gang-player'));
 s.week=3;refreshHousing(s);assert.ok(s.hoods.slice(0,3).every(h=>h.status==='alive'&&h.indoors));
});
test('rivals remain solvent, recruit and patrol over twenty uncontested weeks; lone boss still works',()=>{
 let s=createGame();const seen=new Set();for(let i=0;i<20;i++){const r=simulate(s,[],43+i);for(const e of r.events)if(e.actorGangId==='gang-rival'&&e.type==='order_start')seen.add(e.orderType);s=r.endState;s.week++;}
 for(const action of ['collect','extort','recruit','patrol'])assert.ok(seen.has(action),action);assert.equal(s.wageDebt['gang-rival'],0);assert.ok(s.hoods.filter(h=>h.gangId==='gang-rival'&&h.status==='alive').length>=3);
 const lone=createGame();lone.hoods[4].status=lone.hoods[5].status='dead';lone.cash['gang-rival']=0;assert.equal(npcOrders(lone)[0].type,'extort');
});
test('assassinating a stationed enemy boss wins immediately in the full timeline',()=>{
 const s=createGame(),b=s.buildings[1],boss=s.hoods[3];b.ownerId=b.propertyOwnerId='gang-rival';boss.stationedAt=b.id;boss.position={...b.position};
 s.hoods[5].status='dead';s.hoods[1].inventory.gun='pistol';s.hoods[1].stats.firearms=5;s.intel.investigations[b.id]={residents:[{id:boss.id,boss:true,gangId:boss.gangId}]};
 let win;for(let seed=0;seed<150&&!win;seed++){const r=simulate(s,[{actorId:'h-1',type:'assassinate',targetId:b.id}],seed);if(r.endState.winner)win=r;}
 assert.ok(win);assert.equal(win.endState.winner,'gang-player');assert.equal(win.endState.hoods.find(h=>h.id===boss.id).status,'dead');
});
test('a real blast evacuates surviving guards to HQ or puts them in hiding',()=>{
 for(const safeHQ of [true,false]){
 const s=createGame(),b=s.buildings[1],guard=s.hoods[2];b.ownerId=b.propertyOwnerId='gang-rival';guard.gangId='gang-rival';guard.stationedAt=b.id;guard.position={...b.position};guard.inventory.gun='pistol';s.hoods[1].inventory.bombs=1;s.hoods[1].stats.explosives=5;
 // Keep the bomber on the street when testing a destroyed HQ.
 if(!safeHQ){s.buildings.find(b=>b.id==='b-24').closedUntilWeek=2;s.hoods[1].indoors=false;}
 let blast;for(let seed=0;seed<30&&!blast;seed++){const r=simulate(s,[{actorId:'h-1',type:'bomb',targetId:b.id}],seed);if(r.events.some(e=>e.data.detonated)&&r.endState.hoods.find(h=>h.id===guard.id).status!=='dead')blast=r;}
 assert.ok(blast);const survivor=blast.endState.hoods.find(h=>h.id===guard.id);assert.equal(survivor.status,safeHQ?'alive':'hiding');assert.equal(survivor.stationedAt,undefined);assert.equal(survivor.indoors,true);if(safeHQ)assert.deepEqual(survivor.position,{x:4,y:4});
 }
});
test('orders can reach the far corner of the expanded city and return',()=>{
 const s=createGame(),b=s.buildings.find(b=>b.position.x===9&&b.position.y===9);s.hoods=s.hoods.filter(h=>h.gangId==='gang-player');
 const r=simulate(s,[{actorId:'h-1',type:'investigate',targetId:b.id}],42);assert.ok(r.events.some(e=>e.actorId==='h-1'&&e.type==='arrive'&&e.toPosition.x===9&&e.toPosition.y===9));assert.deepEqual(r.endState.hoods[1].position,{x:0,y:0});
});
