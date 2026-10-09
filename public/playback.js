// Presentation timing is independent of the authoritative fixed simulation tick.
import {travelDuration} from './movement.js';
export const playbackScale=7.2;
export function presentation(replay){
 if(replay.timelineVersion===2){
 const entries=[];
 for(const event of replay.events){const at=event.tick*replay.tickLengthMs;entries.push({at,kind:'view',event});if(event.type==='move')entries.push({at,kind:'move',event,duration:event.data.durationMs});}
 entries.sort((a,b)=>a.at-b.at||a.event.seq-b.event.seq||(a.kind==='view'?-1:1));
 return {tickMs:replay.tickLengthMs,entries,duration:Math.max(1,replay.durationMs??entries.at(-1)?.at??0)};
 }
 const tickMs=replay.tickLengthMs*playbackScale;
 const tickDurations=new Map();
 for(const e of replay.events)if(e.type==='move')tickDurations.set(e.tick,Math.max(tickDurations.get(e.tick)??tickMs,travelDuration(e)));
 const starts=[0],lastTick=replay.events.at(-1)?.tick??0;
 for(let tick=0;tick<=lastTick;tick++)starts.push(starts[tick]+(tickDurations.get(tick)??tickMs));
 const entries=[];
 for(const event of replay.events){
 if(event.type==='move')entries.push({at:starts[event.tick],duration:travelDuration(event),kind:'move',event});
 entries.push({at:starts[event.tick+1],kind:'view',event});
 }
 entries.sort((a,b)=>a.at-b.at||(a.kind===b.kind?0:a.kind==='view'?-1:1)||a.event.seq-b.event.seq);
 return {tickMs,entries,duration:Math.max(4000,starts.at(-1)+5000)};
}
