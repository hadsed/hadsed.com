import assert from 'node:assert/strict';
import {defaults,pose,schedule,cleanSettings,approachMotion} from './sr71-path.mjs';

for (const s of [defaults,
  {...defaults,soft:0,climb:180,clearance:30},
  {...defaults,duration:6,hold:3,bank:65,turn:70},
  {...defaults,duration:30,speed:150,height:8}]) {
  const cuts=schedule(s);
  const bankStart=Math.max(cuts[2].start,cuts[4].start-s.bankLead/s.duration);
  assert.ok(Math.abs(cuts.at(-1).end-1)<1e-9, 'clip ends at 100%');
  assert.ok(Math.abs(cuts[3].duration-s.hold)<1e-9, 'side hold lasts requested seconds');
  let previous=pose(0,s);
  for (let i=0;i<=1000;i++) {
    const p=pose(i/1000,s);
    for (const v of [p.aircraft,p.camera,p.aim]) assert.ok(Object.values(v).every(Number.isFinite));
    if(i/1000<=bankStart)assert.equal(p.aircraft.x,0,'straight flight before banking departure');
    assert.ok(p.aircraft.z<=previous.aircraft.z, 'aircraft always moves nose-forward');
    assert.ok(p.aircraft.y>=previous.aircraft.y, 'climb does not reverse');
    if(i/1000<cuts[2].start)assert.ok(p.camera.y>=p.aircraft.y+s.clearance-1e-9,'front camera stays above aircraft');
    assert.ok(p.camera.y>=.2,'camera stays above water');
    previous=p;
  }
  const forward=[0,.2,.6,.9,1].map(u=>pose(u,s));
  const backward=[1,.9,.6,.2,0].map(u=>pose(u,s)).reverse();
  assert.deepEqual(forward,backward, 'scrubbing backward reproduces the same camera poses');
}
assert.equal(cleanSettings({height:Infinity}).height,defaults.height);
assert.equal(cleanSettings({height:28,hold:2.5,soft:.6,duration:8}).height,28);
assert.equal(cleanSettings({settings:{height:65,progress:22}}).height,65);
console.log('Camera path invariants passed.');

const rush=approachMotion(defaults),openingEnd=schedule(defaults)[0].end;
const first=pose(0,defaults),early=pose(openingEnd*.25,defaults),last=pose(openingEnd,defaults);
assert.ok(first.camera.z<early.camera.z,'camera initially travels toward aircraft');
assert.ok(early.aircraft.z<first.aircraft.z,'aircraft independently travels toward camera');
assert.ok(Math.abs(last.camera.z-last.aircraft.z)<Math.abs(first.camera.z-first.aircraft.z),'opening closes distance');
assert.ok(Math.abs(Math.abs(last.camera.z-last.aircraft.z)-rush.endGap)<.01,'opening reaches computed gap');
for(let i=1;i<=100;i++){const u=openingEnd*i/100;const p=pose(u,defaults);assert.ok(p.aircraft.z-p.camera.z>=Math.max(defaults.nose+40,80)-1e-6,'opening never crosses through plane')}
for(const cut of schedule(defaults).slice(0,-1)){const a=pose(cut.end-1e-8,defaults),b=pose(cut.end+1e-8,defaults);assert.ok(Math.hypot(a.camera.x-b.camera.x,a.camera.y-b.camera.y,a.camera.z-b.camera.z)<.1,'phase boundary stays continuous')}
console.log('Opening approach motion and phase continuity passed.');

const revisedCuts=schedule(defaults);
const boundary=revisedCuts[0].end,epsilon=1e-5;
const relativeZ=u=>{const p=pose(u,defaults);return p.camera.z-p.aircraft.z};
const before=(relativeZ(boundary)-relativeZ(boundary-epsilon))/(epsilon*defaults.duration);
const after=(relativeZ(boundary+epsilon)-relativeZ(boundary))/(epsilon*defaults.duration);
assert.ok(before>50,'closing does not stop at nose reveal');
assert.ok(Math.abs(before-after)<1,'closing velocity matches across reveal boundary');
const aircraftBefore=(pose(boundary,defaults).aircraft.z-pose(boundary-epsilon,defaults).aircraft.z)/(epsilon*defaults.duration);
const aircraftAfter=(pose(boundary+epsilon,defaults).aircraft.z-pose(boundary,defaults).aircraft.z)/(epsilon*defaults.duration);
assert.ok(Math.abs(aircraftBefore-aircraftAfter)<1,'aircraft speed remains matched');
const revealMid=pose((revisedCuts[1].start+revisedCuts[1].end)/2,defaults);
assert.equal(revealMid.camera.x,0,'no turn until nose reveal ends');
for(let n=0;n<=100;n++){
 const u=revisedCuts[2].start+(1-revisedCuts[2].start)*n/100,p=pose(u,defaults);
 const radius=Math.hypot(p.camera.x-p.aircraft.x,p.camera.z-p.aircraft.z);
 assert.ok(Math.abs(radius-defaults.nose)<1e-8,'close orbit and departure never pull back');
 if(u>=revisedCuts[2].end){const nozzleY=p.aircraft.y-9.5*Math.sin(p.pitch);assert.ok(Math.abs(p.camera.y-nozzleY-defaults.exhaustHeight)<1e-8,'camera follows nozzle eye height during climb');}
}
const exhaust=pose(revisedCuts[3].start,defaults);
assert.ok(exhaust.camera.z>exhaust.aircraft.z,'camera acquired rear');
const rearAlignment=Math.atan2(exhaust.camera.x-exhaust.aircraft.x,exhaust.camera.z-exhaust.aircraft.z)+exhaust.heading;
assert.ok(Math.abs(rearAlignment-(defaults.orbitAngle*Math.PI/180-Math.PI))<1e-8,'saved rear angle retained relative to turning aircraft');
const beforeClimb=pose(revisedCuts[4].start-.01,defaults);
assert.equal(beforeClimb.aircraft.y,defaults.flightHeight,'aircraft stays level while bank establishes');
assert.ok(beforeClimb.bank>.1,'visible bank established before climb');
assert.equal(pose(1,defaults).fade,0,'ending preserves horizon and exhausts without wash');
const end=pose(1,defaults);
assert.ok(end.aircraft.x>0,'departure curves toward aircraft right');
assert.ok(end.bank>0&&end.heading>0&&end.pitch>0,'departure banks, turns, and climbs together');
assert.equal(revisedCuts.length,6,'middle stages collapsed into close orbit and exhaust framing');
console.log('Constant close radius, rear exhaust framing, and banking departure passed.');
