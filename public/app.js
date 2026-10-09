import {createScene} from './scene.js';
import {presentation} from './playback.js';
import {portrait} from './portraits.js';
import {createSoundtrack} from './sound.js';
import {equipmentArt} from './equipment-art.js';
import {weeklySummary} from './reporting.js';
import {actionDescription} from './replay-actions.js';
const $=id=>document.getElementById(id),names={'gang-player':'Vale Syndicate','gang-rival':'Blackthorn Crew'};
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state,queue=[],phase='planning',deadline=0,offset=0,specs=[],weeks=[],currentReport=null,play=null,activeWeek=false,overlay=false,scene,restoreState=null,selectedHood=null,draft=null,ws,catalog={},weeklyWage=20;
function toast(message){$('toast').textContent=message;$('toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').style.display='none',4500);}
function closeDialogs(){document.querySelectorAll('dialog').forEach(d=>d.close());}
function send(message){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(message));else toast('Connection unavailable. Reconnecting...');}
function cancelDraft(){draft=null;$('assignment').hidden=true;document.body.classList.remove('assigning');}
let pendingAssignment=null,purchaseTarget=null,selectedBuilding=null;
let selectedPurchase=null,purchasePending=false,equipmentMode='buy',retiringHood=null;
let inspectedHood=null,requestedReportWeek=null;
const replayActions=new Map();
function closeInspection(){inspectedHood=null;$('hoodInspection').hidden=true;}
function inspectHood(id){if(!play)return;inspectedHood=id;$('mapSelection').hidden=true;renderInspection();}
function renderInspection(){
 const h=state?.hoods.find(h=>h.id===inspectedHood);
 if(!play||!h||!['alive','dead'].includes(h.status)){closeInspection();return;}
 $('inspectedName').textContent=h.name;$('inspectedAction').textContent=h.status==='dead'?'Dead':replayActions.get(h.id)??'On the street';$('hoodInspection').hidden=false;
}
function trackAction(event){
 if(!event.actorId)return;
 const description=actionDescription(event,state);
 if(description&&!(event.type==='move_end'&&event.data.journey==='flee'))replayActions.set(event.actorId,description);
 
 if(inspectedHood)renderInspection();
}
$('closeInspection').onclick=closeInspection;
function showSetup(){if(!$('setupDialog').open){closeDialogs();$('setupDialog').showModal();}}
$('setupDialog').addEventListener('cancel',e=>{if(phase==='setup')e.preventDefault();});
$('setupForm').onsubmit=e=>{e.preventDefault();send({type:'setup',profile:{bossName:$('bossName').value,outfitName:$('outfitName').value,color:$('outfitColor').value}});};
const soundtrack=createSoundtrack();
const soundButton=document.createElement('button');soundButton.id='soundToggle';document.querySelector('.map-tools').insertBefore(soundButton,document.querySelector('.map-tools small'));
function renderSound(){soundButton.textContent=soundtrack.muted?'Sound off':'Sound on';soundButton.setAttribute('aria-pressed',String(soundtrack.muted));soundButton.title=soundtrack.muted?'Enable music and effects':'Mute music and effects';}
soundButton.onclick=()=>{soundtrack.setMuted(!soundtrack.muted);renderSound();};renderSound();
const unlockSound=e=>{if(e.target!==soundButton)soundtrack.unlock();};
window.addEventListener('pointerdown',unlockSound);window.addEventListener('keydown',unlockSound);
function submit(type,targetId){
 if(!selectedHood||phase!=='planning'||play)return;
 pendingAssignment={actorId:selectedHood,type,targetId};
 send({type:'queue',orders:[...queue.filter(o=>o.actorId!==selectedHood),{actorId:selectedHood,type,targetId}]});
 cancelDraft();closeDialogs();
}
function renderPropertyDetails(b){
 const box=$('mapSelection'),report=state.intel.investigations?.[b.id],rate=b.businessTerms,closed=(b.closedUntilWeek??0)>=state.week;
 if(b.propertyOwnerId==='gang-player'&&(b.heldIncome??0)>0)box.innerHTML+='<p>Uncollected protection from before purchase: $'+b.heldIncome+'</p>';
 if(b.propertyOwnerId==='gang-player')box.innerHTML+='<p>Purchased property / '+escape(b.businessSize)+' business</p><p>Automatic income: $'+(closed?0:rate?.income??0)+'/week</p><button id="sellProperty" '+(closed||play||phase!=='planning'?'disabled':'')+'>Sell for $'+Math.round((rate?.price??0)*.8+(b.heldIncome??0))+'</button>';
 if(report){box.innerHTML+='<p>Investigation / week '+report.week+'</p><p>Inside when investigated: '+escape(report.residents.map(h=>h.name+(h.boss?' (boss)':'')+(h.armed?' [armed]':'')).join(', ')||'Nobody')+'</p>'+(report.price?'<p>Purchase price: $'+report.price+' / automatic income: $'+report.income+'/week</p>':'');
 if(rate&&!b.propertyOwnerId&&(!b.ownerId||b.ownerId==='gang-player'))box.innerHTML+='<button id="purchaseProperty" '+(closed||play||phase!=='planning'?'disabled':'')+'>Buy business / choose crew</button>';
 }
 const sell=$('sellProperty');if(sell)sell.onclick=()=>send({type:'sell_property',buildingId:b.id});
 const buy=$('purchaseProperty');if(buy)buy.onclick=()=>{purchaseTarget=b.id;$('rosterBtn').click();};
}
function pickBuilding(b,street=false){
 if(!b)return;
 closeInspection();selectedBuilding=b.id;
 $('mapSelection').hidden=false;$('mapSelection').innerHTML=escape(b.name)+'<small>'+escape(b.lostProtection?'Protection lost / current owner unknown':b.discovered?(names[b.ownerId]??'Neutral'):'Ownership unknown')+((b.closedUntilWeek??0)>=state.week?' / CLOSED THROUGH WEEK '+b.closedUntilWeek:'')+'</small>'+((b.ownerId==='gang-player'&&!b.propertyOwnerId&&!!b.businessSize)?'<p>Expected protection income: $'+((b.closedUntilWeek??0)>=state.week?0:b.income)+'</p><p>Holding for you: $'+(b.heldIncome??0)+' / $120 maximum'+(b.heldIncome===0?' (collected this week, or no payment accrued yet)':'')+'</p>':'');
 renderPropertyDetails(b);
 if(!draft){if(b.type==='hq'&&b.ownerId==='gang-player')$('rosterBtn').click();return;}
 if((b.closedUntilWeek??0)>=state.week)return toast('This building is rubble. Wait until week '+(b.closedUntilWeek+1)+' to issue orders here.');
 const type=draft.type,isBusiness=b.functionalInV1&&!!b.businessSize;
 if(['collect','investigate','bomb'].includes(type)&&b.propertyOwnerId==='gang-player')return toast('This action is unavailable on a purchased property. Business income is automatic.');
 if(type==='buy'){const report=state.intel.investigations?.[b.id];if(!report||!isBusiness)return toast('Successfully investigate this business before buying.');if(b.propertyOwnerId||(b.ownerId&&b.ownerId!=='gang-player'))return toast('Choose an independent business or one you extort.');if(state.cash['gang-player']<report.price)return toast('Not enough cash to purchase this business.');}
 if(type==='protect'&&b.propertyOwnerId!=='gang-player')return toast('Choose a business you have purchased.');
 if(type==='assassinate'&&!state.intel.investigations?.[b.id]?.residents.some(h=>h.boss&&h.gangId!=='gang-player'))return toast('First investigate and identify an enemy boss inside this building.');
 if(['extort','collect'].includes(type)&&!isBusiness)return toast('Choose a shop or the jeweler.');
 if(type==='collect'&&b.ownerId!=='gang-player')return toast('Choose a business under your protection.');
 if(type==='extort'&&b.ownerId==='gang-player')return toast('This business already pays you protection.');
 submit(type,b.id);
}
try{scene=createScene($('scene'),pickBuilding,inspectHood);}catch(error){$('renderError').hidden=false;$('renderError').textContent='Enable WebGL to use the city map.';console.error(error);}
function connect(){
 ws=new WebSocket((location.protocol==='https:'?'wss:':'ws:')+'//'+location.host);
 ws.onopen=()=>{$('connection').classList.add('online');$('connectionText').textContent='LOCAL CAMPAIGN';};
 ws.onclose=()=>{$('connection').classList.remove('online');$('connectionText').textContent='RECONNECTING';$('end').disabled=true;setTimeout(connect,1500);};
 ws.onmessage=({data})=>{
 const msg=JSON.parse(data);
 if(msg.type==='error'){pendingAssignment=null;purchasePending=false;if($('buyDialog').open)renderShop();toast(msg.message);return;}
 if(msg.type==='state'){
 catalog=msg.equipment??catalog;weeklyWage=msg.economy?.weeklyWage??weeklyWage;
 purchasePending=false;
 if(play&&!play.active){restoreState=msg.state;queue=msg.queue;phase=msg.phase;deadline=msg.deadline;offset=msg.serverTime-Date.now();specs=msg.orders;weeks=msg.weeks;return;}
 state=msg.state;queue=msg.queue;phase=msg.phase;deadline=msg.deadline;offset=msg.serverTime-Date.now();specs=msg.orders;weeks=msg.weeks;
 if(pendingAssignment&&queue.some(o=>o.actorId===pendingAssignment.actorId&&o.type===pendingAssignment.type&&o.targetId===pendingAssignment.targetId)){
 const assigned=pendingAssignment;scene?.confirmOrder(assigned.targetId);toast('Assignment added to the ledger.');pendingAssignment=null;
 setTimeout(()=>{if(phase==='planning'&&!play&&!draft&&selectedHood===assigned.actorId&&!document.querySelector('dialog[open]'))openHood(assigned.actorId);},assigned.targetId&&assigned.type!=='hit'?1150:0);
 }
 if(phase!=='playback'){if(play)scene?.playback(false);play=null;activeWeek=false;$('playback').hidden=true;}
 render();if(phase==='setup')showSetup();else if(phase==='ended')showEnd();else if($('setupDialog').open)$('setupDialog').close();
 if($('actionDialog').open&&selectedHood)refreshAction();if(selectedBuilding&&!$('mapSelection').hidden){const b=state.buildings.find(b=>b.id===selectedBuilding);if(b&&!draft&&b.type!=='hq')pickBuilding(b);}
 if($('buyDialog').open)renderShop();
 }else if(msg.type==='replay'){weeks=msg.weeks;activeWeek=true;startPlayback(msg.replay,true);}
 else if(msg.type==='report'){if(requestedReportWeek!==null&&msg.replay.week!==requestedReportWeek)return;requestedReportWeek=null;currentReport=msg.replay;showReport();}
 };
}
function setOptions(el,options){el.innerHTML=options.map(o=>'<option value="'+escape(o.id)+'">'+escape(o.name)+'</option>').join('');}
const hints={
 investigate:'35% + 2% per Intelligence star. Armed protection can kill the investigator (70%).',
 buy:'Requires successful investigation. Buy an independent or your extorted business; automatic weekly income.',
 protect:'Requires a gun and a purchased property. Stay inside until ordered back to HQ.',
 return:'Leave the stationed property and return to HQ this week.',
 assassinate:'Requires a gun and an investigation locating a boss. 1% + 1% per Firearms star; each armed guard has a 10% interception chance.',
 recruit:'50% chance if a local candidate is available. Up to two candidates; one arrives every two working weeks. No recruitment fee. $20 weekly wages. The new recruit arrives unarmed.',
 extort:'Intimidate determines success. Claim a neutral or rival business.',
 collect:'Choose one of your businesses. Bombed businesses cannot pay.',
 patrol:'Click a building or street block to guard, then return to HQ.',
 bomb:'Requires one bomb per attempt. Explosives determines detonation success.',
 hit:'Requires an equipped gun. Firearms improves accuracy; Tommy guns are stronger.'
};
function statsHTML(h){return '<div class="stats">'+['intelligence','intimidate','firearms','explosives'].map(key=>{const n=h.stats?.[key]??(key==='intimidate'?h.stats?.intimidation:0)??0;return '<div class="stat"><span>'+key[0].toUpperCase()+key.slice(1)+'</span><span class="stars" aria-label="'+n+' out of 5">'+'&#9733;'.repeat(n)+'</span></div>';}).join('')+'</div>';}
function contactHTML(h,selectable=false){return '<'+(selectable?'button data-hit="'+escape(h.id)+'"':'article')+' class="contact"><img src="'+portrait(h)+'" alt="Portrait of '+escape(h.name)+'"><div><b>'+escape(h.name)+(h.boss?' / BOSS':'')+'</b><p>'+(h.position?'Seen week '+h.week+' / street block '+(h.position.x+1)+', '+(h.position.y+1):escape(h.status??'Deceased')+' / no current location')+'</p></div></'+(selectable?'button':'article')+'>';}
function gear(h){const gun=h.inventory?.gun,bombs=h.inventory?.bombs??0;return '<span class="gear-icons" aria-label="'+escape((catalog[gun]?.name??'Unarmed')+' / '+bombs+' TNT')+'">'+(gun?'<img src="'+equipmentArt(gun)+'" alt="'+escape(catalog[gun]?.name??gun)+'" title="'+escape(catalog[gun]?.name??gun)+'">':'<span title="Unarmed">&mdash;</span>')+Array.from({length:bombs},()=>'<img src="'+equipmentArt('bomb')+'" alt="TNT" title="TNT">').join('')+'</span>';}
function assignmentText(h){
 const order=queue.find(o=>o.actorId===h.id);
 if(order)return (specs.find(s=>s.id===order.type)?.name??order.type)+' / '+(state.buildings.find(b=>b.id===order.targetId)?.name??state.intel.sightings[order.targetId]?.name??'HQ');
 if(h.stationedAt)return 'Protect / stationed / '+(state.buildings.find(b=>b.id===h.stationedAt)?.name??'Property');
 return 'No order assigned';
}
function filteredCrew(){
 const filter=$('orderFilter').value,stat=$('statSort').value;
 return state.hoods.filter(h=>h.gangId==='gang-player'&&(!$('aliveOnly').checked||['alive','hiding'].includes(h.status))).filter(h=>{const assigned=!!h.stationedAt||queue.some(o=>o.actorId===h.id);return filter==='all'||(filter==='assigned'?assigned:!assigned);}).sort((a,b)=>stat?(b.stats?.[stat]??0)-(a.stats?.[stat]??0):0);
}
function renderRoster(){
 if(!state)return;
 $('roster').innerHTML=filteredCrew().map(h=>{
 const locked=phase!=='planning'||!!play||h.status!=='alive',gun=h.inventory?.gun??'';
 return '<article class="hood-card '+(!['alive','hiding'].includes(h.status)?'dead':'')+'"><button class="hood-open" data-hood="'+escape(h.id)+'" '+(!['alive','hiding'].includes(h.status)?'disabled':'')+'><img class="crew-portrait" src="'+portrait(h)+'" alt="Portrait of '+escape(h.name)+'"><span><b>'+escape(h.name)+'</b><small>'+(h.boss?'BOSS':'HOOD')+' / '+(h.status==='hiding'?'IN HIDING':h.status).toUpperCase()+'</small><span>'+(h.status!=='alive'?'No current location':h.indoors?'Inside '+(state.buildings.find(b=>b.id===(h.stationedAt??h.residenceId))?.name??'HQ'):'On the street')+'</span></span></button>'+statsHTML(h)+'<span class="equipment-note">'+gear(h)+'</span><div class="quick-loadout"><label>Gun <select data-quick-gun="'+h.id+'" '+(locked?'disabled':'')+'>'+[['','Unarmed'],['pistol','Colt M1911'],['tommy','Tommy gun']].map(([id,name])=>'<option value="'+id+'" '+(gun===id?'selected':'')+' '+((id&&id!==gun&&!state.stockpile?.[id])||(!id&&h.stationedAt)?'disabled':'')+'>'+name+(id?' ('+(state.stockpile?.[id]??0)+' spare)':'')+'</option>').join('')+'</select></label><div><button data-quick-bomb="'+h.id+'" '+(locked||!state.stockpile?.bomb||(h.inventory?.bombs??0)>=20?'disabled':'')+'>+ TNT</button><button data-quick-return="'+h.id+'" '+(locked||!h.inventory?.bombs?'disabled':'')+'>- TNT</button></div><label><input type="checkbox" data-quick-stance="'+h.id+'" '+(h.shootOnSight?'checked':'')+' '+(locked?'disabled':'')+'> Shoot on sight</label></div><span class="assignment-note">'+escape(assignmentText(h))+'</span></article>';
 }).join('');
 $('contacts').innerHTML=Object.values(state.intel.sightings).map(h=>contactHTML(h)).join('')||'<p>No enemy contacts yet.</p>';
}
function render(){
 if(!state)return;
 if(!play)closeInspection();
 names['gang-player']=state.profile?.outfitName??'Vale Syndicate';
 document.querySelectorAll('[data-outfit]').forEach(el=>el.textContent=names['gang-player']);
 document.documentElement.style.setProperty('--outfit',state.profile?.color??'#82b9a0');
 const paidCrew=state.hoods.filter(h=>h.gangId==='gang-player'&&['alive','hiding'].includes(h.status)&&!h.boss).length;
 $('payrollPreview').textContent='Weekly wages: $'+(paidCrew*weeklyWage)+' for '+paidCrew+' hoods. Wage debt: $'+(state.wageDebt??0)+'. Unpaid wages risk desertion.';
 $('week').textContent='WEEK '+String(state.week).padStart(2,'0');$('cash').textContent='$'+state.cash['gang-player'].toLocaleString();
 $('crewCount').textContent=state.hoods.filter(h=>h.gangId==='gang-player'&&['alive','hiding'].includes(h.status)).length;
 $('orderCount').textContent=queue.length;
 $('end').disabled=phase!=='planning'||!!play||ws?.readyState!==WebSocket.OPEN;
 $('phaseNote').textContent=phase==='planning'?'Crew are at HQ, stationed properties, or in hiding.':'Orders in motion.';
 scene?.planning(!play);scene?.apply(state);scene?.assignmentTargets(play?play.replay.events.filter(e=>e.actorGangId==='gang-player'&&e.type==='order_start').map(e=>e.targetId):queue.map(o=>o.targetId));
 renderRoster();
 $('queue').innerHTML=queue.map((o,i)=>'<div class="queue-item"><div><b>'+escape(state.hoods.find(h=>h.id===o.actorId)?.name)+'</b><small>'+escape(specs.find(s=>s.id===o.type)?.name)+' / '+escape(state.buildings.find(b=>b.id===o.targetId)?.name??state.intel.sightings[o.targetId]?.name??'Meeting')+'</small></div><button data-remove="'+i+'" '+(phase!=='planning'?'disabled':'')+'>Remove</button></div>').join('')||'<p class="empty">No orders yet. Open Crew and choose a hood.</p>';
}
function refreshAction(){
 const h=state.hoods.find(h=>h.id===selectedHood);if(!h)return;
 $('retireHood').disabled=h.boss||!['alive','hiding'].includes(h.status)||phase!=='planning'||!!play;
 $('shootOnSight').checked=!!h.shootOnSight;$('shootOnSight').disabled=phase!=='planning'||!!play||h.status!=='alive';
 $('currentOrder').textContent=assignmentText(h);$('actionName').textContent=h.name;$('actionProfile').innerHTML='<img src="'+portrait(h)+'" alt="Portrait of '+escape(h.name)+'"><div>'+statsHTML(h)+'<p>'+gear(h)+'</p></div>';
 $('actions').innerHTML=specs.filter(s=>(s.id!=='buy'||Object.keys(state.intel.investigations??{}).length)&&(s.id!=='return'||!h.indoors||!state.buildings.some(b=>b.type==='hq'&&b.ownerId==='gang-player'&&b.position.x===h.position?.x&&b.position.y===h.position?.y))).map(s=>{const missing=['hit','protect','assassinate'].includes(s.id)&&!h.inventory?.gun?'Equip a gun first':s.id==='bomb'&&!(h.inventory?.bombs>0)?'Equip a bomb first':null;return '<button data-action="'+s.id+'" '+(phase!=='planning'||play||h.status!=='alive'||((h.stationedAt||h.relocationPending)&&s.id!=='return')||missing?'disabled':'')+' title="'+escape(missing??hints[s.id])+'"><b>'+escape(s.name)+'</b></button>';}).join('');
 const locked=phase!=='planning'||play||h.status!=='alive';
 $('loadout').innerHTML=Object.values(catalog).map(item=>{const count=state.stockpile?.[item.id]??0,held=item.id==='bomb'?h.inventory?.bombs>0:h.inventory?.gun===item.id;return '<div class="loadout-item"><b>'+escape(item.name)+'</b><small>'+count+' in stock</small><button data-equip="'+item.id+'" '+(locked||count<1||(item.id!=='bomb'&&held)||(item.id==='bomb'&&h.inventory?.bombs>=20)?'disabled':'')+'>Equip'+(item.id==='bomb'?' one':'')+'</button><button data-return="'+item.id+'" '+(locked||!held?'disabled':'')+'>Return'+(item.id==='bomb'?' one':'')+'</button></div>';}).join('');
}
function renderShop(){
 const selling=equipmentMode==='sell';$('buyMode').setAttribute('aria-pressed',!selling);$('sellMode').setAttribute('aria-pressed',selling);$('sellQuantityLabel').hidden=!selling;
 $('shopBalance').textContent='Treasury: $'+state.cash['gang-player']+'. '+(selling?'Sell spare guns for 90% of their purchase price. Return equipped guns through Crew first.':'Purchases go into the shared stockpile. Equip them from Crew.');
 $('shop').innerHTML=Object.values(catalog).filter(item=>!selling||item.id!=='bomb').map(item=>'<button data-select-item="'+item.id+'" aria-pressed="'+(selectedPurchase===item.id)+'"><img src="'+equipmentArt(item.id)+'" alt="'+escape(item.name)+' illustration"><b>'+escape(item.name)+' / $'+(selling?item.price*.9:item.price)+'</b><small>'+(selling?'Sale price per gun':item.id==='bomb'?'TNT. Consumed on each attempt.':'Reusable weapon.')+'</small><small>In stock: '+(state.stockpile?.[item.id]??0)+'</small></button>').join('');
 const item=catalog[selectedPurchase],quantity=selling?Number($('sellQuantity').value):1,stock=state.stockpile?.[item?.id]??0;
 $('sellQuantity').max=stock;
 $('confirmBuy').disabled=!item||purchasePending||phase!=='planning'||!!play||(selling?(!Number.isSafeInteger(quantity)||quantity<1||quantity>stock):(state.cash['gang-player']<item.price||state.wageDebt>0));
 $('confirmBuy').textContent=item?(selling?'Sell '+(Number.isSafeInteger(quantity)&&quantity>0?quantity:0)+' x '+item.name+' / $'+(Number.isSafeInteger(quantity)&&quantity>0?item.price*.9*quantity:0):'Buy '+item.name+' / $'+item.price):'Select an item to '+equipmentMode;
 $('purchaseHint').textContent=selling?'Only stockpile guns are sold. Equipped weapons remain with their crew.':'One item per purchase. Reserve cash for wages.';
}
function openHood(id){
 selectedHood=id;if(purchaseTarget){const target=purchaseTarget;purchaseTarget=null;submit('buy',target);return;}closeDialogs();refreshAction();
 $('hitTargets').hidden=true;$('actionDialog').showModal();
}
function chooseAction(type){
 if(type==='return'){submit(type,null);return;}
 if(type==='hit'){
 $('hitTargets').hidden=false;
 const contacts=Object.values(state.intel.sightings).filter(h=>h.status!=='dead'&&h.position);
 $('hitList').innerHTML=contacts.map(h=>contactHTML(h,true)).join('')||'<p>No known living contacts. Send hoods into the city to gather intelligence.</p>';
 return;
 }
 const h=state.hoods.find(h=>h.id===selectedHood);draft={type};closeDialogs();
 $('assignmentPortrait').src=portrait(h);$('assignmentName').textContent=h.name+' / '+specs.find(s=>s.id===type).name;
 $('assignmentHint').textContent=type==='recruit'?'Click a building to look for a recruit. 50% chance if candidates are available.':hints[type];$('assignment').hidden=false;document.body.classList.add('assigning');
}
$('rosterDialog').addEventListener('cancel',()=>{purchaseTarget=null;});
 $('roster').onclick=e=>{const bomb=e.target.closest('[data-quick-bomb],[data-quick-return]');if(bomb){send({type:'equip',actorId:bomb.dataset.quickBomb??bomb.dataset.quickReturn,itemId:'bomb',returnItem:!!bomb.dataset.quickReturn});return;}const b=e.target.closest('[data-hood]');if(b)openHood(b.dataset.hood);};
 $('roster').onchange=e=>{const b=e.target;if(b.dataset.quickStance)send({type:'stance',actorId:b.dataset.quickStance,shootOnSight:b.checked});if(b.dataset.quickGun){const h=state.hoods.find(h=>h.id===b.dataset.quickGun);send({type:'equip',actorId:h.id,itemId:b.value||h.inventory.gun,returnItem:!b.value});}};
