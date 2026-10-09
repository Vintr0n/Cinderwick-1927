import {refreshHousing,refuge,payBusinessIncome} from './property.js';
import {random,uuid} from './random.js';
import {compare,migrateGame} from './model.js';
import {settleWages,accrueIncome} from './economy.js';
import {observe,identifyNearby,discoverTerritory} from './visibility.js';
import {orders,validate} from './orders/index.js';
import {npcOrders} from './ai.js';
import {streetPosition} from '../../public/movement.js';
import {location,route,pathLength,along,canEngage,hitChance,shotLimit,length} from './navigation.js';
export function simulate(input,playerQueue,seed=input.seed+input.week){
 const state=migrateGame(structuredClone(input));if(state.winner)throw Error('Game already ended.');
 state.hoods.sort(compare);state.buildings.sort(compare);refreshHousing(state);accrueIncome(state);
 const citySize=Math.max(...state.buildings.map(b=>Math.max(b.position.x,b.position.y)))+1;
 const rng=random(seed),replay={timelineVersion:2,replayId:uuid(rng),gameId:state.id,week:state.week,seed,tickLengthMs:500,startState:structuredClone(state),events:[],endState:null};
 replay.startState.view=observe(state);
 const queue=[...validate(state,[...playerQueue,...state.hoods.filter(h=>h.gangId==='gang-player'&&h.status==='alive'&&h.relocationPending&&!playerQueue.some(o=>o.actorId===h.id)).map(h=>({actorId:h.id,type:'return'}))],'gang-player'),...npcOrders(state)].sort((a,b)=>a.actorId<b.actorId?-1:1),departures={};
 const tasks=queue.map(order=>{const actor=state.hoods.find(h=>h.id===order.actorId),start=departures[actor.gangId]??0;departures[actor.gangId]=start+1;return {actor,order,start,stage:'outbound',started:false,done:false,motion:null};});
 const taskFor=id=>tasks.find(t=>t.actor.id===id),collected=new Set(),guards=new Map(),encounters=[],engaged=new Set();
 const recognitionRng=random(seed^0x51a17),recognitionChecks=new Map(),territoryRng=random(seed^0x714e),territoryChecks=new Map();
 let tick=0,seq=0,now=0,lastContacts='';
 const emit=(actor,order,type,outcome=null,data={},from=actor?.position,to=actor?.position)=>{
 const e={tick,seq:seq++,type,orderType:order?.type??null,actorId:actor?.id??null,actorGangId:actor?.gangId??null,targetId:order?.targetId??null,fromPosition:from?{...from}:null,toPosition:to?{...to}:null,outcome,data:{...structuredClone(data),view:observe(state)}};
 replay.events.push(e);return e;
 };
 function kill(victim,actor,order){
 if(victim.status!=='alive')return;
 const last={...victim.position},visible=observe(state).hoods.some(h=>h.id===victim.id);
 victim.deathPosition=structuredClone(location(victim));victim.deathWeek=state.week;victim.bodyVisible=visible||!!victim.inCombat;
 victim.status='dead';victim.position=null;victim.streetPosition=null;delete victim.travel;victim.indoors=false;
 if(visible&&state.intel.sightings[victim.id])Object.assign(state.intel.sightings[victim.id],{status:'dead',position:null});
 if(victim.boss)state.winner=victim.gangId==='gang-player'?'gang-rival':'gang-player';
 emit(actor,order,'death',null,{victimId:victim.id,victimName:victim.name,message:victim.name+' was killed.'},last,last);
 }
 function move(task,destination,journey='outbound',speed=1,pathOverride=null,durationOverride=null){
 const h=task.actor,from={...h.position},path=pathOverride??route(state,location(h),streetPosition(destination,h.id));
 const durationMs=durationOverride??pathLength(path)/speed*1000;
 task.motion={path,start:now,durationMs,speed,destination,journey};h.travel={path,start:now,durationMs,speed};
 emit(h,task.order,'move',null,{path,durationMs,journey,speed},from,destination);
 }
 function stop(task){if(!task?.motion)return;task.motion=null;delete task.actor.travel;emit(task.actor,task.order,'motion_stop',null,{world:location(task.actor)});}
 function flee(h,threat){
 const task=taskFor(h.id);if(!task||h.status!=='alive')return;
 stop(task);const from=location(h),danger=threat.position?location(threat):from,choices=state.buildings.map(b=>b.position).sort((a,b)=>length(streetPosition(b,h.id),danger)-length(streetPosition(a,h.id),danger));
 const path=route(state,from,streetPosition(choices[0],h.id)),distance=Math.min(20,pathLength(path));
 const trimmed=[path[0]];let remaining=distance;
 for(let i=1;i<path.length;i++){const d=length(path[i-1],path[i]);if(d>=remaining){trimmed.push(along([path[i-1],path[i]],remaining));break;}trimmed.push(path[i]);remaining-=d;}
 task.fleeUntil=now+10000;emit(h,task.order,'flee',null,{durationMs:10000,message:h.name+' is fleeing for 10 seconds.'});
 move(task,h.position,'flee',distance/10,trimmed,10000);
 }
 function beginCombat(a,b,reason){
 if(!a.inventory.gun||!canEngage(state,a,b)||encounters.some(c=>[c.a.id,c.b.id].includes(a.id)||[c.a.id,c.b.id].includes(b.id)))return false;
 if(a.gangId==='gang-player'&&!observe(state).hoods.some(h=>h.id===b.id))return false;
 state.intel.identified??={};for(const h of [a,b])if(h.gangId!=='gang-player')state.intel.identified[h.id]=true;
 const key=[a.id,b.id].sort().join(':');if(engaged.has(key))return false;engaged.add(key);
 a.inCombat=b.inCombat=true;
 stop(taskFor(a.id));stop(taskFor(b.id));
 const encounter={a,b,reason,shots:{[a.id]:0,[b.id]:0},order:taskFor(a.id)?.order};encounters.push(encounter);
 emit(a,encounter.order,'combat_start',null,{targetHoodId:b.id,message:a.name+' opened fire on '+b.name+' ('+reason+').'});return true;
 }
 function fight(){
 for(let i=encounters.length-1;i>=0;i--){
 const c=encounters[i];
 for(const [shooter,target] of [[c.a,c.b],[c.b,c.a]]){
 if(state.winner||!shooter.inventory.gun||c.shots[shooter.id]>=shotLimit(shooter.inventory.gun)||!canEngage(state,shooter,target))continue;
 const chance=hitChance(shooter.stats.firearms),hit=rng()<chance,shot=++c.shots[shooter.id];
 emit(shooter,taskFor(shooter.id)?.order,'action_attempt',hit?'success':'fail',{kind:'gunfire',gun:shooter.inventory.gun,shooterId:shooter.id,targetHoodId:target.id,fromWorld:location(shooter),toWorld:location(target),shot,shotLimit:shotLimit(shooter.inventory.gun),chance,hit,message:shooter.name+' fired at '+target.name+' — shot '+shot+'/'+shotLimit(shooter.inventory.gun)+' ('+Math.round(chance*100)+'%): '+(hit?'hit and killed.':'missed.')},shooter.position,target.position);
 if(hit)kill(target,shooter,taskFor(shooter.id)?.order);
 }
 if(!canEngage(state,c.a,c.b)||[c.a,c.b].every(h=>!h.inventory.gun||c.shots[h.id]>=shotLimit(h.inventory.gun))){
 encounters.splice(i,1);c.a.inCombat=c.b.inCombat=false;emit(c.a,c.order,'combat_end',null,{participants:[c.a.id,c.b.id],message:'Gunfight ended: '+c.a.name+' / '+c.b.name+'.'});
 for(const [h,threat] of [[c.a,c.b],[c.b,c.a]]){const task=taskFor(h.id);if(task?.order.type==='hit')task.stage='return';if(h.status==='alive'&&!h.inventory.gun)flee(h,threat);}
 }
 }
 }
 for(tick=0;!state.winner;tick++){
 if(tick>10000)throw Error('Working week did not finish.');now=tick*500;seq=0;
 for(const task of tasks){
 const h=task.actor;if(h.status!=='alive'||task.done)continue;
 if(task.motion){const m=task.motion,elapsed=Math.min(now-m.start,m.durationMs);h.streetPosition=along(m.path,elapsed/1000*m.speed);h.position={x:Math.max(0,Math.min(citySize-1,Math.round(h.streetPosition[0]/6+2))),y:Math.max(0,Math.min(citySize-1,Math.round((h.streetPosition[2]-2.5)/6+2)))};
 if(elapsed>=m.durationMs){task.motion=null;delete h.travel;if(m.journey!=='flee')h.position={...m.destination};emit(h,task.order,'move_end',null,{journey:m.journey});}
 }
 }
 for(const {enemy,observer} of identifyNearby(state,recognitionRng,now,recognitionChecks))emit(observer,null,'sighting',null,{targetHoodId:enemy.id,message:observer.name+' spotted enemy '+enemy.name+'.'});
 for(const {building,observer} of discoverTerritory(state,territoryRng,now,territoryChecks))emit(observer,null,'territory_discovered','success',{buildingId:building.id,message:observer.name+' discovered that '+building.name+' is controlled by Blackthorn Crew.'});
 fight();if(state.winner)break;
 for(const task of tasks){
 const h=task.actor,order=task.order;
 if(h.status!=='alive'||task.done||tick<task.start||task.motion||encounters.some(c=>c.a.id===h.id||c.b.id===h.id))continue;
 if(task.fleeUntil){if(now<task.fleeUntil)continue;delete task.fleeUntil;emit(h,order,'flee_end',null,{message:h.name+' stopped fleeing and resumed the order.'});}
 if(!task.started){if(order.type==='return'){delete h.stationedAt;delete h.residenceId;delete h.relocationPending;task.stage='return';}task.started=true;h.indoors=false;h.streetPosition=location(h);emit(h,order,'order_start',null,{message:h.name+' stepped outside to begin the order.'});}
 const hq=refuge(state,h);
 if(!hq){h.status='hiding';h.position=null;h.indoors=true;delete h.streetPosition;delete h.travel;task.done=true;emit(h,order,'hiding',null,{message:h.name+' is in hiding until a safe property is repaired.'});continue;}
 if(task.stage==='return'){
 if(length(location(h),streetPosition(hq.position,h.id))>.01){move(task,hq.position,'return');continue;}
 h.position={...hq.position};h.residenceId=hq.id;h.indoors=true;delete h.streetPosition;task.done=true;emit(h,order,'arrive',null,{journey:'return',message:h.name+' returned to '+(hq.type==='hq'?'HQ':hq.name)+'.'});continue;
 }
 const building=state.buildings.find(b=>b.id===order.targetId),targetPosition=order.type==='hit'?order.targetPosition:building?.position??hq.position;
 if(task.stage==='outbound'){
 if(length(location(h),streetPosition(targetPosition,h.id))>.01){move(task,targetPosition);continue;}
 emit(h,order,'arrive');
 if(order.type==='hit'){task.stage='search';task.search=[...[[ -1,0],[1,0],[0,-1],[0,1]].map(([x,y])=>({x:targetPosition.x+x,y:targetPosition.y+y})).filter(p=>p.x>=0&&p.x<citySize&&p.y>=0&&p.y<citySize)];task.searchIndex=0;}
 else {
 const c={state,actor:h,target:building??(order.type==='recruit'?hq:undefined),order,rng,collected,guards,kill:v=>kill(v,h,order),evacuate:v=>{delete v.stationedAt;const home=refuge(state,v);let evacuation=taskFor(v.id);if(evacuation)stop(evacuation);if(!home){v.status='hiding';v.position=null;v.indoors=true;delete v.travel;delete v.streetPosition;if(evacuation)evacuation.done=true;emit(v,null,'hiding',null,{message:v.name+' is in hiding until repairs finish.'});return;}v.indoors=false;v.streetPosition=streetPosition(building.position,v.id);if(!evacuation){evacuation={actor:v,order:{type:'return',actorId:v.id},start:tick,started:true,done:false,motion:null};tasks.push(evacuation);}evacuation.done=false;evacuation.stage='return';emit(v,null,'evacuate',null,{message:v.name+' escaped the rubble and is returning to '+home.name+'.'});},emit:(type,outcome=null,data={})=>emit(h,order,type,outcome,data,h.position,building?.position??h.position),fail:message=>emit(h,order,'order_fail','fail',{message})};
 if(building&&(building.closedUntilWeek??0)>=state.week){c.fail('This building is rubble. The assignment cannot proceed until it reopens.');task.stage='return';continue;}
 if(order.type==='patrol'){task.stage='patrol';const x=(building.position.x-2)*6,z=(building.position.y-2)*6;task.patrolPath=[[x+2.5,.15,z+2.5],[x+2.5,.15,z-2.5],[x-2.5,.15,z-2.5],[x-2.5,.15,z+2.5],streetPosition(building.position,h.id)];task.patrolIndex=0;c.emit('action_result','success',{message:h.name+' is patrolling '+building.name+'.'});}
 else {orders[order.type].resolve(c);if(h.gangId==='gang-rival'&&['collect','extort'].includes(order.type)&&h.status==='alive'){const x=(building.position.x-2)*6,z=(building.position.y-2)*6;task.stage='patrol';task.patrolPath=[[x+2.5,.15,z+2.5],[x+2.5,.15,z-2.5],[x-2.5,.15,z-2.5],[x-2.5,.15,z+2.5],streetPosition(building.position,h.id)];task.patrolIndex=0;c.emit('patrol','success',{message:h.name+' is patrolling '+building.name+'.'});}else if(h.stationedAt&&h.indoors)task.done=true;else task.stage='return';}
 }
 }
 if(task.stage==='search'){
 const target=state.hoods.find(v=>v.id===order.targetId);
 if(target&&h.inventory.gun&&canEngage(state,h,target)&&beginCombat(h,target,'hit order'))continue;
 if(task.searchIndex>=task.search.length){emit(h,order,'order_fail','fail',{message:'Target not found near the last-seen location. Returning to HQ.'});task.stage='return';continue;}
 const next=task.search[task.searchIndex++];if(length(location(h),streetPosition(next,h.id))>.01){emit(h,order,'search',null,{message:h.name+' is searching around the last-seen block.'});move(task,next,'search');}
 }
 if(task.stage==='patrol'){
 while(task.patrolIndex<task.patrolPath.length&&length(location(h),task.patrolPath[task.patrolIndex])<.01)task.patrolIndex++;
 if(task.patrolIndex===task.patrolPath.length)task.stage='return';
 else move(task,building.position,'patrol',1,route(state,location(h),task.patrolPath[task.patrolIndex]));
 }
 }
 if(state.winner)break;
 for(const task of tasks.filter(t=>t.stage==='search'&&!t.done&&t.actor.status==='alive'&&!t.fleeUntil)){
 const target=state.hoods.find(h=>h.id===task.order.targetId);if(target)beginCombat(task.actor,target,'hit search');
 }
 for(const task of tasks.filter(t=>t.stage==='patrol'&&!t.done&&!t.fleeUntil&&t.actor.status==='alive'))for(const enemy of state.hoods)if(beginCombat(task.actor,enemy,'patrol sighting'))break;
 for(const task of tasks.filter(t=>t.actor.shootOnSight&&!t.done&&t.started&&!t.fleeUntil&&t.actor.status==='alive'))for(const enemy of state.hoods)if(beginCombat(task.actor,enemy,'shoot on sight'))break;
 const ids=observe(state).hoods.filter(h=>h.gangId!=='gang-player').map(h=>h.id).join(',');if(ids!==lastContacts){lastContacts=ids;emit(null,null,'observation');}
 if(tasks.every(t=>t.done||t.actor.status!=='alive')&&!encounters.length)break;
 }
 for(const h of state.hoods.filter(h=>h.status==='dead'&&h.inventory.gun)){const gun=h.inventory.gun;state.stockpile[h.gangId][gun]++;h.inventory.gun=null;emit(h,null,'equipment_recovered',null,{message:h.name+"'s gun was recovered to the outfit stockpile."});}
 if(!state.winner){
 for(const {building,amount} of payBusinessIncome(state)){const boss=state.hoods.find(h=>h.gangId===building.propertyOwnerId&&h.boss);emit(boss,null,'action_result','success',{kind:'business_income',cashDelta:amount,message:building.name+' paid $'+amount+' in automatic business income.'});}
 const payroll=settleWages(state,rng);seq++;
 for(const gang of ['gang-player','gang-rival']){
 const row=payroll[gang],boss=state.hoods.find(h=>h.gangId===gang&&h.boss);
 emit(boss,null,'action_result',row.debt?'partial':'success',{kind:'payroll',payroll:row,cashDelta:-row.paid,message:'Payroll: $'+row.paid+' paid of $'+row.due+' due. Outstanding wages: $'+row.debt+'. Boss excluded.'});
 for(const h of row.deserters)emit(boss,null,'action_result','fail',{kind:'desertion',hoodId:h.id,message:h.name+' deserted over unpaid wages.'});
 }
 }
 replay.endState=structuredClone(state);replay.endState.view=observe(state);replay.durationMs=tick*500;return replay;
}
