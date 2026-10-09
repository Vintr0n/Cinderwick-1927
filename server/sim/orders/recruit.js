import {refreshRecruitment} from '../recruitment.js';
import {refuge} from '../property.js';
import {makeHood} from '../model.js';
export default {name:'Recruit',requiredStats:[],target:'none',resolve(c){
 if(c.state.wageDebt[c.actor.gangId]>0)return c.fail('Pay outstanding wages before recruiting.');
 refreshRecruitment(c.state);
 const meeting=c.target??c.state.buildings.find(b=>b.type==='hq'&&b.ownerId===c.actor.gangId);
 const pool=c.state.recruitmentPools[meeting?.id];
 if(!pool?.available)return c.fail('No potential recruits are available here. Try another building.');
 if(c.rng()>=.5)return c.fail('Recruitment unsuccessful. No one joined the crew this week.');
 const home=refuge(c.state,c.actor);if(!home)return c.fail('No safe building is available to house a recruit.');
 const hood=makeHood('h-'+c.state.nextHood++,c.actor.gangId,home.position,c.rng,false,c.state.hoods.map(h=>h.name));
 hood.inventory.gun=null;hood.residenceId=home.id;
 pool.available--;c.state.hoods.push(hood); c.emit('action_result','success',{message:hood.name+' joined the crew. No recruitment fee; weekly wages apply.',hood,cashDelta:0});
}};
