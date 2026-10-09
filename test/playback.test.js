import test from 'node:test';
import assert from 'node:assert/strict';
import {presentation} from '../public/playback.js';
import {travelDuration,streetSpeed,streetPath} from '../public/movement.js';
import {actionDescription} from '../public/replay-actions.js';
test('replay action descriptions distinguish assignments, return journeys, and failed orders',()=>{
 const state={buildings:[{id:'b-1',name:'Mercer Grocer'}],hoods:[],intel:{sightings:{}}};
 assert.equal(actionDescription({type:'move',orderType:'extort',targetId:'b-1',data:{}},state),'Extort Mercer Grocer');
 assert.equal(actionDescription({type:'move',orderType:'extort',targetId:'b-1',data:{journey:'return'}},state),'Heading back to HQ');
 assert.equal(actionDescription({type:'arrive',data:{journey:'return'}},state),'Inside HQ');
 assert.match(actionDescription({type:'order_fail',data:{}},state),/Order failed/);
 assert.equal(actionDescription({type:'action_result',data:{}},state),null);
});
test('the new normal pace equals the previous half-speed travel time',()=>{
 assert.equal(streetSpeed,1);
 assert.ok(Math.abs(travelDuration({actorId:'h-0',fromPosition:{x:0,y:0},toPosition:{x:1,y:0}})-6000)<.001);
});
test('replay timing accommodates street detours at the shared ambient speed before showing results',()=>{
 const events=[
 {type:'move',tick:0,seq:0,actorId:'h-1',fromPosition:{x:0,y:0},toPosition:{x:1,y:0}},
 {type:'move',tick:0,seq:1,actorId:'h-5',fromPosition:{x:2,y:0},toPosition:{x:2,y:1}},
 {type:'action_result',tick:0,seq:2},
 {type:'move',tick:1,seq:0,actorId:'h-1',fromPosition:{x:1,y:0},toPosition:{x:2,y:0}}
 ];
 const p=presentation({tickLengthMs:500,events});
 for(const entry of p.entries.filter(e=>e.kind==='move')){
 const path=streetPath(entry.event.fromPosition,entry.event.toPosition,entry.event.actorId);
 const length=path.slice(1).reduce((s,v,i)=>s+Math.hypot(...v.map((n,j)=>n-path[i][j])),0);
 assert.equal(length/(entry.duration/1000),streetSpeed);
 const arrival=p.entries.find(e=>e.kind==='view'&&e.event===entry.event);
 assert.ok(arrival.at>=entry.at+entry.duration);
 }
 assert.ok(travelDuration(events[1])>travelDuration(events[0]));
 assert.equal(p.entries.find(e=>e.event===events[2]).at,travelDuration(events[1]));
});
