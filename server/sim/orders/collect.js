export default {name:'Collect protection',requiredStats:[],target:'owned',resolve(c){
 if(c.target.propertyOwnerId===c.actor.gangId)return c.fail('This action is unavailable on your purchased property.');
 if(c.target.ownerId!==c.actor.gangId)return c.fail('You no longer control this business.');
 if((c.target.closedUntilWeek??0)>=c.state.week)return c.fail('Bomb damage has closed this business. No protection income this week.');
 if(c.collected.has(c.target.id))return c.fail('Already collected this week.');
 const amount=c.target.heldIncome??0;
 c.collected.add(c.target.id);c.state.cash[c.actor.gangId]+=amount;c.target.heldIncome=0;
 c.emit('action_result','success',{kind:'collection',cashDelta:amount,message:'Collected $'+amount+' in protection.'});
}};
