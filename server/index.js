import {refreshHousing,sellProperty,retire} from './sim/property.js';
import http from 'node:http';
import {statSync,createReadStream} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocketServer,WebSocket} from 'ws';
import {createStore} from './data/store.js';
import {createGame,migrateGame,configureGame} from './sim/model.js';
import {buyEquipment,sellEquipment,equipEquipment,economy,equipment,accrueIncome} from './sim/economy.js';
import {observe} from './sim/visibility.js';
import {simulate,playerReplay} from './sim/engine.js';
import {orders,validate} from './sim/orders/index.js';
import {config} from '../shared/config.js';
const base=fileURLToPath(new URL('../',import.meta.url));
export function createApp({dataDir=resolve(base,'data'),planningMs=Number(process.env.PLANNING_MS)||config.planningMs}={}){
 const store=createStore(dataDir);
 let session=store.getGame()??{state:createGame(),queue:[],phase:'setup',deadline:null};
 // A replay is written first: recover if interrupted between replay and session commits.
 const pending=store.getReplay(session.state.id,session.state.week);
 if(session.phase==='planning'&&pending){session.state=pending.endState;delete session.state.view;session.phase='playback';session.deadline=null;}
 migrateGame(session.state);if(session.phase==='planning')accrueIncome(session.state);
 if(session.phase==='planning')refreshHousing(session.state);
 store.saveGame(session);
 const staticRoots=[['/sounds/',resolve(base,'sounds')],['/vendor/three/',resolve(base,'node_modules/three')],['/',resolve(base,'public')]];
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wav':'audio/wav','.mp3':'audio/mpeg'};
 const server=http.createServer((req,res)=>{
 if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true}));return;}
 try{
 const url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const [prefix,root]=staticRoots.find(([prefix])=>url.startsWith(prefix));
 const file=resolve(root,url.slice(prefix.length)||'index.html');
 if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 const stat=statSync(file);if(!stat.isFile())throw Error('Not a file');
 const headers={'Content-Type':mime[extname(file)]??'application/octet-stream','Cache-Control':'no-store','Accept-Ranges':'bytes'};
 let start=0,end=stat.size-1,status=200;
 if(req.headers.range){
 const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
 if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':'bytes */'+stat.size});res.end();return;}
 start=match[1]?Number(match[1]):Math.max(0,stat.size-Number(match[2]));
 end=match[1]&&match[2]?Math.min(Number(match[2]),end):end;
 if(start>end||start>=stat.size){res.writeHead(416,{'Content-Range':'bytes */'+stat.size});res.end();return;}
 status=206;headers['Content-Range']='bytes '+start+'-'+end+'/'+stat.size;
 }
 headers['Content-Length']=Math.max(0,end-start+1);res.writeHead(status,headers);
 if(req.method==='HEAD'||stat.size===0){res.end();return;}
 const stream=createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
 }catch{if(!res.headersSent)res.writeHead(404);res.end('Not found');}
 });
 const wss=new WebSocketServer({server,maxPayload:32768,verifyClient:info=>{
 const origin=info.origin;
 if(!origin)return true;
 try{return new URL(origin).host===info.req.headers.host;}catch{return false;}
 }});
 const send=(ws,value)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(value));};
 const snapshot=()=>({type:'state',state:observe(session.state),queue:session.queue,phase:session.phase,deadline:session.deadline,serverTime:Date.now(),weeks:store.listReplays(session.state.id),economy,equipment,orders:Object.entries(orders).map(([id,o])=>({id,name:o.name,target:o.target,requiredStats:o.requiredStats}))});
 const broadcast=()=>{const msg=snapshot();for(const ws of wss.clients)send(ws,msg);};
 function finish(){
 if(session.phase!=='planning')return;
 const replay=simulate(session.state,session.queue);
 store.appendReplay(replay);
 session={state:structuredClone(replay.endState),queue:[],phase:'playback',deadline:null};delete session.state.view;
 store.saveGame(session);
 // Never send the end state ahead of playback.
 for(const ws of wss.clients)send(ws,{type:'replay',replay:playerReplay(replay),active:true,weeks:store.listReplays(session.state.id)});
 }
 wss.on('connection',ws=>{
 if(session.phase==='playback'){
 send(ws,{...snapshot(),state:store.getReplay(session.state.id,session.state.week).startState.view});
 send(ws,{type:'replay',replay:playerReplay(store.getReplay(session.state.id,session.state.week)),active:true,weeks:store.listReplays(session.state.id)});
 }else send(ws,snapshot());
 ws.on('message',raw=>{
 try{
 const msg=JSON.parse(raw.toString());
 if(msg.type==='setup'){
 if(session.phase!=='setup')throw Error('This campaign has already started.');
 configureGame(session.state,msg.profile);accrueIncome(session.state);session.phase='planning';session.deadline=Date.now()+planningMs;store.saveGame(session);broadcast();
 }else if(msg.type==='buy'){
 if(session.phase!=='planning'||Date.now()>=session.deadline)throw Error('Equipment can only be bought during planning.');
 buyEquipment(session.state,msg.itemId);store.saveGame(session);broadcast();
 }else if(msg.type==='sell_equipment'){
 if(session.phase!=='planning'||Date.now()>=session.deadline)throw Error('Equipment can only be sold during planning.');
 sellEquipment(session.state,msg.itemId,msg.quantity??1);store.saveGame(session);broadcast();
 }else if(msg.type==='equip'){
 if(session.phase!=='planning'||Date.now()>=session.deadline)throw Error('Equipment can only be changed during planning.');
 equipEquipment(session.state,msg.actorId,msg.itemId,msg.returnItem===true);store.saveGame(session);broadcast();
 }else if(msg.type==='retire'||msg.type==='sell_property'){
 if(session.phase!=='planning'||Date.now()>=session.deadline)throw Error('This action is available during planning.');
 if(msg.type==='retire'){retire(session.state,msg.actorId);session.queue=session.queue.filter(o=>o.actorId!==msg.actorId);}else {sellProperty(session.state,msg.buildingId);session.queue=session.queue.filter(o=>!session.state.hoods.find(h=>h.id===o.actorId)?.relocationPending||o.type==='return');}
 store.saveGame(session);broadcast();
 }else if(msg.type==='stance'){
 if(session.phase!=='planning'||Date.now()>=session.deadline)throw Error('Combat preferences can only change during planning.');
 const hood=session.state.hoods.find(h=>h.id===msg.actorId&&h.gangId==='gang-player'&&h.status==='alive');
 if(!hood||typeof msg.shootOnSight!=='boolean')throw Error('Choose a living crew member.');
 hood.shootOnSight=msg.shootOnSight;store.saveGame(session);broadcast();
 }else if(msg.type==='queue'){
 if(session.phase!=='planning'||Date.now()>=session.deadline)throw Error('Planning is closed.');
 const view=observe(session.state);
 session.queue=validate(view,msg.orders,'gang-player',{checkAvailability:true});store.saveGame(session);broadcast();
 }else if(msg.type==='end'){finish();}
 else if(msg.type==='next'||msg.type==='playback_complete'){
 if(msg.type==='playback_complete'){
 if(session.phase!=='playback'){send(ws,snapshot());return;}
 const replay=store.getReplay(session.state.id,session.state.week);
 if(msg.replayId!==replay.replayId)throw Error('Playback does not match the active week.');
 }
 if(session.phase!=='playback')throw Error('No week to complete.');
 session.phase=session.state.winner?'ended':'planning';
 if(!session.state.winner){
 migrateGame(session.state);
 session.state.week++;refreshHousing(session.state);accrueIncome(session.state);session.deadline=Date.now()+planningMs;}
 store.saveGame(session);broadcast();
 }else if(msg.type==='report'){
 const r=store.getReplay(session.state.id,msg.week);if(!r)throw Error('Report not found.');
 send(ws,{type:'report',replay:playerReplay(r)});
 }else if(msg.type==='reset'){
 session={state:createGame(Date.now()>>>0),queue:[],phase:'setup',deadline:null};store.saveGame(session);broadcast();
 }else throw Error('Unknown request.');
 }catch(error){send(ws,{type:'error',message:error.message});}
 });
 });
 const timer=setInterval(()=>{if(session.phase==='planning'&&Date.now()>=session.deadline)try{finish();}catch(error){console.error(error);}},500);
 return {server,close:()=>new Promise(resolve=>{clearInterval(timer);for(const ws of wss.clients)ws.terminate();wss.close();server.close(resolve);})};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const app=createApp();const port=Number(process.env.PORT)||3000;
 app.server.listen(port,'0.0.0.0',()=>console.log('Cinderwick • http://localhost:'+port));
}
