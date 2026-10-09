import {residents,intelFor,terms} from '../property.js';
export default {name:'Investigate',requiredStats:['intelligence'],target:'building',resolve(c){
 if(c.target.propertyOwnerId===c.actor.gangId)return c.fail('This action is unavailable on your purchased property.');
 const inside=residents(c.state,c.target),hostile=inside.filter(h=>h.gangId!==c.actor.gangId&&h.inventory.gun);
 if(hostile.length&&c.rng()<.7){c.emit('action_attempt',null,{kind:'investigation_shot'});c.kill(c.actor);return c.fail('The investigator was killed by the building’s protection. No report returned.');}
 if(c.rng()>=.35+.02*c.actor.stats.intelligence)return c.fail('Investigation failed. No reliable information obtained.');
 const intel=intelFor(c.state,c.actor.gangId),rate=terms(c.target);
 const report={week:c.state.week,ownerId:c.target.propertyOwnerId??c.target.ownerId,propertyOwnerId:c.target.propertyOwnerId??null,price:rate?.price??null,income:rate?.income??0,protectionIncome:c.target.income,residents:inside.map(h=>({id:h.id,name:h.name,boss:h.boss,armed:!!h.inventory.gun,gangId:h.gangId}))};
 intel.investigations??={};intel.investigations[c.target.id]=report;intel.buildings[c.target.id]=report.ownerId;
 c.emit('action_result','success',{kind:'investigation',investigation:report,message:'Investigated '+c.target.name+'. Owner: '+(report.ownerId==='gang-player'?c.state.profile.outfitName:report.ownerId==='gang-rival'?'Blackthorn Crew':'independent')+'. Inside: '+(report.residents.map(h=>h.name+(h.boss?' (boss)':'')+(h.armed?' [armed]':'')).join(', ')||'nobody')+'.'+(rate?' Purchase $'+rate.price+'; business income $'+rate.income+'/week.':'')});
 }};
