import {residents,intelFor} from '../property.js';
export default {name:'Assassinate boss',requiredStats:['firearms'],target:'building',resolve(c){
 if(!c.actor.inventory.gun)return c.fail('An assassination requires a gun.');
 const report=intelFor(c.state,c.actor.gangId).investigations?.[c.target.id];
 if(!report?.residents.some(h=>h.boss&&h.gangId!==c.actor.gangId))return c.fail('First investigate and identify a boss inside this building.');
 const inside=residents(c.state,c.target),boss=inside.find(h=>h.boss&&h.gangId!==c.actor.gangId);
 if(!boss)return c.fail('The boss is no longer here. Investigation reports can become outdated.');
 for(const guard of inside.filter(h=>h.gangId===boss.gangId&&!h.boss&&h.inventory.gun))if(c.rng()<.1){c.kill(c.actor);return c.fail('The assassin was killed by '+guard.name+' before reaching the boss.');}
 const chance=.01+.01*c.actor.stats.firearms;
 if(c.rng()<chance){c.kill(boss);c.emit('action_result','success',{message:'Assassination succeeded. '+boss.name+' was killed.'});}
 else c.fail('Assassination failed. The boss survived.');
 }};
