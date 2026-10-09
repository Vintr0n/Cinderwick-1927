import {intelFor} from '../property.js';
import {accrueIncome} from '../economy.js';
export default {name:'Extort',requiredStats:['intimidate'],target:'business',resolve(c){
 intelFor(c.state,c.actor.gangId).buildings[c.target.id]=c.target.propertyOwnerId??c.target.ownerId;
 if(c.target.propertyOwnerId)return c.fail('The proprietor rejects extortion: this business is owned by an outfit.');
 const chance=.25+.11*c.actor.stats.intimidate;
 if(c.target.ownerId===c.actor.gangId) return c.fail('Already under your protection.');
 if(c.rng()<chance){c.target.ownerId=c.actor.gangId;intelFor(c.state,c.actor.gangId).buildings[c.target.id]=c.actor.gangId;accrueIncome(c.state);c.emit('action_result','success',{message:'Protection agreement secured.'});c.emit('ownership_change','success',{newOwnerId:c.actor.gangId});}
 else c.emit('action_result','fail',{message:'The proprietor refused.'});
}};