$('actions').onclick=e=>{const b=e.target.closest('[data-action]');if(b)chooseAction(b.dataset.action);};
$('shop').onclick=e=>{const b=e.target.closest('[data-select-item]');if(b){selectedPurchase=b.dataset.selectItem;renderShop();}};
$('aliveOnly').onchange=renderRoster;$('statSort').onchange=renderRoster;$('orderFilter').onchange=renderRoster;
 for(const mode of ['buy','sell'])$(mode+'Mode').onclick=()=>{equipmentMode=mode;selectedPurchase=null;$('sellQuantity').value='1';renderShop();};
 $('sellQuantity').oninput=renderShop;
 $('confirmBuy').onclick=()=>{if($('confirmBuy').disabled)return;const itemId=selectedPurchase;selectedPurchase=null;purchasePending=true;renderShop();send({type:equipmentMode==='sell'?'sell_equipment':'buy',itemId,...(equipmentMode==='sell'?{quantity:Number($('sellQuantity').value)}:{})});};
$('retireHood').onclick=()=>{const h=state.hoods.find(h=>h.id===selectedHood);retiringHood=h.id;$('retireMessage').textContent='Retire '+h.name+'? They will leave the crew, stop earning future wages, and return their equipment.';$('retireDialog').showModal();};
 $('cancelRetire').onclick=()=>{retiringHood=null;$('retireDialog').close();};
 $('confirmRetire').onclick=()=>{if(!retiringHood)return;send({type:'retire',actorId:retiringHood});retiringHood=null;closeDialogs();$('rosterBtn').click();};
 function stepHood(direction){const crew=state.hoods.filter(h=>h.gangId==='gang-player'&&['alive','hiding'].includes(h.status));if(!crew.length)return;openHood(crew[(crew.findIndex(h=>h.id===selectedHood)+direction+crew.length)%crew.length].id);}
 $('previousHood').onclick=()=>stepHood(-1);$('nextHood').onclick=()=>stepHood(1);$('hoodEquipment').onclick=()=>$('buyBtn').click();
 $('backToCrew').onclick=()=>$('rosterBtn').click();
 $('shootOnSight').onchange=e=>send({type:'stance',actorId:selectedHood,shootOnSight:e.target.checked});
 $('loadout').onclick=e=>{const b=e.target.closest('[data-equip],[data-return]');if(b)send({type:'equip',actorId:selectedHood,itemId:b.dataset.equip??b.dataset.return,returnItem:!!b.dataset.return});};
