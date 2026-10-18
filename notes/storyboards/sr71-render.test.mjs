import assert from 'node:assert/strict';
import {defaults,pose} from './sr71-path.mjs';
import {motionPackage} from './sr71-render.mjs';
for(const fps of [24,30,60]){
 const p=motionPackage(defaults,{route:'3d',look:'Quiet blue twilight.',width:1280,height:720,fps});
 assert.equal(p.samples.length,Math.ceil(defaults.duration*fps)+1);
 assert.equal(p.samples[0].time,0);assert.equal(p.samples.at(-1).time,defaults.duration);
 assert.deepEqual(p.samples.at(-1).camera,pose(1,defaults).camera);
 assert.equal(p.phases.length,4);assert.equal(p.output.aspect,16/9);
 assert.ok(p.brief.includes('Quiet blue twilight.'));
 assert.ok(p.samples.every((s,i)=>i===0||s.time>p.samples[i-1].time));
}
console.log('Render handoff sampling, endpoint and brief passed.');
