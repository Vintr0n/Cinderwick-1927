import {streetPosition} from '../../public/movement.js';
export const location=h=>h.streetPosition??streetPosition(h.position,h.id);
export const length=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
export function lineOfSight(state,a,b){
 for(const building of state.buildings){
 if((building.closedUntilWeek??0)>=state.week)continue;
 const center=[(building.position.x-2)*6,(building.position.y-2)*6];
 let enter=0,leave=1;
 for(const [axis,index] of [[0,0],[2,1]]){
 const d=b[axis]-a[axis],min=center[index]-1.97,max=center[index]+1.97;
 if(Math.abs(d)<1e-9){if(a[axis]<min||a[axis]>max){enter=2;break;}}
 else {const t1=(min-a[axis])/d,t2=(max-a[axis])/d;enter=Math.max(enter,Math.min(t1,t2));leave=Math.min(leave,Math.max(t1,t2));}
 }
 if(enter<=leave&&leave>0&&enter<1)return false;
 }
 return true;
}
export function canEngage(state,a,b){return a.status==='alive'&&b.status==='alive'&&!a.indoors&&!b.indoors&&a.gangId!==b.gangId&&Math.abs(a.position.x-b.position.x)+Math.abs(a.position.y-b.position.y)<=1&&length(location(a),location(b))<=10&&lineOfSight(state,location(a),location(b));}
export function route(state,start,end){
 if(length(start,end)<.001)return [start,end];
 const nodes=[start,end];
 const size=Math.max(...state.buildings.map(b=>Math.max(b.position.x,b.position.y)))+1;
 for(let x=0;x<=size;x++)for(let y=0;y<=size;y++)nodes.push([-14.65+x*6,.15,-15.5+y*6]);
 const costs=nodes.map(()=>Infinity),previous=[],done=new Set();costs[0]=0;
 while(!done.has(1)){
 let current=-1;for(let i=0;i<nodes.length;i++)if(!done.has(i)&&(current<0||costs[i]<costs[current]))current=i;
 if(current<0||!Number.isFinite(costs[current]))throw Error('No street route to destination.');
 done.add(current);
 for(let i=0;i<nodes.length;i++){
 if(done.has(i))continue;
 const d=length(nodes[current],nodes[i]);
 if(d>9&&current>1&&i>1)continue;
 if(costs[current]+d>=costs[i]||!lineOfSight(state,nodes[current],nodes[i]))continue;
 costs[i]=costs[current]+d;previous[i]=current;
 }
 }
 const path=[];for(let i=1;i!==undefined;i=previous[i])path.unshift(nodes[i]);return path;
}
export function pathLength(path){return path.slice(1).reduce((n,p,i)=>n+length(path[i],p),0);}
export function along(path,distance){for(let i=1;i<path.length;i++){const span=length(path[i-1],path[i]);if(distance<=span){const t=span?distance/span:1;return path[i].map((v,k)=>path[i-1][k]+(v-path[i-1][k])*t);}distance-=span;}return [...path.at(-1)];}
export const hitChance=stars=>(4+Math.max(1,Math.min(5,stars)))/100;
export const shotLimit=gun=>gun==='tommy'?20:10;
