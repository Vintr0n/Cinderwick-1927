export function weeklySummary(replay){
 const own=new Set([...replay.startState.hoods,...replay.endState.hoods].filter(h=>h.gangId==='gang-player').map(h=>h.id));
 const owned=e=>e.actorGangId==='gang-player'||(!e.actorGangId&&own.has(e.actorId));
 const payroll=replay.events.find(e=>owned(e)&&e.data.kind==='payroll')?.data.payroll;
 const income=replay.events.filter(e=>owned(e)&&(e.orderType==='collect'||['collection','business_income'].includes(e.data.kind))&&e.outcome==='success').reduce((sum,e)=>sum+Math.max(0,e.data.cashDelta??Number(e.data.message?.match(/Collected \$(\d+)/)?.[1]??0)),0);
 const lost=state=>state.hoods.filter(h=>h.gangId==='gang-player'&&['dead','deserted'].includes(h.status)).length;
 return {income,wages:payroll?.current??0,paid:payroll?.paid??0,payroll,claimed:replay.endState.buildings.filter(b=>b.ownerId==='gang-player').length,lost:lost(replay.endState)-lost(replay.startState)};
}
