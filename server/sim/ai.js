import {business,distance,compare} from './model.js';
import {open,terms} from './property.js';
import {buyEquipment,equipEquipment} from './economy.js';
const gang='gang-rival';
export function npcOrders(state){
 const crew=state.hoods.filter(h=>h.gangId===gang&&h.status==='alive').sort((a,b)=>Number(a.boss)-Number(b.boss)||compare(a,b));
 const hq=state.buildings.find(b=>b.type==='hq'&&b.ownerId===gang),assigned=new Set(),wages=crew.filter(h=>!h.boss).length*20;
 const income=state.buildings.filter(b=>b.ownerId===gang).reduce((sum,b)=>sum+(b.propertyOwnerId?terms(b)?.income??0:b.income),0);
 // Reserve wages before arming recruits. Purchases follow the same prices as the player.
 for(const h of crew)if(!h.inventory.gun){try{if(state.stockpile[gang].pistol) equipEquipment(state,h.id,'pistol',false,gang);else if(state.cash[gang]>=wages*2+100){buyEquipment(state,'pistol',gang);equipEquipment(state,h.id,'pistol',false,gang);}}catch{}}
 const hasCrew=state.hoods.some(h=>h.gangId===gang&&!h.boss&&['alive','hiding'].includes(h.status));
 const safeProperty=state.buildings.find(b=>b.propertyOwnerId===gang&&open(state,b));
 const workers=crew.filter(h=>(!h.stationedAt||(h.boss&&!hasCrew))&&(!h.boss||!hasCrew));
 let recruitmentPlanned=false,patrolPlanned=false,collectors=0;
 return crew.filter(h=>(!h.stationedAt||(h.boss&&!hasCrew))&&(!h.boss||!hasCrew||h.relocationPending||(safeProperty&&h.inventory.gun))).map(hood=>{
 const nearest=list=>list.filter(b=>!assigned.has(b.id)&&open(state,b)).sort((a,b)=>distance(hood.position,a.position)-distance(hood.position,b.position)||compare(a,b));
 const held=nearest(state.buildings.filter(b=>b.ownerId===gang&&!b.propertyOwnerId&&(b.heldIncome??0)>0)).sort((a,b)=>(b.heldIncome/(distance(hood.position,b.position)+1))-(a.heldIncome/(distance(hood.position,a.position)+1))||compare(a,b));
 const affordable=nearest(state.buildings.filter(b=>business(b)&&!b.propertyOwnerId&&(!b.ownerId||b.ownerId===gang)&&terms(b).price<=state.cash[gang]-wages*3));
 const targets=nearest(state.buildings.filter(b=>business(b)&&!b.propertyOwnerId&&b.ownerId!==gang));
 if(hood.id===crew[0]?.id&&crew.length>=3&&state.cash[gang]>=wages)targets.sort((a,b)=>distance(a.position,{x:2,y:2})-distance(b.position,{x:2,y:2})||compare(a,b));
 let order;
 if(hood.relocationPending||(hood.boss&&!hasCrew&&hood.stationedAt))order={type:'return'};
 else if(hood.boss&&hasCrew)order={type:'protect',targetId:safeProperty.id};
 else if(!patrolPlanned&&!hood.boss&&workers.length>=3&&hood.inventory.gun&&state.cash[gang]>=wages*2+40&&income>=wages){const border=state.buildings.filter(b=>b.ownerId===gang&&open(state,b)).sort((a,b)=>distance(a.position,{x:2,y:2})-distance(b.position,{x:2,y:2})||compare(a,b));patrolPlanned=true;order={type:'patrol',targetId:border[(state.week-1)%Math.min(3,border.length)]?.id??hq.id};}
 else if(held.length&&(state.cash[gang]<wages*2+40||collectors<Math.max(1,workers.length-(patrolPlanned?2:1)))&&!(crew.length<3&&state.cash[gang]>=(wages+20)*2&&!state.wageDebt[gang])){collectors++;order={type:'collect',targetId:held[0].id};}
 else if(!recruitmentPlanned&&crew.length<6&&!state.wageDebt[gang]&&state.cash[gang]>=(wages+20)*2&&(crew.length<3||income>=wages+20)&&open(state,hq)&&(state.recruitmentPools?.[hq.id]?.available??2)>0){recruitmentPlanned=true;order={type:'recruit',targetId:hq.id};}
 else if(hood.boss&&state.buildings.some(b=>b.propertyOwnerId===gang&&open(state,b))&&crew.length>=3){order={type:'protect',targetId:state.buildings.find(b=>b.propertyOwnerId===gang&&open(state,b)).id};}
 else if(affordable.length&&crew.length>=3){const target=affordable[0];order={type:state.rivalIntel?.investigations?.[target.id]?'buy':'investigate',targetId:target.id};}
 else if(!patrolPlanned&&state.week%3===0&&crew.length>=3&&hood.inventory.gun&&state.cash[gang]>=wages*2&&income>=wages){
 const known=state.buildings.filter(b=>b.ownerId===gang&&open(state,b)).sort(compare),border=known[(state.week-1)%Math.max(1,known.length)]??hq;patrolPlanned=true;order={type:'patrol',targetId:border.id};
 }else if(targets.length)order={type:'extort',targetId:targets[0].id};
 else order={type:'patrol',targetId:nearest(state.buildings.filter(b=>b.type!=='hq'))[0]?.id??hq.id};
 assigned.add(order.targetId);return {actorId:hood.id,...order};
 });
}
