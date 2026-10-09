// The full replay stays on disk. The client receives only server-observed information.
export function playerReplay(replay){
 let previous=replay.startState.view;
 const events=[];
 for(const e of replay.events){
 const view=e.data.view;
 const known=new Set([...previous.hoods,...view.hoods].map(h=>h.id));
 const visible=e.actorGangId==='gang-player'||known.has(e.actorId)||known.has(e.data.victimId)||known.has(e.data.targetHoodId);
 const data=visible?{...e.data}:{view};
 if(visible&&data.casualties)data.casualties=data.casualties.filter(id=>known.has(id));
 events.push(visible?{...e,data}:{tick:e.tick,seq:e.seq,type:'action_result',orderType:null,actorId:null,actorGangId:null,targetId:null,fromPosition:null,toPosition:null,outcome:null,data});
 previous=view;
 }
 return {...replay,startState:replay.startState.view,events,endState:replay.endState.view};
}
