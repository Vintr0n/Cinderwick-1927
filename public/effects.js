import * as THREE from 'three';
export function createEffects(scene){
 const active=[];
 function remove(fx){scene.remove(fx.group);fx.group.traverse(o=>{if(o.isMesh||o.isLine){o.geometry.dispose();o.material.dispose();}});}
 function gunshot(from,to,time){
 const group=new THREE.Group();scene.add(group);
 const a=new THREE.Vector3(from[0],1.2,from[2]),b=new THREE.Vector3(to[0],1.2,to[2]);
 const tracer=new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]),new THREE.LineBasicMaterial({color:'#ffe1a1',transparent:true,opacity:.9}));group.add(tracer);
 const flash=new THREE.Mesh(new THREE.SphereGeometry(.11,8,6),new THREE.MeshBasicMaterial({color:'#fff0ac'}));flash.position.copy(a);group.add(flash);
 active.push({group,start:time,duration:.14,pieces:[]});
 }
 function explosion(position,time,seed){
 const group=new THREE.Group();group.position.set(position.x,.1,position.z+2.15);scene.add(group);
 const pieces=[];let n=(seed+1)*719;
 const rnd=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
 function particle(kind,color,size,velocity,delay=0){
 const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:1,depthWrite:false});
 const mesh=new THREE.Mesh(kind==='debris'?new THREE.BoxGeometry(size,size,size):new THREE.SphereGeometry(size,12,8),material);
 const origin=new THREE.Vector3((rnd()-.5)*2,.5+rnd()*1.5,(rnd()-.5)*2);
 mesh.position.copy(origin);group.add(mesh);pieces.push({mesh,kind,velocity,origin,delay});
 }
 for(let i=0;i<14;i++)particle('fire',['#ffdb78','#ff912f','#e65222'][i%3],.35+rnd()*.55,new THREE.Vector3((rnd()-.5)*3,1+rnd()*3,(rnd()-.5)*3));
 for(let i=0;i<20;i++)particle('smoke',['#595955','#737169','#424947'][i%3],.45+rnd()*.45,new THREE.Vector3((rnd()-.5)*1.4,1.4+rnd()*1.4,(rnd()-.5)*1.4),.15+rnd()*.4);
 for(let i=0;i<22;i++)particle('debris','#a38a66',.07+rnd()*.13,new THREE.Vector3((rnd()-.5)*9,3+rnd()*6,(rnd()-.5)*9));
 const ring=new THREE.Mesh(new THREE.RingGeometry(.8,1,48),new THREE.MeshBasicMaterial({color:'#ffd79a',transparent:true,opacity:1,side:THREE.DoubleSide,depthWrite:false}));
 ring.rotation.x=-Math.PI/2;ring.position.y=.32;group.add(ring);
 const light=new THREE.PointLight('#ffad51',45,16);light.position.y=3;group.add(light);
 active.push({group,pieces,ring,light,start:time,duration:4.5});
 }
 function pulse(position,time,color){
 const group=new THREE.Group();scene.add(group);group.position.set(position.x,.35,position.z);
 const ring=new THREE.Mesh(new THREE.RingGeometry(.35,.48,24),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,side:THREE.DoubleSide,depthTest:false}));
 ring.rotation.x=-Math.PI/2;group.add(ring);active.push({group,ring,start:time,duration:.7,pieces:[]});
 }
 function update(time){
 for(let i=active.length-1;i>=0;i--){
 const fx=active[i],age=Math.max(0,(time-fx.start)/1000);
 if(age>=fx.duration){remove(fx);active.splice(i,1);continue;}
 if(fx.ring){fx.ring.scale.setScalar(fx.order?1+age*.3:1+age*7);fx.ring.material.opacity=Math.max(0,1-age/(fx.order?fx.duration:1/1.8));}
 if(fx.light)fx.light.intensity=45*Math.max(0,1-age*2.5);
 for(const p of fx.pieces){
 const t=age-p.delay;p.mesh.visible=t>=0;if(t<0)continue;
 p.mesh.position.copy(p.origin).addScaledVector(p.velocity,t);
 if(p.kind==='debris'){p.mesh.position.y=Math.max(.2,p.mesh.position.y-4.9*t*t);p.mesh.rotation.set(t*3,t*5,t*2);p.mesh.material.opacity=Math.max(0,1-t/2.6);}
 else if(p.kind==='smoke'){p.mesh.scale.setScalar(1+t*.85);p.mesh.material.opacity=Math.max(0,.65*(1-t/4.2));}
 else{p.mesh.scale.setScalar(1+t*1.5);p.mesh.material.opacity=Math.max(0,1-t/1.15);}
 }
 }
 }
 function orderPulse(position,time){
 const group=new THREE.Group();scene.add(group);group.position.set(position.x,.28,position.z);
 const ring=new THREE.Mesh(new THREE.RingGeometry(3.45,3.7,4),new THREE.MeshBasicMaterial({color:'#6af09b',transparent:true,opacity:1,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));
 ring.rotation.set(-Math.PI/2,0,Math.PI/4);ring.renderOrder=20;group.add(ring);active.push({group,ring,start:time,duration:1.1,pieces:[],order:true});
 }
 return {explosion,pulse,orderPulse,gunshot,update,clear(){active.forEach(remove);active.length=0;},get count(){return active.length;}};
}
