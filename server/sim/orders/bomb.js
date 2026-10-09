import {residents} from '../property.js';
export default {name:'Bomb building',requiredStats:['explosives'],target:'building',resolve(c){
 if(c.target.propertyOwnerId===c.actor.gangId)return c.fail('This action is unavailable on your purchased property.');
 if(c.actor.inventory.bombs<1)return c.fail('No TNT equipped.');
 c.actor.inventory.bombs--;
 if(c.rng()>=.20+c.actor.stats.explosives*.05)return c.emit('action_result','fail',{detonated:false,bombsUsed:1,message:'The TNT failed to detonate. One bundle was consumed.'});
 const inside=residents(c.state,c.target),casualties=[];
 c.target.closedUntilWeek=Math.max(c.target.closedUntilWeek??0,c.state.week+1);c.target.heldIncome=0;
 for(const h of inside){if(c.rng()<.01){casualties.push(h.id);c.kill(h);}else c.evacuate(h);}
 c.emit('action_result','success',{casualties,detonated:true,closedUntilWeek:c.target.closedUntilWeek,message:'TNT detonated. '+c.target.name+' is closed through week '+c.target.closedUntilWeek+'. '+casualties.length+' occupants killed.'});
 }};
