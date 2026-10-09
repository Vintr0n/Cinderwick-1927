import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {character,pose} from '../public/characters.js';
test('a planted foot stays on the ground instead of sliding as the character advances',()=>{
 const model=character(),points=[];
 for(const distance of [.02,.08,.16]){model.position.z=distance;pose(model,0,1,distance);model.updateMatrixWorld(true);points.push(model.userData.rig.feet[0].getWorldPosition(new THREE.Vector3()));}
 for(const p of points)assert.ok(p.distanceTo(points[0])<.001);
});
