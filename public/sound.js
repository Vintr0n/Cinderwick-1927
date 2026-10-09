const files={background:'/sounds/background-loop.wav',bomb:'/sounds/bomb-1.mp3',agree:['/sounds/agree-1.wav','/sounds/agree-2.mp3','/sounds/agree-3.wav'],reject:['/sounds/reject-1.wav','/sounds/reject-2.wav']};

export function createSoundtrack({AudioClass=globalThis.Audio,storage=globalThis.localStorage,random=Math.random,now=()=>performance.now()}={}){
 let muted=false,unlocked=false,variant=0,lastVoice=-Infinity;
 try{muted=storage?.getItem('cinderwick-muted')==='true';}catch{}
 const background=new AudioClass(files.background);background.loop=true;background.volume=.22;background.preload='none';
 const active=new Set();
 const play=audio=>{try{audio.play()?.catch(()=>{});}catch{}};
 function stopEffects(){for(const audio of active){audio.pause();audio.currentTime=0;}active.clear();}
 function unlock(){unlocked=true;if(!muted)play(background);}
 function setMuted(value){
 muted=!!value;try{storage?.setItem('cinderwick-muted',String(muted));}catch{}
 if(muted){background.pause();stopEffects();}else unlock();
 }
 function event(e){
 if(e.type==='death'||e.type==='combat_end'){const ids=e.type==='death'?[e.data.victimId]:(e.data.participants??[e.actorId,e.data.targetHoodId]);for(const audio of active)if(audio.fighters?.some(id=>ids.includes(id))){audio.pause();audio.currentTime=0;active.delete(audio);}return;}
 if(muted||!unlocked||!e.actorId)return;
 let file;
 if(e.type==='action_attempt'&&e.data?.kind==='investigation_shot')file='/sounds/handgun-1.wav';
 else if(e.type==='action_attempt'&&e.data?.kind==='gunfire'){if([...active].some(a=>a.shooter===e.actorId))return;file=e.data.gun==='tommy'?'/sounds/tommy-gun-1.wav':'/sounds/handgun-1.wav';}
 else if(e.type!=='action_result')return;
 else if(e.orderType==='bomb'&&e.data?.detonated!==false&&(e.data?.detonated||e.outcome==='success'||e.outcome==='partial'))file=files.bomb;
 else if(e.orderType==='extort'&&['success','fail'].includes(e.outcome)){
 if(now()-lastVoice<4500||random()>=.5)return;
 lastVoice=now();const pool=e.outcome==='success'?files.agree:files.reject;file=pool[variant++%pool.length];
 }
 if(!file)return;
 if(active.size>=8&&![...active].every(a=>a.fighters)){const oldest=[...active].find(a=>!a.fighters);oldest.pause();active.delete(oldest);}
 const audio=new AudioClass(file);audio.volume=e.orderType==='bomb'?.75:.85;
 if(e.data?.kind==='gunfire'){audio.fighters=[e.actorId,e.data.targetHoodId];audio.shooter=e.actorId;audio.loop=true;}
 active.add(audio);audio.addEventListener('ended',()=>active.delete(audio),{once:true});audio.addEventListener('error',()=>active.delete(audio),{once:true});play(audio);
 }
 return {unlock,setMuted,event,stopEffects,get muted(){return muted;}};
}
