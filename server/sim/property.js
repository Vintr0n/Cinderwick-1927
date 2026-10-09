export const propertyRates={small:{price:1000,income:40},medium:{price:1500,income:100},large:{price:2500,income:175}};
export const terms=b=>propertyRates[b?.businessSize]??null;
export const open=(state,b)=>b&&(b.closedUntilWeek??0)<state.week;
export const intelFor=(state,gang)=>gang==='gang-player'?state.intel:(state.rivalIntel??={buildings:{},investigations:{}});
export const residents=(state,b)=>state.hoods.filter(h=>h.status==='alive'&&h.indoors&&h.position?.x===b.position.x&&h.position?.y===b.position.y);
export function refuge(state,h){
 const owned=state.buildings.filter(b=>(b.type==='hq'&&b.ownerId===h.gangId)||b.propertyOwnerId===h.gangId);
 return owned.find(b=>b.id===h.stationedAt&&open(state,b))??owned.find(b=>b.id===h.residenceId&&open(state,b))??owned.find(b=>b.type==='hq'&&open(state,b))??owned.find(b=>open(state,b));
}
export function refreshHousing(state){
 for(const h of state.hoods.filter(h=>['alive','hiding'].includes(h.status))){
 if(h.relocationPending&&refuge(state,h))continue;
 const b=refuge(state,h);
 if(!b){h.status='hiding';h.position=null;h.indoors=true;delete h.streetPosition;delete h.travel;continue;}
 if(h.status==='hiding'||h.indoors){h.status='alive';h.position={...b.position};h.residenceId=b.id;h.indoors=true;delete h.streetPosition;delete h.travel;if(h.stationedAt&&h.stationedAt!==b.id)delete h.stationedAt;}
 }
}
export function purchase(state,actor,b){
 const report=intelFor(state,actor.gangId).investigations?.[b.id],rate=terms(b);
 if(!report||!rate)throw Error('Successfully investigate this business before buying it.');
 if(!open(state,b))throw Error('Rubble cannot be purchased.');
 if(b.propertyOwnerId||(b.ownerId&&b.ownerId!==actor.gangId))throw Error('An enemy-controlled or already purchased property cannot be bought.');
 if(state.cash[actor.gangId]<rate.price)throw Error('Not enough cash to buy this property.');
 state.cash[actor.gangId]-=rate.price;b.propertyOwnerId=actor.gangId;b.ownerId=actor.gangId;const balance=b.heldIncome??0;state.cash[actor.gangId]+=balance;b.heldIncome=0;
 return rate.price-balance;
}
export function sellProperty(state,id,gang='gang-player'){
 const b=state.buildings.find(b=>b.id===id);
 if(!b||b.propertyOwnerId!==gang)throw Error('You do not own this property.');
 if(!open(state,b))throw Error('Cannot sell rubble before repairs finish.');
 const occupants=residents(state,b);for(const h of occupants){delete h.stationedAt;delete h.residenceId;h.relocationPending=true;}
 const amount=terms(b).price*.8+(b.heldIncome??0);state.cash[gang]+=amount;b.propertyOwnerId=null;b.ownerId=null;b.heldIncome=0;
 if(gang==='gang-player')state.intel.buildings[b.id]=null;refreshHousing(state);
 return amount;
}
export function retire(state,id,gang='gang-player'){
 const h=state.hoods.find(h=>h.id===id&&h.gangId===gang&&['alive','hiding'].includes(h.status));
 if(!h||h.boss)throw Error('Choose a crew member; the boss cannot retire.');
 if(h.inventory.gun)state.stockpile[gang][h.inventory.gun]++;
 state.stockpile[gang].bomb+=h.inventory.bombs;h.inventory={gun:null,bombs:0};h.status='retired';h.position=null;h.indoors=false;delete h.stationedAt;delete h.streetPosition;
}
export function payBusinessIncome(state){
 const payments=[];
 for(const b of state.buildings){
 if(!b.propertyOwnerId||!terms(b)||(b.propertyIncomeWeek??0)>=state.week)continue;
 b.propertyIncomeWeek=state.week;if(!open(state,b))continue;
 const amount=terms(b).income;state.cash[b.propertyOwnerId]+=amount;payments.push({building:b,amount});
 }
 return payments;
}
