export const economy={weeklyWage:20,recruitCost:0};
export function accrueIncome(state){
 for(const b of state.buildings){
 b.heldIncome??=0;if(!b.propertyOwnerId)b.heldIncome=Math.min(120,b.heldIncome);
 if(!b.functionalInV1||!b.businessSize||!b.ownerId||b.propertyOwnerId)continue;
 if((b.incomeWeek??0)>=state.week)continue;
 if((b.closedUntilWeek??0)<state.week)b.heldIncome=Math.min(120,b.heldIncome+b.income);
 b.incomeWeek=state.week;
 }
}
export const equipment={pistol:{id:'pistol',name:'Colt M1911',price:100,shots:10},tommy:{id:'tommy',name:'Tommy gun',price:250,shots:20},bomb:{id:'bomb',name:'TNT',price:200}};
export function buyEquipment(state,itemId,gangId='gang-player'){
 const item=Object.hasOwn(equipment,itemId)?equipment[itemId]:null;
 if(!item)throw Error('Choose a valid item.');
 if((state.wageDebt[gangId]??0)>0)throw Error('Outstanding wages must be paid before buying equipment.');
 if(state.cash[gangId]<item.price)throw Error('Not enough cash for '+item.name+'.');
 state.cash[gangId]-=item.price;state.stockpile[gangId][itemId]++;
 return {itemId,cost:item.price};
}
export function equipEquipment(state,actorId,itemId,returnItem=false,gangId='gang-player'){
 const hood=state.hoods.find(h=>h.id===actorId&&h.gangId===gangId&&h.status==='alive');
 if(!hood||!Object.hasOwn(equipment,itemId))throw Error('Choose a living hood and a valid item.');
 const stock=state.stockpile[gangId],inventory=hood.inventory;
 if(returnItem&&itemId!=='bomb'&&hood.stationedAt)throw Error('Return to HQ before surrendering a stationed guard?s gun.');
 if(returnItem){
 if(itemId==='bomb'){if(!inventory.bombs)throw Error('No bomb to return.');inventory.bombs--;}
 else {if(inventory.gun!==itemId)throw Error('This gun is not equipped.');inventory.gun=null;}
 stock[itemId]++;return;
 }
 if(stock[itemId]<1)throw Error('This item is not available in the stockpile.');
 if(itemId==='bomb'){if(inventory.bombs>=20)throw Error('A hood can carry at most 20 bombs.');inventory.bombs++;}
 else {if(inventory.gun===itemId)throw Error('This gun is already equipped.');if(inventory.gun)stock[inventory.gun]++;inventory.gun=itemId;}
 stock[itemId]--;
}
export function settleWages(state,rng){
 const rows={};
 for(const gang of ['gang-player','gang-rival']){
 const crew=state.hoods.filter(h=>h.gangId===gang&&['alive','hiding'].includes(h.status)&&!h.boss).sort((a,b)=>a.id<b.id?-1:1),current=crew.length*economy.weeklyWage,arrears=state.wageDebt[gang]??0,due=current+arrears,paid=Math.min(state.cash[gang],due);
 state.cash[gang]-=paid;state.wageDebt[gang]=due-paid;
 const deserters=[];
 if(due>paid)for(const h of crew)if(rng()<.1+.3*(due-paid)/due){h.status='deserted';h.position=null;h.indoors=false;deserters.push({id:h.id,name:h.name});}
 rows[gang]={crew:crew.length,rate:economy.weeklyWage,current,arrears,due,paid,debt:due-paid,deserters};
 }
 state.lastPayroll={week:state.week,...rows};return rows;
}

export function sellEquipment(state,itemId,quantity=1,gangId='gang-player'){
 if(!['pistol','tommy'].includes(itemId))throw Error('Only spare guns can be sold.');
 if(!Number.isSafeInteger(quantity)||quantity<1)throw Error('Choose a positive whole quantity.');
 const stock=state.stockpile[gangId];if(stock[itemId]<quantity)throw Error('Not enough spare guns. Return equipped guns to the stockpile first.');
 const proceeds=equipment[itemId].price*.9*quantity;stock[itemId]-=quantity;state.cash[gangId]+=proceeds;return proceeds;
}
