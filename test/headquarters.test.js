import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,configureGame,migrateGame} from '../server/sim/model.js';
import {observe} from '../server/sim/visibility.js';
const profile={bossName:'Vincent Moretti',outfitName:'Vale Outfit',color:'#82b9a0'};
test('new outfits get reproducible, widely separated undercover headquarters',()=>{
 const locations=new Set();
 for(let seed=1;seed<=100;seed++){
  const s=createGame(seed);configureGame(s,profile);
  const bases=s.buildings.filter(b=>b.type==='hq');
  assert.equal(bases.length,2);assert.ok(Math.hypot(bases[0].position.x-bases[1].position.x,bases[0].position.y-bases[1].position.y)>=6);
  assert.equal(new Set(s.buildings.map(b=>JSON.stringify(b.position))).size,100);
  for(const b of bases){assert.ok(!/Vale Freight|Blackthorn/.test(b.name));assert.ok(s.hoods.filter(h=>h.gangId===b.ownerId).every(h=>JSON.stringify(h.position)===JSON.stringify(b.position)));}
  const clone=createGame(seed);configureGame(clone,profile);assert.deepEqual(clone,s);
  const positions=structuredClone(bases);migrateGame(s);assert.deepEqual(s.buildings.filter(b=>b.type==='hq').map(b=>b.position),positions.map(b=>b.position));
  const rival=bases.find(b=>b.ownerId==='gang-rival');assert.notEqual(observe(s).buildings.find(b=>b.id===rival.id).type,'hq');
  locations.add(JSON.stringify(bases.map(b=>b.position)));
 }
 assert.ok(locations.size>50);
});
test('loading an established campaign keeps its headquarters and resident locations',()=>{
 const s=createGame(),positions=s.hoods.map(h=>h.position);migrateGame(s);
 assert.deepEqual(s.hoods.map(h=>h.position),positions);
 assert.deepEqual(s.buildings.find(b=>b.id==='b-00').position,{x:0,y:0});
});
