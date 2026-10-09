// Describe only an event already presented to the player, never a future order.
export function actionDescription(event,state){
 if(event.type==='flee'||event.data?.journey==='flee')return 'Fleeing — 10 seconds';
 if(event.type==='search'||event.data?.journey==='search')return 'Searching near the last-seen block';
 if(event.data?.kind==='gunfire'||event.type==='combat_start')return 'Shooting at '+(state.hoods.find(h=>h.id===event.data.targetHoodId)?.name??'an enemy');
 if(event.data?.journey==='return')return event.type==='arrive'?'Inside HQ':'Heading back to HQ';
 const building=state.buildings.find(b=>b.id===event.targetId);
 const target=building?.name??state.hoods.find(h=>h.id===event.targetId)?.name??state.intel?.sightings?.[event.targetId]?.name??'last-seen block';
 const actions={investigate:'Investigate',buy:'Buy',protect:'Protect',assassinate:'Assassinate boss at',return:'Return to HQ',extort:'Extort',collect:'Collect protection at',bomb:'Bomb',patrol:'Patrol',recruit:'Recruit at',hit:'Hit'};
 if(event.type==='order_fail')return 'Order failed — preparing to return to HQ';
 return actions[event.orderType]?actions[event.orderType]+' '+target:null;
}
