import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,migrateGame} from '../server/sim/model.js';
import {npcOrders} from '../server/sim/ai.js';
import {accrueIncome} from '../server/sim/economy.js';
test('boss with living crew never receives routine street work, but can station or relocate',()=>{
 const s=createGame();for(let week=1;week<=10;week++){s.week=week;s.cash['gang-rival']=week*300;assert.equal(npcOrders(s).some(o=>o.actorId==='h-3'),false);}
 s.buildings[1].propertyOwnerId=s.buildings[1].ownerId='gang-rival';assert.equal(npcOrders(s).find(o=>o.actorId==='h-3').type,'protect');
 s.hoods[3].relocationPending=true;assert.equal(npcOrders(s).find(o=>o.actorId==='h-3').type,'return');
});
test('a lone boss leaves protection and resumes work after returning home',()=>{
 const s=createGame();s.hoods[4].status=s.hoods[5].status='dead';s.hoods[3].stationedAt='b-01';assert.equal(npcOrders(s).find(o=>o.actorId==='h-3').type,'return');
 delete s.hoods[3].stationedAt;s.cash['gang-rival']=0;assert.equal(npcOrders(s).find(o=>o.actorId==='h-3').type,'extort');
});
test('extorted businesses hold at most $120 across accrual and old-save migration',()=>{
 const s=createGame(),b=s.buildings[1];b.ownerId='gang-player';b.heldIncome=110;accrueIncome(s);assert.equal(b.heldIncome,120);
 for(let i=0;i<10;i++){s.week++;accrueIncome(s);}assert.equal(b.heldIncome,120);
 b.heldIncome=500;migrateGame(s);assert.equal(b.heldIncome,120);
 b.heldIncome=0;s.week++;accrueIncome(s);assert.equal(b.heldIncome,b.income);
});
