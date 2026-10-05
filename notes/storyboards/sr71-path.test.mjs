import assert from 'node:assert/strict';
import {defaults,pose,schedule,cleanSettings} from './sr71-path.mjs';

for (const s of [defaults,
  {...defaults,soft:0,climb:180,clearance:30},
  {...defaults,duration:8,hold:6,soft:1.5},
  {...defaults,duration:30,speed:150,height:8}]) {
  const cuts=schedule(s);
  assert.ok(Math.abs(cuts.at(-1).end-1)<1e-9, 'clip ends at 100%');
  assert.ok(Math.abs(cuts[2].duration-s.hold)<1e-9, 'side hold lasts requested seconds');
  let previous=pose(0,s);
  for (let i=0;i<=1000;i++) {
    const p=pose(i/1000,s);
    for (const v of [p.aircraft,p.camera,p.aim]) assert.ok(Object.values(v).every(Number.isFinite));
    assert.equal(p.aircraft.x,0, 'aircraft never flies sideways');
    assert.ok(p.aircraft.z<=previous.aircraft.z, 'aircraft always moves nose-forward');
    assert.ok(p.aircraft.y>=previous.aircraft.y, 'climb does not reverse');
    assert.ok(p.camera.y>=p.aircraft.y+s.clearance-1e-9, 'camera stays above flight path');
    previous=p;
  }
  const forward=[0,.2,.6,.9,1].map(u=>pose(u,s));
  const backward=[1,.9,.6,.2,0].map(u=>pose(u,s)).reverse();
  assert.deepEqual(forward,backward, 'scrubbing backward reproduces the same camera poses');
}
assert.equal(cleanSettings({height:Infinity}).height,28);
assert.equal(cleanSettings({height:28,hold:2.5,soft:.6,duration:8}).height,28);
assert.equal(cleanSettings({settings:{height:65,progress:22}}).height,65);
console.log('Camera path invariants passed.');