$('buyBtn').onclick=()=>{if(state){selectedPurchase=null;cancelDraft();closeDialogs();renderShop();$('buyDialog').showModal();}};
$('hitList').onclick=e=>{const b=e.target.closest('[data-hit]');if(b){submit('hit',b.dataset.hit);toast('Hit assigned to the last-seen block.');}};
$('rosterBtn').onclick=()=>{if(state){cancelDraft();closeDialogs();renderRoster();$('rosterDialog').showModal();}};
$('mapTab').onclick=()=>closeDialogs();
$('ledgerBtn').onclick=()=>{closeDialogs();$('ledgerDialog').showModal();};
$('cancelAssignment').onclick=cancelDraft;
$('queue').onclick=e=>{const b=e.target.closest('[data-remove]');if(b)send({type:'queue',orders:queue.filter((_,i)=>i!==Number(b.dataset.remove))});};
function beginWeek(){cancelDraft();closeDialogs();send({type:'end'});}
$('end').onclick=()=>{if(!queue.length){closeDialogs();$('emptyOrdersDialog').showModal();}else beginWeek();};
$('confirmEmptyWeek').onclick=()=>{if(phase==='planning'&&!play)beginWeek();else $('emptyOrdersDialog').close();};
$('backFromEmptyWeek').onclick=()=>$('emptyOrdersDialog').close();
$('cutaway').onclick=()=>{const on=$('cutaway').getAttribute('aria-pressed')!=='true';$('cutaway').setAttribute('aria-pressed',on);$('cutaway').textContent='Cutaway '+(on?'ON':'OFF');scene?.cutaway(on);};
 $('territory').onclick=()=>{overlay=!overlay;scene?.overlay(overlay);$('territory').setAttribute('aria-pressed',overlay);$('territory').querySelector('span').textContent=overlay?'ON':'OFF';};
