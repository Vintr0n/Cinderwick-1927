import {purchase,terms} from '../property.js';
export default {name:'Buy business',requiredStats:[],target:'business',resolve(c){
 try{const held=c.target.heldIncome??0;const price=purchase(c.state,c.actor,c.target);c.emit('action_result','success',{kind:'property_purchase',cashDelta:-price,message:'Purchased '+c.target.name+' for $'+terms(c.target).price+'. '+(held?'The $'+held+' protection balance was paid to the treasury. ':'')+'Income will arrive automatically.'});}catch(error){c.fail(error.message);}
 }};
