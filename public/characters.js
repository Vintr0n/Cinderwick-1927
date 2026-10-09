import * as THREE from 'three';

// Original articulated models. +Z is forward; limb pivots drive the walk cycle.
export function character({color='#455e57',skin='#bf9473',civilian=false,boss=false,variant=0}={}){
 const root=new THREE.Group(),body=new THREE.Group();root.add(body);
 const materials=new Map();
 const material=c=>{if(!materials.has(c))materials.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.85}));return materials.get(c);};
 function mesh(geometry,c,parent,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material(c));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 const box=(w,h,d,c,parent,x,y,z)=>mesh(new THREE.BoxGeometry(w,h,d),c,parent,x,y,z);
 const sphere=(r,c,parent,x,y,z,sx=1,sy=1,sz=1)=>{const m=mesh(new THREE.SphereGeometry(r,16,12),c,parent,x,y,z);m.scale.set(sx,sy,sz);return m;};
 const joint=(parent,x,y,z)=>{const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;};
 const trousers=civilian?'#574d43':'#26343a';
 const hips=joint(body,0,.73,0);
 box(.39,.24,.25,trousers,hips,0,0,0);
 const legs=[],knees=[],arms=[],elbows=[],feet=[],eyes=[];
 for(const side of [-1,1]){
 const leg=joint(hips,side*.115,-.04,0);legs.push(leg);
 mesh(new THREE.CylinderGeometry(.095,.08,.32,12),trousers,leg,0,-.16,0);
 const knee=joint(leg,0,-.32,0);knees.push(knee);
 mesh(new THREE.CylinderGeometry(.078,.065,.29,12),trousers,knee,0,-.145,0);
 const ankle=joint(knee,0,-.31,0);feet.push(ankle);box(.16,.115,.29,'#242725',ankle,0,0,.06);
 const arm=joint(body,side*.255,1.24,0);arms.push(arm);
 mesh(new THREE.CylinderGeometry(.105,.075,.31,12),color,arm,0,-.15,0);
 const elbow=joint(arm,0,-.3,0);elbows.push(elbow);
 mesh(new THREE.CylinderGeometry(.075,.06,.27,12),color,elbow,0,-.135,0);
 sphere(.073,skin,elbow,0,-.295,.015);
 }
 mesh(new THREE.CylinderGeometry(.26,.22,.55,16),color,body,0,1.035,0).scale.z=.65;
 box(.16,.34,.035,'#e7dcc6',body,0,1.17,.166);
 const tie=box(.055,.26,.04,boss?'#d3ae65':civilian?'#847961':'#a16e54',body,0,1.15,.19);tie.rotation.z=.04;
 for(const side of [-1,1]){const lapel=box(.1,.3,.04,color,body,side*.1,1.15,.19);lapel.rotation.z=side*.25;}
 for(let i=0;i<3;i++)sphere(.017,'#b6a181',body,.055,1.06-i*.1,.19);
 const head=joint(body,0,1.52,0);
 mesh(new THREE.CylinderGeometry(.08,.08,.13,12),skin,body,0,1.36,0);
 sphere(.19,skin,head,0,0,0,.85,1.15,.85);
 sphere(.035,skin,head,0,-.012,.166,1,1,1.2);
 for(const side of [-1,1]){
 sphere(.043,skin,head,side*.161,-.015,0,.55,1,.7);
 eyes.push(sphere(.018,'#262b29',head,side*.067,.036,.142,1,.7,.5));
 box(.05,.012,.018,'#41382e',head,side*.067,.075,.139);
 }
 box(.07,.012,.014,'#765347',head,0,-.088,.151);
 const hatColor=civilian?['#806b50','#594d44','#807b68'][variant%3]:'#303e3e';
 mesh(new THREE.CylinderGeometry(.29,.3,.045,24),hatColor,head,0,.18,0).scale.z=.85;
 mesh(new THREE.CylinderGeometry(.165,.205,.19,20),hatColor,head,0,.28,0).scale.z=.85;
 mesh(new THREE.CylinderGeometry(.201,.205,.042,20),boss?'#d3ae65':'#40362d',head,0,.215,0).scale.z=.85;
 if(civilian&&variant%3===0){box(.25,.25,.09,'#795338',arms[1],0,-.7,.04);box(.1,.04,.05,'#c0a16c',arms[1],0,-.54,.04);}
 root.scale.setScalar(civilian?.86:1);
 root.userData.rig={body,head,legs,knees,arms,elbows,feet,eyes};
 root.userData.civilian=civilian;
 return root;
}
export function pose(model,time,travel=0,walkDistance=time*.5){
 const r=model.userData.rig;
 if(model.userData.dead){r.body.rotation.x=-Math.PI/2;r.body.position.y=.22;r.eyes.forEach(e=>e.scale.y=.12);for(const joint of [...r.legs,...r.knees,...r.arms,...r.elbows,...r.feet])joint.rotation.set(0,0,0);return;}
 r.body.rotation.x=0;r.eyes.forEach(e=>e.scale.y=.7);
 const walking=Math.min(1,travel),cycle=walkDistance/.88*Math.PI*2;
 r.body.position.y=walking?-.09:Math.sin(time*1.7)*.008;
 r.body.rotation.z=0;
 for(let i=0;i<2;i++){
 const phase=cycle+i*Math.PI,swing=Math.sin(phase)*walking;
 const step=((cycle/(Math.PI*2)+i*.5)%1+1)%1,u=(step-.5)*2;
 const z=step<.5?.22-.88*step:-.22+.44*u,down=.54-(step<.5?0:Math.sin(u*Math.PI)*.12),radius=Math.hypot(z,down);
 const knee=Math.acos(THREE.MathUtils.clamp((radius*radius-.32*.32-.31*.31)/(2*.32*.31),-1,1));
 const hip=Math.atan2(-z,down)-Math.acos(THREE.MathUtils.clamp((.32*.32+radius*radius-.31*.31)/(2*.32*radius),-1,1));
 r.legs[i].rotation.x=hip*walking;r.knees[i].rotation.x=knee*walking;r.feet[i].rotation.x=-(hip+knee)*walking;
 r.arms[i].rotation.x=-swing*.48-.08;
 r.elbows[i].rotation.x=-.12-Math.max(0,swing)*.2;
 }
 r.head.rotation.y=Math.sin(time*.65)*.09*(1-walking);
 if(model.userData.weapon)model.userData.weapon.rotation.x=model.userData.gun==='pistol'?1.05:0;
 if(model.userData.gun){r.arms[1].rotation.x=-.35;r.elbows[1].rotation.x=-.8;if(model.userData.gun==='tommy'){r.arms[0].rotation.x=-.55;r.elbows[0].rotation.x=-1;}}
}
export function equipModel(model,gun){
 if((model.userData.gun??null)===gun)return;
 const old=model.userData.weapon;
 if(old){old.removeFromParent();old.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});}
 model.userData.gun=gun;model.userData.weapon=null;if(!gun)return;
 const group=new THREE.Group();model.userData.rig.elbows[1].add(group);group.position.set(0,-.29,.04);
 function part(w,h,d,color,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.55,metalness:color==='#35413f'?.65:0}));m.position.set(x,y,z);m.castShadow=true;group.add(m);}
 if(gun==='tommy'){
 part(.12,.14,.55,'#35413f',0,.06,.16);part(.07,.07,.43,'#35413f',0,.06,.65);
 part(.13,.16,.31,'#765039',0,0,-.25);part(.09,.23,.1,'#765039',0,-.14,.4);
 const drum=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.15,20),new THREE.MeshStandardMaterial({color:'#35413f',metalness:.65,roughness:.55}));drum.rotation.z=Math.PI/2;drum.position.set(0,-.13,.17);drum.castShadow=true;group.add(drum);
 }else{
 // Exaggerated black slide and grip keep the pistol silhouette readable at map scale.
 group.rotation.x=1.05;
 part(.105,.115,.46,'#101715',0,.1,.2);
 part(.10,.25,.13,'#171c19',0,-.075,.015);
 part(.07,.035,.05,'#101715',0,.175,.37);
 }
 model.userData.weapon=group;
}
