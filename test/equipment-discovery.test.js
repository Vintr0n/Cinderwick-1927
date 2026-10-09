import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../server/sim/model.js';
import {sellEquipment} from '../server/sim/economy.js';
import {discoverTerritory,observe} from '../server/sim/visibility.js';
test('territory discovery rolls at ten percent, is throttled, and persists without granting investigation',()=>{
 const s=createGame(),b=s.buildings[1],checks=new Map();b.ownerId='gang-rival';s.hoods[1].indoors=false;
 assert.equal(discoverTerritory(s,()=>.1,0,checks).length,0);
 assert.equal(discoverTerritory(s,()=>0,4999,checks).length,0);
 assert.equal(discoverTerritory(s,()=>.099,5000,checks).length,1);
 assert.equal(observe(s).buildings[1].ownerId,'gang-rival');assert.equal(s.intel.investigations[b.id],undefined);
 s.hoods[1].indoors=true;assert.equal(observe(s).buildings[1].ownerId,'gang-rival');
 assert.equal(discoverTerritory(s,()=>0,10000,checks).length,0);
});
test('indoor, dead and distant crew cannot discover territory',()=>{
 const s=createGame();s.buildings[1].ownerId='gang-rival';assert.equal(discoverTerritory(s,()=>0,0,new Map()).length,0);
 s.hoods[1].indoors=false;s.hoods[1].position={x:9,y:9};assert.equal(discoverTerritory(s,()=>0,0,new Map()).length,0);
 s.hoods[1].position={x:0,y:0};s.hoods[1].status='dead';assert.equal(discoverTerritory(s,()=>0,0,new Map()).length,0);
});
test('selling spare guns credits ninety percent per item and never removes equipped weapons',()=>{
 const s=createGame();s.stockpile['gang-player']={pistol:7,tommy:1,bomb:40};s.hoods[1].inventory.gun='pistol';
 assert.equal(sellEquipment(s,'pistol',7),630);assert.equal(sellEquipment(s,'tommy'),225);assert.equal(s.cash['gang-player'],1855);assert.equal(s.hoods[1].inventory.gun,'pistol');
 for(const q of [0,-1,1.5,NaN,Infinity,1])assert.throws(()=>sellEquipment(s,'pistol',q));assert.throws(()=>sellEquipment(s,'bomb',1));assert.equal(s.stockpile['gang-player'].bomb,40);
});
