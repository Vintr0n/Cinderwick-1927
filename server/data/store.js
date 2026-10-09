import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
export function createStore(root=resolve('data')){
 mkdirSync(root,{recursive:true});
 const read=(file,fallback=null)=>existsSync(file)?JSON.parse(readFileSync(file,'utf8')):fallback;
 const write=(file,value)=>{mkdirSync(resolve(file,'..'),{recursive:true});writeFileSync(file+'.tmp',JSON.stringify(value,null,2));renameSync(file+'.tmp',file);};
 const safe=id=>{if(!/^[a-zA-Z0-9-]+$/.test(String(id)))throw Error('Invalid storage identifier');return String(id);};
 return {
 getGame:()=>read(join(root,'game.json')),
 saveGame:game=>write(join(root,'game.json'),game),
 appendReplay:replay=>write(join(root,'replays',safe(replay.gameId),'week-'+safe(replay.week)+'.json'),replay),
 getReplay:(id,week)=>read(join(root,'replays',safe(id),'week-'+safe(week)+'.json')),
 listReplays:id=>{const dir=join(root,'replays',safe(id));return existsSync(dir)?readdirSync(dir).filter(f=>/^week-\d+\.json$/.test(f)).map(f=>Number(f.match(/\d+/)[0])).sort((a,b)=>b-a):[];}
 };
}
