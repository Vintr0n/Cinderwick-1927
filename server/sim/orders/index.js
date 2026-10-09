import investigate from './investigate.js';
import buy from './buy.js';
import protect from './protect.js';
import returnOrder from './return.js';
import assassinate from './assassinate.js';
import recruit from './recruit.js';
import extort from './extort.js';
import collect from './collect.js';
import patrol from './patrol.js';
import bomb from './bomb.js';
import hit from './hit.js';
import {business} from '../model.js';
// Extension point: add order modules here. Bomb and hit are the two attack variants.
export const orders={recruit,extort,collect,patrol,bomb,hit,investigate,buy,protect,return:returnOrder,assassinate};
export function validate(state,queue,gangId,{checkAvailability=false}={}){
 if(!Array.isArray(queue)||queue.length>state.hoods.length) throw Error('Invalid order queue.');
 const used=new Set();
 for(const o of queue){
 const a=state.hoods.find(h=>h.id===o.actorId),spec=orders[o.type];
 if(!a||a.gangId!==gangId||a.status!=='alive'||used.has(a.id)||!spec) throw Error('Each living hood may receive one valid order.');
 used.add(a.id);
 if(a.stationedAt&&o.type!=='return')throw Error('Stationed crew must return to HQ before receiving another assignment.');
 if(['protect','assassinate'].includes(o.type)&&!a.inventory?.gun)throw Error('Equip a gun first.');
 if(checkAvailability&&o.type==='hit'&&!a.inventory?.gun)throw Error('Buy and equip a gun before issuing a hit.');
 if(checkAvailability&&o.type==='bomb'&&!(a.inventory?.bombs>0))throw Error('Buy a bomb before issuing a bomb order.');
 const t=spec.target==='enemy'?(state.intel?.sightings[o.targetId]??state.hoods.find(h=>h.id===o.targetId&&h.gangId!==gangId)):state.buildings.find(t=>t.id===o.targetId);
 if(o.type==='recruit'&&o.targetId&&!t)throw Error('Select a valid recruitment building.');
 if(spec.target!=='none'&&!t) throw Error('Select a valid target.');
 if(checkAvailability&&spec.target!=='enemy'&&t&&(t.closedUntilWeek??0)>=state.week)throw Error('This building is rubble and cannot accept orders until it reopens.');
 if(['business','owned'].includes(spec.target)&&!business(t)) throw Error('Only businesses can pay protection.');
 
 if(o.type==='protect'&&t?.propertyOwnerId!==gangId)throw Error('Protect requires a purchased property.');
 if(['collect','investigate','bomb'].includes(o.type)&&t?.propertyOwnerId===gangId)throw Error('Purchased properties cannot be collected from, investigated, or bombed by their owner.');
 if(o.type==='return'&&a.indoors&&state.buildings.some(b=>b.type==='hq'&&b.ownerId===gangId&&b.position.x===a.position?.x&&b.position.y===a.position?.y)&&!a.relocationPending)throw Error('Already at HQ.');
 if(a.relocationPending&&o.type!=='return')throw Error('This crew member must relocate this week.');
 const report=state.intel?.investigations?.[o.targetId];
 if(o.type==='buy'&&(!report||t?.propertyOwnerId||(t?.ownerId&&t.ownerId!==gangId)))throw Error('Investigate a business that is not enemy-controlled before buying.');
 if(o.type==='assassinate'&&!report?.residents.some(h=>h.boss&&h.gangId!==gangId))throw Error('Investigate and locate an enemy boss first.');
 if(spec.target==='enemy'&&(t.gangId===gangId||t.status==='dead')) throw Error('Select a living enemy.');
 }
 return queue.map(o=>({actorId:o.actorId,type:o.type,targetId:o.targetId??null,...(o.type==='hit'?{targetPosition:structuredClone(state.intel?.sightings[o.targetId]?.position??state.hoods.find(h=>h.id===o.targetId).position)}:{})}));
}
