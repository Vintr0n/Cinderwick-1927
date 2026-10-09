export default {name:'Protect / station',requiredStats:[],target:'building',resolve(c){
 if(!c.actor.inventory.gun)return c.fail('A gun is required to protect a property.');
 if(c.target.propertyOwnerId!==c.actor.gangId)return c.fail('You must have purchased this property.');
 c.actor.stationedAt=c.target.id;c.actor.residenceId=c.target.id;c.actor.indoors=true;c.actor.position={...c.target.position};delete c.actor.streetPosition;delete c.actor.travel;
 c.emit('action_result','success',{message:c.actor.name+' is stationed inside '+c.target.name+' until ordered back to HQ.'});
 }};
