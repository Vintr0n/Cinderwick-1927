export const streetSpeed=1;
export function streetPosition(p,id='h-0'){
 const n=Number(id.split('-')[1])||0;
 return [(p.x-2)*6-1.95+(n%6)*.78,.15,(p.y-2)*6+2.5+(Math.floor(n/6)%2)*.8];
}
export function streetPath(fromPosition,toPosition,id){
 const from=streetPosition(fromPosition,id),to=streetPosition(toPosition,id),path=[from];
 if(fromPosition.y!==toPosition.y){const cornerX=(fromPosition.x-2)*6-2.65;path.push([cornerX,.15,from[2]],[cornerX,.15,to[2]]);}
 path.push(to);return path;
}
export function travelDuration(event){
 const path=streetPath(event.fromPosition,event.toPosition,event.actorId);
 return path.slice(1).reduce((sum,p,i)=>sum+Math.hypot(...p.map((v,j)=>v-path[i][j])),0)/streetSpeed*1000;
}
