import {createGame} from '../server/sim/model.js';
import {simulate} from '../server/sim/engine.js';
const seed=Number(process.argv[2]??1927);
console.log(JSON.stringify(simulate(createGame(seed),[{actorId:'h-1',type:'extort',targetId:'b-01'}],seed),null,2));
