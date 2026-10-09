import {terms} from './property.js';
import { distance,compare } from './model.js';
import {lineOfSight,location,length} from './navigation.js';
import { config } from '../../shared/config.js';
export function nearbyObserver(state,enemy){
 return state.hoods.find(h=>h.gangId==='gang-player'&&h.status==='alive'&&!h.indoors&&length(location(h),location(enemy))<=10&&lineOfSight(state,location(h),location(enemy)));
}
export function identifyNearby(state,rng,now,checks){
 state.intel.identified??={};const discoveries=[];
 for(const enemy of [...state.hoods].sort(compare)){
 if(enemy.gangId==='gang-player'||enemy.status!=='alive'||enemy.indoors||state.intel.identified[enemy.id]||state.intel.sightings[enemy.id])continue;
 const observer=nearbyObserver(state,enemy);if(!observer||now<(checks.get(enemy.id)??0))continue;
 checks.set(enemy.id,now+2000);
 if(rng()<.35){state.intel.identified[enemy.id]=true;discoveries.push({enemy,observer});}
 }
 return discoveries;
}
export function discoverTerritory(state,rng,now,checks){
 const discoveries=[],crew=state.hoods.filter(h=>h.gangId==='gang-player'&&h.status==='alive'&&!h.indoors).sort(compare);
 for(const building of [...state.buildings].sort(compare)){
 const owner=building.propertyOwnerId??building.ownerId;
 if(owner!=='gang-rival'||state.intel.buildings[building.id]===owner||now<(checks.get(building.id)??0))continue;
 const observer=crew.find(h=>distance(h.position,building.position)<=1);if(!observer)continue;
 checks.set(building.id,now+5000);
 if(rng()<.1){state.intel.buildings[building.id]=owner;discoveries.push({building,observer});}
 }
 return discoveries;
}
function anonymousId(state,id){let n=state.seed>>>0;for(const c of id)n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;return 'passerby-'+n.toString(36);}
export function observe(state) {
 const own=state.hoods.filter(h=>h.gangId==='gang-player'&&h.status==='alive'&&!h.indoors);
 const near=p=>own.some(h=>distance(h.position,p)<=config.sightRadius);
 for(const b of state.buildings)if(state.intel.buildings[b.id]==='gang-player'&&b.ownerId!=='gang-player'&&b.propertyOwnerId!=='gang-player'){delete state.intel.buildings[b.id];state.intel.lostProtection??={};state.intel.lostProtection[b.id]=true;}
 for(const b of [...state.buildings].sort(compare)) if(b.ownerId==='gang-player'||b.propertyOwnerId==='gang-player') state.intel.buildings[b.id]='gang-player';
 state.intel.damage??={};
 for(const b of state.buildings)if(near(b.position)||b.ownerId==='gang-player')state.intel.damage[b.id]=b.closedUntilWeek??0;
 const visible=state.hoods.filter(h=>h.gangId==='gang-player'||h.inCombat||(h.status==='dead'&&h.bodyVisible&&h.deathWeek===state.week)||(h.status==='alive'&&!h.indoors&&(state.intel.identified?.[h.id]||state.intel.sightings[h.id])&&nearbyObserver(state,h))).sort(compare);
 const visibleIds=new Set(visible.map(h=>h.id));
 const bystanders=state.hoods.filter(h=>h.gangId!=='gang-player'&&h.status==='alive'&&!h.indoors&&!visibleIds.has(h.id)).sort(compare).map(h=>({id:anonymousId(state,h.id),position:structuredClone(h.position),streetPosition:structuredClone(location(h)),travel:h.travel?structuredClone(h.travel):undefined}));
 for(const h of visible) if(h.gangId!=='gang-player') state.intel.sightings[h.id]={id:h.id,name:h.name,boss:h.boss,position:h.position?{...h.position}:null,week:state.week,status:h.status,gangId:h.gangId,stats:structuredClone(h.stats)};
 for(const h of state.hoods)if(h.gangId!=='gang-player'&&h.status==='dead'&&near(h.position)&&state.intel.sightings[h.id])state.intel.sightings[h.id].status='dead';
 return {id:state.id,week:state.week,winner:state.winner,bystanders,profile:structuredClone(state.profile),stockpile:structuredClone(state.stockpile?.['gang-player']??{pistol:0,tommy:0,bomb:0}),wageDebt:state.wageDebt?.['gang-player']??0,payroll:state.lastPayroll?.['gang-player']??null,cash:{'gang-player':state.cash['gang-player']},buildings:[...state.buildings].sort(compare).map(b=>({...b,type:b.type==='hq'&&b.ownerId!=='gang-player'&&!state.intel.investigations?.[b.id]?'shop':b.type,lostProtection:!!state.intel.lostProtection?.[b.id]&&!Object.hasOwn(state.intel.buildings,b.id),businessTerms:(b.propertyOwnerId==='gang-player'||state.intel.investigations?.[b.id])?terms(b):null,propertyOwnerId:b.propertyOwnerId==='gang-player'?'gang-player':state.intel.investigations?.[b.id]?.propertyOwnerId??null,heldIncome:b.ownerId==='gang-player'?b.heldIncome??0:undefined,incomeWeek:undefined,propertyIncomeWeek:undefined,closedUntilWeek:state.intel.damage[b.id]??0,ownerId:b.ownerId==='gang-player'?'gang-player':state.intel.buildings[b.id]??null,discovered:Object.hasOwn(state.intel.buildings,b.id)})),hoods:structuredClone(visible).map(h=>({...h,color:h.gangId==='gang-player'?state.profile?.color:'#e3947d'})),intel:structuredClone(state.intel)};
}
