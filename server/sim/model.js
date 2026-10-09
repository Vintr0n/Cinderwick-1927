import {refreshRecruitment} from './recruitment.js';
import { readFileSync } from 'node:fs';
import { random, uuid } from './random.js';
import { stats } from '../../shared/config.js';
const map = JSON.parse(readFileSync(new URL('../../shared/buildings.json', import.meta.url),'utf8'));
export const compare = (a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
export const distance = (a,b) => a&&b?Math.abs(a.x-b.x)+Math.abs(a.y-b.y):Infinity;
export const business = b => b.functionalInV1 && !!b.businessSize;
 const names=['Vincent Moretti','Frankie Doyle','Salvatore Russo','Arthur Malloy','Mae Sullivan','Mickey Caruso','Rose O\'Malley','Eddie DeLuca','Josephine Bellini','Louie Brennan','Vera Costello','Albert Falco','Rocco Marino','Jack Donnelly','Pearl Mancini','Benny Ferraro','Morris Kaplan','Johnny Vitale','Nora Callahan','Willie Rosenthal'];
 const first=['Anthony','Angelo','Antonio','Carlo','Carmine','Charles','Dominic','Enrico','Eugene','Felix','Frank','Frederick','George','Henry','Jack','James','John','Joseph','Leonard','Lorenzo','Louis','Mario','Michael','Nicholas','Paul','Peter','Philip','Ralph','Raymond','Richard','Robert','Rocco','Salvatore','Samuel','Thomas','Tony','Victor','Vincent','Walter','William','Alfred','Albert','Bernard','Edward','Ernest','Francis','Harold','Pasquale','Vito','Rudolph','Ada','Anna','Clara','Dorothy','Edith','Eleanor','Florence','Frances','Grace','Helen','Ida','Josephine','Lillian','Louise','Lucille','Margaret','Marie','Mildred','Nellie','Rose','Ruth','Stella'];
 const last=['Amato','Basile','Bellini','Bianchi','Caruso','Cassano','Colombo','Conti','Costa',"D'Angelo",'DeLuca','DeMarco','DiStefano','Esposito','Falco','Farina','Ferrara','Ferraro','Fiore','Fontana','Gallo','Gentile','Giordano','Greco','Lombardi','Lombardo','Longo','Mancini','Marino','Martino','Messina','Morello','Moretti','Napolitano','Palermo','Pellegrino','Rizzo','Romano','Rossetti','Rossi','Russo','Santoro','Serra','Silvestri','Tedesco','Vitale','Ricci','Doyle','Brennan','Callahan','Donnelly','Flanagan','Gallagher','Kelly','Malloy','McKenna','Moran','Murphy','Sullivan','Walsh','Kaplan','Klein','Levine','Rosenthal','Shapiro'];
 names.push(...first.flatMap(given=>last.map(family=>given+' '+family)).filter(name=>!names.includes(name)));
export function makeHood(id,gangId,position,rng,boss=false,usedNames=[]) {
 const available=names.filter(name=>!usedNames.includes(name));
 const name=boss&&gangId==='gang-player'?'Vincent Moretti':available.length?available[Math.floor(rng()*available.length)]:names[Math.floor(rng()*names.length)]+' '+id.split('-')[1];
 return {id,gangId,name,boss,shootOnSight:false,indoors:true,position:{...position},inventory:{gun:gangId==='gang-rival'?'pistol':null,bombs:0},stats:Object.fromEntries(stats.map(s=>[s,1+Math.floor(rng()*5)])),status:'alive'};
}
export function createGame(seed=1927) {
 const rng=random(seed);
 const usedNames=[],hood=(id,gang,position,boss=false)=>{const h=makeHood(id,gang,position,rng,boss,usedNames);usedNames.push(h.name);return h;};
 return {id:uuid(rng),seed,week:1,winner:null,buildings:structuredClone(map),hoods:[
 hood('h-0','gang-player',{x:0,y:0},true),hood('h-1','gang-player',{x:0,y:0}),hood('h-2','gang-player',{x:0,y:0}),
 hood('h-3','gang-rival',{x:4,y:4},true),hood('h-4','gang-rival',{x:4,y:4}),hood('h-5','gang-rival',{x:4,y:4})],
 profile:{bossName:'Vincent Moretti',outfitName:'Vale Syndicate',color:'#82b9a0'},schemaVersion:6,
 stockpile:{'gang-player':{pistol:0,tommy:0,bomb:0},'gang-rival':{pistol:0,tommy:0,bomb:0}},
 cash:{'gang-player':1000,'gang-rival':100},wageDebt:{'gang-player':0,'gang-rival':0},intel:{buildings:{},sightings:{},investigations:{}},rivalIntel:{buildings:{},investigations:{}},nextHood:6};
}
export function migrateGame(state){
 if((state.schemaVersion??0)<6){for(const definition of map)if(!state.buildings.some(b=>b.id===definition.id))state.buildings.push(structuredClone(definition));}
 state.intel.investigations??={};state.rivalIntel??={buildings:{},investigations:{}};
 state.profile??={bossName:state.hoods.find(h=>h.gangId==='gang-player'&&h.boss)?.name??'Ada Voss',outfitName:'Vale Syndicate',color:'#82b9a0'};
 state.wageDebt??={'gang-player':0,'gang-rival':0};
 state.stockpile??={'gang-player':{pistol:0,tommy:0,bomb:0},'gang-rival':{pistol:0,tommy:0,bomb:0}};
 for(const h of state.hoods){
 const old=h.stats??{},rng=random((state.seed+Number(h.id.split('-')[1])*997)>>>0);
 h.stats=Object.fromEntries(stats.map(key=>[key,Math.max(1,Math.min(5,Math.round(old[key]??(key==='intimidate'?old.intimidation:undefined)??(1+Math.floor(rng()*5)))))]));
 h.shootOnSight??=false;
 h.inventory??={gun:h.gangId==='gang-rival'?'pistol':null,bombs:0};
 if(!['alive','hiding'].includes(h.status)){h.position=null;h.indoors=false;}
 }
 for(const h of Object.values(state.intel.sightings)){if(h.status==='dead')h.position=null;}
 for(const b of state.buildings){b.heldIncome??=0;if(!b.propertyOwnerId)b.heldIncome=Math.min(120,b.heldIncome);}
 for(const b of state.buildings){const definition=map.find(item=>item.id===b.id);if(definition){b.income=definition.income;b.businessSize=definition.businessSize;b.type=definition.type;b.functionalInV1=definition.functionalInV1;}b.propertyOwnerId??=null;}
 for(const b of state.buildings)if(b.propertyOwnerId&&(b.heldIncome??0)>0){state.cash[b.propertyOwnerId]+=b.heldIncome;b.heldIncome=0;}
 refreshRecruitment(state);state.schemaVersion=6;return state;
}
export function randomizeHeadquarters(state){
 if(state.headquartersPlaced)return;
 const rng=random(state.seed^0x483119),hq=state.buildings.filter(b=>b.type==='hq');
 const candidates=state.buildings.filter(b=>b.type==='shop'&&!b.ownerId);
 const first=candidates[Math.floor(rng()*candidates.length)];
 // Six centre-to-centre blocks leave at least five clear blocks between bases.
 const far=candidates.filter(b=>Math.hypot(b.position.x-first.position.x,b.position.y-first.position.y)>=6);
 const second=far[Math.floor(rng()*far.length)];
 for(const [i,base] of hq.entries()){
  const storefront=i===0?first:second,old={...base.position};
  base.position={...storefront.position};storefront.position=old;
  base.name=storefront.name;storefront.name=i===0?'Hawthorne Storage':'Canal Freight';
  for(const h of state.hoods.filter(h=>h.gangId===base.ownerId)){h.position={...base.position};h.residenceId=base.id;}
 }
 state.intel.buildings={};state.headquartersPlaced=true;
}
export function configureGame(state,profile){
 const validName=value=>typeof value==='string'&&value.trim().length>=2&&value.trim().length<=32&&!/[\x00-\x1f<>]/.test(value);
 if(!profile||!validName(profile.bossName)||!validName(profile.outfitName)||!/^#[0-9a-f]{6}$/i.test(profile.color??''))throw Error('Use names of 2-32 characters and a valid outfit color.');
 randomizeHeadquarters(state);
 state.profile={bossName:profile.bossName.trim(),outfitName:profile.outfitName.trim(),color:profile.color.toLowerCase()};
 state.hoods.find(h=>h.gangId==='gang-player'&&h.boss).name=state.profile.bossName;
}
