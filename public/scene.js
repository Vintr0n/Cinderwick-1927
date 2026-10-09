import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {character,pose,equipModel} from './characters.js';
import {streetPosition,streetPath,streetSpeed} from './movement.js';
import {createEffects} from './effects.js';
export function createScene(container,onSelect,onHoodSelect=()=>{}){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#24383d');scene.fog=new THREE.Fog('#24383d',100,230);
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;container.append(renderer.domElement);
 const camera=new THREE.OrthographicCamera(-22,22,22,-22,.1,200);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minZoom=.4;controls.maxZoom=4.5;controls.maxPolarAngle=Math.PI/2.5;controls.minPolarAngle=.35;controls.enablePan=true;
 let following=null;
 function reset(){following=null;camera.position.set(62,60,68);camera.zoom=1;camera.updateProjectionMatrix();controls.target.set(15,0,15);controls.update();}
 reset();scene.add(new THREE.HemisphereLight('#e9ddc1','#53605b',2.5));
 const sun=new THREE.DirectionalLight('#ffdfac',3);sun.position.set(-15,30,15);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-60,right:60,top:60,bottom:-60});sun.shadow.bias=-.001;scene.add(sun);
 const mats=new Map();function mat(color){if(!mats.has(color))mats.set(color,new THREE.MeshStandardMaterial({color,roughness:.9}));return mats.get(color);}
 function box(w,h,d,color,x,y,z,parent=scene){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 box(64,.7,74,'#15272b',15,-.65,20);box(62,.15,72,'#465050',15,-.23,20);
 for(let i=0;i<11;i++){
 const p=-15+i*6;
 box(.06,.02,61,'#9d957a',p,-.13,15);box(61,.02,.06,'#9d957a',15,-.13,p);
 for(let j=-14;j<45;j+=2){box(.07,.025,.55,'#8e8b75',p+.15,-.12,j);box(.55,.025,.07,'#8e8b75',j,-.12,p+.15);}
 }
 const buildings=new Map(),hoods=new Map(),picks=[],motions=new Map();
 const effects=createEffects(scene);
 let visualTime=0,replaying=false,lastVisualTime=0,planning=true;
 const keys=new Set();
 const navigationKeys=['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'];
 window.addEventListener('keydown',e=>{if(!navigationKeys.includes(e.key.toLowerCase())||document.querySelector('dialog[open]')||e.target.closest('input,select,textarea,[contenteditable]'))return;e.preventDefault();keys.add(e.key.toLowerCase());following=null;});
 window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>keys.clear());
 const sidewalk=(p,id='h-0')=>new THREE.Vector3(...streetPosition(p,id));
 const palette=['#8a493c','#c0ab85','#657f7b','#9c7654','#536972','#a39785','#74564b','#897b55'];
 const world=p=>({x:(p.x-2)*6,z:(p.y-2)*6});
 function label(text){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=180;const c=canvas.getContext('2d');c.fillStyle='#152523';c.fillRect(0,0,1024,180);c.strokeStyle='#d5b574';c.lineWidth=5;c.strokeRect(8,8,1008,164);c.fillStyle='#fff0cc';let size=88;c.font='bold '+size+'px Georgia';while(c.measureText(text.toUpperCase()).width>950){size--;c.font='bold '+size+'px Georgia';}c.textAlign='center';c.textBaseline='middle';c.fillText(text.toUpperCase(),512,94);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();return new THREE.Mesh(new THREE.PlaneGeometry(3.6,.62),new THREE.MeshBasicMaterial({map:texture}));
 }
 function batchMeshes(parent,meshes){
 const groups=new Map(),result=[];
 for(const m of meshes){if(!m.isMesh||Array.isArray(m.material)){result.push(m);continue;}const list=groups.get(m.material)??[];list.push(m);groups.set(m.material,list);}
 for(const [material,list] of groups){if(list.length===1){result.push(list[0]);continue;}const geometries=list.map(m=>{m.updateMatrix();return m.geometry.clone().applyMatrix4(m.matrix);});const merged=mergeGeometries(geometries);for(const geometry of geometries)geometry.dispose();if(!merged){result.push(...list);continue;}const mesh=new THREE.Mesh(merged,material);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);for(const old of list){parent.remove(old);old.geometry.dispose();}result.push(mesh);}
 return result;
 }
 function tree(x,z,parent=scene){box(.16,1.3,.16,'#70533b',x,.85,z,parent);for(const [dx,y,dz,r] of [[0,1.9,0,.7],[-.35,1.6,.1,.45],[.3,1.65,-.2,.5]]){const leaves=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),mat('#526e45'));leaves.position.set(x+dx,y,z+dz);leaves.castShadow=true;parent.add(leaves);}}
 function build(b,i){
 const g=new THREE.Group();const p=world(b.position);g.position.set(p.x,0,p.z);scene.add(g);
 box(4.9,.22,4.9,'#9a9788',0,0,0,g);
 const height=b.type==='police'?4.8:1.9+(i%3)*.65;
 const signY=b.functionalInV1?Math.min(1.7,height-.25):height-.38;
 box(3.9,height,3.9,palette[i%palette.length],0,height/2+.12,0,g);
 box(4.12,.18,4.12,'#d0bea0',0,height+.14,0,g);box(3.6,.14,3.6,'#414949',0,height+.25,0,g);
 box(.6,.9,.65,'#775e50',1,height+.6,-.8,g);
 for(let floor=.85;floor<height-.2;floor+=1.05)for(let col=-1.2;col<=1.21;col+=1.2)for(const side of [-1,1]){
 const glass=(i+Math.round(floor)+Math.round(col*3))%3===0?'#d0b979':'#293e43',width=i%2?.56:.68;
 if(side!==1||Math.abs(floor-signY)>.76){
 box(width,.65,.07,glass,col,floor,side*1.98,g);
 box(.04,.65,.09,'#ad9b7e',col,floor,side*2.02,g);
 box(width+.12,.08,.13,'#bea98d',col,floor-.36,side*2.02,g);
 }
 if(!(i%5===2&&side===-1&&Math.abs(floor-(height-.4))<.76)){
 box(.07,.65,width,glass,side*1.98,floor,col,g);
 box(.09,.65,.04,'#ad9b7e',side*2.02,floor,col,g);
 box(.13,.08,width+.12,'#bea98d',side*2.02,floor-.36,col,g);
 }
 }
 // Brick piers, roof furniture and rear fire ladders give each lot a distinct silhouette.
 for(const x of [-1.87,1.87])box(.17,height,.16,i%2?'#b19c7a':'#705748',x,height/2+.12,1.99,g);
 if(i%3===0){
 for(const x of [-.35,.35])box(.06,height+.55,.08,'#293b3c',x,height/2+.4,-2.1,g);
 for(let y=.4;y<height+.65;y+=.3)box(.76,.055,.1,'#526362',0,y,-2.1,g);
 }
 if(i%4===0){box(1.05,.15,.95,'#303b3a',-.65,height+.43,.6,g);box(.75,.8,.75,'#756348',-.65,height+.9,.6,g);}
 if(i%4===1)for(let j=0;j<3;j++)box(.5,.28,.8,'#56615e',-.9+j*.9,height+.46,.2,g);
 if(i%5===2){const sideSign=label('ROOMS');sideSign.rotation.y=-Math.PI/2;sideSign.position.set(-2.15,height-.4,0);sideSign.scale.x=.7;g.add(sideSign);}
 box(.6,1,.09,'#263b3b',0,.62,2.01,g);
 box(3.7,.72,.12,'#423e30',0,signY,2.06,g);
 const sign=label(b.name);sign.position.set(0,signY,2.14);g.add(sign);
 const overlay=box(4.95,.055,4.95,'#82b9a0',0,.17,0,g);overlay.visible=false;
 const token=box(.8,.12,.8,'#82b9a0',-1.75,height+.35,-1.75,g);token.visible=false;
 let intact=g.children.filter(o=>o!==overlay&&o!==token).slice(1);
 const rubble=new THREE.Group();g.add(rubble);rubble.visible=false;
 box(3.9,.12,3.9,'#48473f',0,.2,0,rubble);
 // Stable brick piles, broken masonry and charred timber, all inside this lot.
 for(let j=0;j<45;j++){
 const x=(((j*37+i*11)%101)/100-.5)*3.5,z=(((j*61+i*7)%103)/102-.5)*3.5;
 const h=.16+(j%5)*.09;
 const brick=box(.23+(j%3)*.17,h,.22+(j%4)*.13,['#886550','#a17b61','#64564b','#b09a7c'][j%4],x,.25+h/2+(j%3)*.07,z,rubble);
 brick.rotation.set((j%3)*.2,(j*1.7)%Math.PI,(j%4)*.12);
 }
 for(let j=0;j<5;j++){const wall=box(.32,.65+j%3*.25,1.2,'#7c6250',-1.6+j*.8,.55,-1.5+(j%2)*2.8,rubble);wall.rotation.z=(j%2?.12:-.17);}
 for(let j=0;j<4;j++){const beam=box(2.7,.14,.16,'#322f29',0,.75+j*.09,(j-2)*.6,rubble);beam.rotation.y=j*.7;beam.rotation.z=.1*(j-1);}
 const fallenSign=label(b.name);fallenSign.position.set(0,.3,1.6);fallenSign.rotation.x=-Math.PI/2.8;rubble.add(fallenSign);
 intact=batchMeshes(g,intact);batchMeshes(rubble,[...rubble.children]);
 g.traverse(o=>{if(o.isMesh){o.userData.buildingId=b.id;picks.push(o);}});
 const cut=new THREE.Group();g.add(cut);cut.visible=false;for(const side of [-1,1]){box(3.9,.55,.16,palette[i%palette.length],0,.4,side*1.9,cut);box(.16,.55,3.9,palette[i%palette.length],side*1.9,.4,0,cut);}const plaque=label(b.name);plaque.position.set(0,.7,2.03);plaque.scale.y=.6;cut.add(plaque);cut.traverse(o=>{if(o.isMesh){o.userData.buildingId=b.id;picks.push(o);}});
 const greenery=new THREE.Group();g.add(greenery);const park=/Park|Gardens/.test(b.name);if(park){box(3.7,.05,3.7,'#647449',0,.25,0,greenery);for(const [x,z] of [[-1,-1],[1,1],[-1,1]])tree(x,z,greenery);}
 const assignment=new THREE.Group();g.add(assignment);for(const side of [-1,1]){box(5,.04,.07,'#66a780',0,.28,side*2.49,assignment);box(.07,.04,5,'#66a780',side*2.49,.28,0,assignment);}assignment.visible=false;
 buildings.set(b.id,{g,overlay,token,intact,rubble,cut,greenery,park,assignment});
 }
 // Decorative traffic follows closed street routes; it has no game-state effects.
 const traffic=[];
 for(let i=0;i<20;i++){
 const x=-14.2+(i%4)*8,z=i<4?-8.8:9.2;
 const car=new THREE.Group();car.position.set(x,0,z);scene.add(car);
 const left=-15+(i%5)*12,right=left+12,bottom=-15+Math.floor(i/5)*12,top=bottom+12;
 traffic.push({car,route:[new THREE.Vector3(left,0,bottom),new THREE.Vector3(right,0,bottom),new THREE.Vector3(right,0,top),new THREE.Vector3(left,0,top)],offset:i*6,speed:streetSpeed});
 box(1.35,.4,.7,['#342f2b','#5e4a3d','#263b3b'][i%3],0,.36,0,car);box(.65,.45,.63,'#29383a',-.1,.72,0,car);
 for(const a of [-.43,.43])for(const b of [-.37,.37]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.21,.21,.12,8),mat('#202829'));wheel.rotation.x=Math.PI/2;wheel.position.set(a,.22,b);car.add(wheel);}
 }
 for(let i=0;i<5;i++){const x=-14.5+i*6;box(.09,2.1,.09,'#273538',x,1.05,-14.4);box(.3,.35,.3,'#dec895',x,2.15,-14.4);}
 const pedestrians=[];
 for(let i=0;i<50;i++){
 const model=character({civilian:true,color:['#927f66','#697a78','#8a6560','#6b7259','#4e6270'][i%5],skin:['#c89f7b','#9a6e50','#dab996'][i%3],variant:i});
 const p=world({x:(i*7)%10,y:Math.floor(i*7/10)%10}),r=2.3;
 const route=[new THREE.Vector3(p.x-r,.14,p.z-r),new THREE.Vector3(p.x+r,.14,p.z-r),new THREE.Vector3(p.x+r,.14,p.z+r),new THREE.Vector3(p.x-r,.14,p.z+r)];
 scene.add(model);pedestrians.push({model,route,offset:i*3.13,speed:streetSpeed,panics:[]});
 }
 // A broad outer boulevard keeps tram tracks clear of the walking grid.
 box(61,.04,6,'#505452',15,-.10,49.5);
 for(const z of [48.1,48.65,50.1,50.65])box(60,.03,.055,'#96988c',15,-.04,z);
 for(let x=-14;x<45;x+=3){box(.7,.04,3.2,'#645b4c',x,-.07,49.4);if(x%2===0)tree(x,45.8);}
 const trams=[];
 for(let i=0;i<2;i++){const tram=new THREE.Group();scene.add(tram);box(3.5,.7,1.15,'#714d35',0,.55,0,tram);box(3.3,.8,1.1,'#d4bd8c',0,1.3,0,tram);box(3.7,.16,1.3,'#35423e',0,1.8,0,tram);for(let x=-1.2;x<1.5;x+=.6)for(const side of [-1,1])box(.42,.5,.035,'#344c50',x,1.35,side*.57,tram);for(const x of [-1.1,1.1])box(.4,.35,1.2,'#222c2b',x,.2,0,tram);const pole=box(.06,1.4,.06,'#3f4742',0,2.4,0,tram);pole.rotation.z=-.5;trams.push({model:tram,offset:i*60});}
 for(const z of [48.4,50.4])box(60,.025,.025,'#434b47',15,3.05,z);
 batchMeshes(scene,scene.children.filter(o=>o.isMesh));
 let state=null,overlayOn=false,cutawayOn=false,assignedBuildings=new Set();
 function apply(view,animate=false){
 if(state&&view.buildings.some(b=>{const old=state.buildings.find(v=>v.id===b.id);return old&&(old.name!==b.name||old.position.x!==b.position.x||old.position.y!==b.position.y);})){for(const b of buildings.values()){scene.remove(b.g);b.g.traverse(o=>{if(o.isMesh)o.geometry.dispose();});}buildings.clear();picks.length=0;}

 if(state&&state.profile?.color!==view.profile?.color){
 for(const m of hoods.values()){scene.remove(m);const materials=new Set();m.traverse(o=>{if(o.isMesh)o.geometry.dispose();if(o.material)materials.add(o.material);});for(const material of materials){material.map?.dispose();material.dispose();}}
 hoods.clear();motions.clear();
 }
 state=view;
 view.buildings.forEach((b,i)=>{
 if(!buildings.has(b.id))build(b,i);
 const m=buildings.get(b.id),color=b.ownerId==='gang-player'?(view.profile?.color??'#82b9a0'):b.ownerId==='gang-rival'?'#c8735c':null;
 m.assignment.visible=assignedBuildings.has(b.id);
 const ruined=(b.closedUntilWeek??0)>=view.week;
 m.rubble.visible=ruined;m.rubble.scale.y=cutawayOn?.4:1;m.cut.visible=cutawayOn&&!ruined;m.greenery.visible=!cutawayOn&&!ruined;for(const mesh of m.intact)mesh.visible=!ruined&&!cutawayOn&&!m.park;
 m.token.position.y=cutawayOn?.85:ruined?.95:(b.type==='police'?4.8:1.9+(i%3)*.65)+.35;
 m.overlay.visible=overlayOn&&!!color;m.token.visible=(overlayOn&&!!color)||b.ownerId==='gang-rival';
 if(color){m.overlay.material=mat(color);m.token.material=mat(color);}
 });
 const people=[...view.hoods,...(view.bystanders??[]).map(h=>({...h,status:'alive',indoors:false,civilian:true}))];
 const visible=new Set(people.filter(h=>(h.status==='alive'||(h.status==='dead'&&h.deathPosition&&h.deathWeek===view.week))&&!h.indoors&&!planning).map(h=>h.id));
 for(const [id,m] of hoods)if(!visible.has(id)){m.visible=false;motions.delete(id);}
 people.filter(h=>(h.status==='alive'||(h.status==='dead'&&h.deathPosition&&h.deathWeek===view.week))&&!h.indoors&&!planning).forEach(h=>{
 let m=hoods.get(h.id);
 if(!m){
 const color=h.gangId==='gang-player'?(view.profile?.color??'#99d0b2'):'#e3947d';
 m=character({civilian:!!h.civilian,color:h.civilian?'#777466':h.gangId==='gang-player'?color:'#795247',boss:h.boss,variant:parseInt(h.id.split('-')[1],h.civilian?36:10)});
 if(!h.civilian){
 const markerCanvas=document.createElement('canvas');markerCanvas.width=64;markerCanvas.height=64;const ctx=markerCanvas.getContext('2d');ctx.fillStyle=color;ctx.beginPath();ctx.arc(32,32,22,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#14252b';ctx.lineWidth=5;ctx.stroke();if(h.boss){ctx.fillStyle='#14252b';ctx.font='bold 25px Georgia';ctx.textAlign='center';ctx.fillText('B',32,41);}
 const marker=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(markerCanvas),depthTest:false}));marker.position.y=2.35;marker.scale.set(.45,.45,.45);marker.renderOrder=10;m.add(marker);m.userData.marker=marker;
 m.userData.hoodId=h.id;}scene.add(m);hoods.set(h.id,m);
 }
 m.userData.dead=h.status==='dead';if(m.userData.marker)m.userData.marker.visible=!m.userData.dead;
 if(m.userData.dead){motions.delete(h.id);m.userData.aimUntil=0;}
 equipModel(m,h.inventory?.gun??null);if(m.userData.dead&&m.userData.weapon)m.userData.weapon.rotation.x=0;
 if(h.civilian&&(!h.travel||motions.get(h.id)?.start!==h.travel.start))motions.delete(h.id);
 if(!animate||!m.visible||!motions.has(h.id))m.position.copy(h.status==='dead'?new THREE.Vector3(...h.deathPosition):h.streetPosition?new THREE.Vector3(...h.streetPosition):sidewalk(h.position,h.id));
 if(animate&&h.travel&&!motions.has(h.id)){const path=h.travel.path.map(p=>new THREE.Vector3(...p)),lengths=path.slice(1).map((p,i)=>p.distanceTo(path[i]));motions.set(h.id,{path,lengths,total:lengths.reduce((a,b)=>a+b,0),start:h.travel.start,duration:h.travel.durationMs});}
 m.visible=true;
 });
 }
 function move(event,start,duration){
 if(!hoods.get(event.actorId)?.visible&&event.actorGangId==='gang-player'&&!planning){
 apply({...state,hoods:state.hoods.map(h=>h.id===event.actorId?{...h,indoors:false,position:event.fromPosition}:h)},true);
 }
 const m=hoods.get(event.actorId);if(!m?.visible)return;
 const path=(event.data?.path??streetPath(event.fromPosition,event.toPosition,event.actorId)).map(p=>new THREE.Vector3(...p)),from=path[0],to=path.at(-1);
 const lengths=path.slice(1).map((p,i)=>p.distanceTo(path[i]));
 motions.set(event.actorId,{from,to,path,lengths,total:lengths.reduce((a,b)=>a+b,0),start,duration});
 }
 function pedestrianDistance(p,time){return time/1000*p.speed+p.offset+p.panics.reduce((n,period)=>n+Math.max(0,Math.min(time,period.end)-period.start)/1000*p.speed,0);}
 function updatePeople(dt){
 for(const [id,m] of hoods){
 if(!m.visible)continue;
 const motion=motions.get(id),before=m.position.clone();let travel=0;
 if(motion){
 const progress=THREE.MathUtils.clamp((visualTime-motion.start)/motion.duration,0,1);
 let remaining=progress*motion.total,index=0;while(index<motion.lengths.length-1&&remaining>motion.lengths[index])remaining-=motion.lengths[index++];
 m.position.lerpVectors(motion.path[index],motion.path[index+1],motion.lengths[index]?remaining/motion.lengths[index]:1);
 const direction=motion.path[index+1].clone().sub(motion.path[index]);
 const angle=Math.atan2(direction.x,direction.z);
 const difference=Math.atan2(Math.sin(angle-m.rotation.y),Math.cos(angle-m.rotation.y));
 m.rotation.y+=difference*(1-Math.exp(-dt*12));
 travel=progress<1?1:0;
 if(progress>=1)motions.delete(id);
 }
 m.userData.walkDistance=(m.userData.walkDistance??0)+m.position.distanceTo(before);
 pose(m,visualTime/1000,travel,m.userData.walkDistance/m.scale.x);
 if(m.userData.aimUntil>visualTime){m.rotation.y=m.userData.aimAngle;const rig=m.userData.rig;rig.arms[1].rotation.x=-.8;rig.elbows[1].rotation.x=-.4;if(m.userData.weapon)m.userData.weapon.rotation.x=1.2;}
 }
 // Overflow groups spread along the street instead of occupying the same waiting spot.
 const waiting=[...hoods.entries()].filter(([id,m])=>m.visible&&!m.userData.dead&&!motions.has(id)).sort(([a],[b])=>a<b?-1:1);
 for(let pass=0;pass<waiting.length;pass++)for(let i=0;i<waiting.length;i++)for(let j=i+1;j<waiting.length;j++){
 const a=waiting[i][1].position,b=waiting[j][1].position;if(Math.hypot(a.x-b.x,a.z-b.z)<.74)b.x+=.78;
 }
 for(const p of pedestrians){
 const distance=pedestrianDistance(p,visualTime),edge=4.6;
 const segment=Math.floor(distance/edge)%4,t=(distance%edge)/edge;
 const from=p.route[segment],to=p.route[(segment+1)%4];
 p.model.position.lerpVectors(from,to,t);
 const angle=Math.atan2(to.x-from.x,to.z-from.z),difference=Math.atan2(Math.sin(angle-p.model.rotation.y),Math.cos(angle-p.model.rotation.y));
 p.model.rotation.y+=difference*(1-Math.exp(-dt*8));
 pose(p.model,visualTime/1000+p.offset,1,distance/p.model.scale.x);
 }
 }
 const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();let down;
 renderer.domElement.addEventListener('pointerdown',e=>{following=null;down={x:e.clientX,y:e.clientY};});
 renderer.domElement.addEventListener('pointerup',e=>{
 if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)return;
 const r=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(mouse,camera);
 const hit=ray.intersectObjects(picks.filter(o=>{for(let parent=o;parent;parent=parent.parent)if(!parent.visible)return false;return true;}),false)[0];
 if(replaying&&!planning){
 const person=ray.intersectObjects([...hoods.values()].filter(m=>m.visible),true)[0];
 if(person&&(!hit||person.distance<hit.distance||person.object.isSprite)){
 let root=person.object;while(root&&!root.userData.hoodId)root=root.parent;
 if(root){onHoodSelect(root.userData.hoodId);return;}
 }
 }
 if(hit&&state)onSelect(state.buildings.find(b=>b.id===hit.object.userData.buildingId));
 else if(state){const point=new THREE.Vector3();if(ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),point)){const x=Math.round(point.x/6+2),y=Math.round(point.z/6+2);if(x>=0&&x<10&&y>=0&&y<10)onSelect(state.buildings.find(b=>b.position.x===x&&b.position.y===y),true);}}
 });
 const resize=new ResizeObserver(()=>{const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h);const halfHeight=Math.max(40,42*h/w);camera.left=-halfHeight*w/h;camera.right=halfHeight*w/h;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();});resize.observe(container);
 const clock=new THREE.Clock();
 renderer.setAnimationLoop(()=>{
 const dt=Math.min(clock.getDelta(),.1);
 if(!replaying)visualTime+=dt*1000;
 const animationDt=Math.max(0,visualTime-lastVisualTime)/1000;lastVisualTime=visualTime;
 updatePeople(animationDt);effects.update(visualTime);
 for(const tram of trams){const p=(visualTime/1000*1.5+tram.offset)%120,forward=p<60;tram.model.position.set(forward?-15+p:45-(p-60),0,forward?48.4:50.4);tram.model.rotation.y=forward?0:Math.PI;}
 for(const t of traffic){const along=visualTime/1000*t.speed+t.offset,index=Math.floor(along/12)%4,from=t.route[index],to=t.route[(index+1)%4];t.car.position.lerpVectors(from,to,(along%12)/12);t.car.rotation.y=-Math.atan2(to.z-from.z,to.x-from.x);}
 if(keys.size&&!document.querySelector('dialog[open]')){
 const horizontal=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
 const vertical=Number(keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown'));
 const forward=controls.target.clone().sub(camera.position);forward.y=0;forward.normalize();
 const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0));
 const delta=forward.multiplyScalar(vertical).addScaledVector(right,horizontal);
 if(delta.lengthSq()){delta.normalize().multiplyScalar(dt*15/camera.zoom);camera.position.add(delta);controls.target.add(delta);}
 }
 if(following&&hoods.get(following)?.visible){const target=hoods.get(following).position.clone();target.y=1;const delta=target.sub(controls.target).multiplyScalar(1-Math.exp(-dt*5));controls.target.add(delta);camera.position.add(delta);}
 controls.update();renderer.render(scene,camera);
 });
 return {
 apply,reset,move,
 assignmentTargets(ids){assignedBuildings=new Set(ids.filter(Boolean));for(const [id,m] of buildings)m.assignment.visible=assignedBuildings.has(id);},
 cutaway(value){cutawayOn=!!value;if(state)apply(state,true);},
 screenPosition(id){const m=hoods.get(id);if(!m?.visible)return null;const p=m.userData.dead?m.localToWorld(new THREE.Vector3(0,.22,-.9)):m.position.clone().add(new THREE.Vector3(0,1.1,0));p.project(camera);const r=renderer.domElement.getBoundingClientRect();return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};},
 confirmOrder(id){const b=state?.buildings.find(b=>b.id===id);if(b)effects.orderPulse(world(b.position),visualTime);},
 inspectBuilding(id){const b=buildings.get(id);return b?{ruined:b.rubble.visible,intactVisible:b.intact.some(o=>o.visible)}:null;},
 planning(value){planning=value;if(value)following=null;if(state)apply(state,true);},
 playback(active,time=0){for(const p of pedestrians)p.panics=active?[]:p.panics.filter(period=>period.end>visualTime).map(period=>({start:time,end:time+period.end-visualTime}));replaying=active;visualTime=time;lastVisualTime=time;motions.clear();effects.clear();for(const m of hoods.values()){m.userData.aimUntil=0;m.userData.walkDistance=0;}},
 time(value){visualTime=value;},
 focus(id){if(!hoods.get(id)?.visible)return;following=id;camera.zoom=2.8;camera.updateProjectionMatrix();},
 event(e,time=visualTime){
 if(e.type==='death'||e.type==='combat_end'){for(const id of e.type==='death'?[e.data.victimId,e.actorId]:(e.data.participants??[])){const m=hoods.get(id);if(m)m.userData.aimUntil=0;}}
 if(e.type==='motion_stop'){motions.delete(e.actorId);const m=hoods.get(e.actorId);if(m&&e.data.world)m.position.set(...e.data.world);return;}
 if(e.data?.kind==='gunfire'&&e.data.fromWorld&&e.data.toWorld){const m=hoods.get(e.data.shooterId??e.actorId);if(m){m.userData.aimUntil=time+550;m.userData.aimAngle=Math.atan2(e.data.toWorld[0]-e.data.fromWorld[0],e.data.toWorld[2]-e.data.fromWorld[2]);}effects.gunshot(e.data.fromWorld,e.data.toWorld,time);return;}
 if(!e.actorId||!e.toPosition)return;
 const p=world(e.toPosition);
 if(e.orderType==='bomb'&&e.type==='action_result'&&e.data?.detonated){effects.explosion(p,time,e.tick*1000+e.seq);for(const pedestrian of pedestrians){const d=pedestrianDistance(pedestrian,time),segment=Math.floor(d/4.6)%4,pos=pedestrian.route[segment].clone().lerp(pedestrian.route[(segment+1)%4],d%4.6/4.6);if(Math.hypot(pos.x-p.x,pos.z-p.z)<8){const last=pedestrian.panics.at(-1);if(last&&last.end>=time)last.end=time+10000;else pedestrian.panics.push({start:time,end:time+10000});}}}
 else if(['arrive','action_result','death','ownership_change'].includes(e.type))effects.pulse(p,time,e.type==='death'?'#e3947d':e.outcome==='success'?'#99d0b2':'#d5b574');
 },
 overlay(value){overlayOn=value;if(state)apply(state,true);},
 // Read-only diagnostics used by the renderer's browser smoke checks.
 inspect(){return {cameraTarget:controls.target.toArray(),cutaway:cutawayOn,assignedBuildings:[...assignedBuildings],tramPositions:trams.map(t=>t.model.position.toArray()),planning,trafficPositions:traffic.map(t=>t.car.position.toArray()),pedestrians:pedestrians.length,panicking:pedestrians.filter(p=>p.panics.some(t=>t.start<=visualTime&&t.end>visualTime)).length,civilianPositions:pedestrians.map(p=>p.model.position.toArray()),effects:effects.count,time:visualTime,hoods:[...hoods].filter(([,m])=>m.visible).map(([id,m])=>({id,dead:!!m.userData.dead,eyesClosed:m.userData.rig.eyes.every(e=>e.scale.y===.12),aiming:m.userData.aimUntil>visualTime,yaw:m.rotation.y,gun:m.userData.gun??null,position:m.position.toArray(),leg:m.userData.rig.legs[0].rotation.x,triangles:(()=>{let n=0;m.traverse(o=>{if(o.isMesh)n+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});return n;})(),meshes:(()=>{let n=0;m.traverse(o=>{if(o.isMesh)n++;});return n;})}))};}
 };
}
