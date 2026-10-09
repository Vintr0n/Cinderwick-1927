export default {name:'Return to HQ',requiredStats:[],target:'none',resolve(c){delete c.actor.stationedAt;c.emit('action_result','success',{message:c.actor.name+' is returning to HQ.'});}};