$('resetCamera').onclick=()=>scene?.reset();
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{purchaseTarget=null;b.closest('dialog').close();});
function requestReport(week){
 if(!week)return;
 if(play?.active)return toast('Finish or skip the working week before opening older reports.');
 if(play)endPlayback(false);
 requestedReportWeek=Number(week);$('replayBtn').disabled=true;$('replayBtn').textContent='Loading report...';
 send({type:'report',week:Number(week)});
}
$('reportsBtn').onclick=()=>{if(!weeks.length)return toast('Reports appear after the first working week.');requestReport(weeks[0]);};
$('reportWeek').onchange=()=>requestReport(Number($('reportWeek').value));
function eventMessage(e){return (e.actorGangId==='gang-rival'?'Enemy: ':'')+e.data.message;}
function eventHTML(event){
 const people=new Map([...(event.data.investigation?.residents??[]),...Object.values(state?.intel?.investigations??{}).flatMap(r=>r.residents),...(currentReport?.startState.hoods??[]),...(currentReport?.endState.hoods??[]),...Object.values(state?.intel?.sightings??{}),...(state?.hoods??[]),...(event.data.view?.hoods??[])].map(h=>[h.name,h]));
 const message=eventMessage(event),ordered=[...people.keys()].filter(Boolean).sort((a,b)=>b.length-a.length);let html='',i=0;
 while(i<message.length){const name=ordered.find(n=>message.startsWith(n,i));if(!name){html+=escape(message[i++]);continue;}const h=people.get(name),own=h.gangId==='gang-player',color=own?(state?.profile?.color??'#82b9a0'):'#e3947d';html+='<span class="outfit-chip" style="background:'+escape(color)+'" title="'+escape(own?state?.profile?.outfitName??names[h.gangId]:names[h.gangId])+'"></span>'+escape(name);i+=name.length;}
 return html;
}
function renderLiveLog(){const entries=play?.log??currentReport?.events.filter(e=>e.data.message)??[];$('liveLogBody').innerHTML=entries.map(e=>'<div class="report-row"><small>T'+e.tick+' / '+(e.data.kind??e.orderType??e.type).toUpperCase()+'</small>'+eventHTML(e)+'</div>').join('')||'<p>No events yet.</p>'; }
$('eventCaption').onclick=()=>{renderLiveLog();$('liveLogDialog').showModal();};
function showReport(){
 const r=currentReport;if(!r)return;
 closeDialogs();$('reportTitle').textContent='Week '+r.week+' / The dispatch';
 setOptions($('reportWeek'),weeks.map(w=>({id:String(w),name:'Week '+w})));$('reportWeek').value=String(r.week);
 const summary=weeklySummary(r),payroll=summary.payroll;
 $('reportSummary').innerHTML='<div class="summary-grid"><div>$'+summary.income+'<small>WEEKLY INCOME</small></div><div>$'+summary.wages+'<small>WEEKLY WAGES</small></div><div>'+summary.claimed+'<small>CONTROLLED BLOCKS</small></div><div>'+summary.lost+'<small>CREW LOST / DEAD OR DESERTED</small></div></div>';
 $('reportBody').innerHTML=(payroll?'<div class="payroll-report"><b>Weekly payroll / boss excluded</b><p>'+payroll.crew+' hoods x $'+payroll.rate+' = $'+payroll.current+'. Previous debt: $'+payroll.arrears+'.</p><p>Paid $'+payroll.paid+' / outstanding $'+payroll.debt+'. '+payroll.deserters.length+' desertions.</p></div>':'')+r.events.filter(e=>e.data.message).map(e=>'<div class="report-row"><small>T'+e.tick+' / '+(e.type==='death'?'CASUALTY':e.data.kind==='desertion'?'DESERTION':e.data.kind==='payroll'?'PAYROLL':(e.outcome??'MOVEMENT').toUpperCase())+'</small>'+eventHTML(e)+'</div>').join('')+'<h3>Enemy sightings</h3>'+Object.values(r.endState.intel.sightings).filter(h=>h.week===r.week).map(h=>contactHTML(h)).join('');
 $('replayBtn').disabled=!!play||requestedReportWeek!==null;$('replayBtn').textContent='Watch replay';$('reportDialog').showModal();
}
function startPlayback(replay,active){
 closeInspection();replayActions.clear();$('mapSelection').hidden=true;
 soundtrack.stopEffects();
 closeDialogs();cancelDraft();if(play)endPlayback(false);if(!active)restoreState=structuredClone(state);currentReport=replay;
 play={replay,active,time:0,index:0,paused:false,log:[],...presentation(replay)};last=performance.now();
 scene?.playback(true);scene?.planning(false);
 state=structuredClone(replay.startState);phase=active?'playback':phase;queue=active?[]:queue;
 $('progress').value=0;$('playTime').textContent='0.0 s';$('playback').hidden=false;$('pause').textContent='Pause';$('eventCaption').textContent='The crew is leaving HQ.';render();
}
function endPlayback(show=true){
 closeInspection();
 const p=play;if(!p)return;scene?.playback(false);soundtrack.stopEffects();
 state=p.active?p.replay.endState:restoreState;currentReport=p.replay;play=null;$('playback').hidden=true;restoreState=null;render();if(show)showReport();
 if(p.active){activeWeek=false;send({type:'playback_complete',replayId:p.replay.replayId});}
}
$('pause').onclick=()=>{frame(performance.now());if(play){play.paused=!play.paused;if(play.paused)soundtrack.stopEffects();$('pause').textContent=play.paused?'Resume':'Pause';}};
$('speed').onchange=()=>{last=performance.now();};
$('skip').onclick=()=>endPlayback();$('replayBtn').onclick=()=>{if(requestedReportWeek===null&&currentReport&&!play)startPlayback(currentReport,false);};
$('newGame').onclick=()=>{if(confirm('Start a new campaign? The active campaign will be replaced.')){scene?.playback(false);scene?.reset();play=null;activeWeek=false;cancelDraft();closeDialogs();send({type:'reset'});}};
$('endReports').onclick=()=>{$('endDialog').close();requestReport(weeks[0]);};
function showEnd(){closeDialogs();const win=state.winner==='gang-player';$('endTitle').textContent=win?'Cinderwick is yours.':'The syndicate has fallen.';$('endText').textContent=win?'The Blackthorn boss is gone.':'Your boss was eliminated.';$('endDialog').showModal();}
let last=performance.now();
function frame(now){
 const dt=Math.max(0,now-last);last=now;
 if(play&&!play.paused){
 play.time+=dt*Number($('speed').value);scene?.time(play.time);
 while(play&&play.index<play.entries.length&&play.entries[play.index].at<=play.time){
 const entry=play.entries[play.index++],event=entry.event;
 if(entry.kind==='move'){scene?.move(event,entry.at,entry.duration);trackAction(event);continue;}
 state=event.data.view;scene?.apply(state,true);scene?.event(event,entry.at);if(play.time-entry.at<1000||['death','combat_end'].includes(event.type))soundtrack.event(event);$('cash').textContent='$'+state.cash['gang-player'].toLocaleString();
 trackAction(event);
 if(inspectedHood&&!state.hoods.some(h=>h.id===inspectedHood&&!h.indoors))closeInspection();
 if(event.data.message){play.log.push(event);$('eventCaption').innerHTML=eventHTML(event);if($('liveLogDialog').open)renderLiveLog();}
 }
 if(play){$('progress').value=Math.min(1,play.time/play.duration);$('playTime').textContent=(play.time/1000).toFixed(1)+' s';if(play.time>=play.duration)endPlayback();}
 }
 const seconds=Math.max(0,Math.ceil((deadline-Date.now()-offset)/1000));
 $('phaseLabel').textContent=play?'WORKING WEEK':phase==='ended'?'CAMPAIGN':'PLANNING ENDS IN';
 $('timer').textContent=play?'IN MOTION':phase==='planning'?String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0'):phase==='ended'?'CLOSED':phase==='setup'?'SETUP':'REVIEW';
}
function animate(now){frame(now);requestAnimationFrame(animate);}
setInterval(()=>{if(document.hidden)frame(performance.now());},250);
document.addEventListener('visibilitychange',()=>frame(performance.now()));
requestAnimationFrame(animate);connect();
