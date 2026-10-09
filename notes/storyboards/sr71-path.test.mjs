import assert from 'node:assert/strict';
import {defaults,pose,schedule,cleanSettings,approachMotion} from './sr71-path.mjs';

for (const s of [defaults,
  {...defaults,soft:0,climb:180,clearance:30},
  {...defaults,duration:6,hold:3,bank:65,turn:70},
  {...defaults,duration:30,speed:150,height:8}]) {
  const cuts=schedule(s);
  const bankStart=cuts[1].start;
  assert.ok(Math.abs(cuts.at(-1).end-1)<1e-9, 'clip ends at 100%');
  assert.ok(Math.abs(cuts[2].duration-s.hold)<1e-9, 'bank setup lasts requested seconds');
  let previous=pose(0,s);
  for (let i=0;i<=1000;i++) {
    const p=pose(i/1000,s);
    for (const v of [p.aircraft,p.camera,p.aim]) assert.ok(Object.values(v).every(Number.isFinite));
    if(i/1000<=bankStart)assert.equal(p.aircraft.x,0,'straight flight before banking departure');
    assert.ok(p.aircraft.z<=previous.aircraft.z, 'aircraft always moves nose-forward');
    assert.ok(p.aircraft.y>=previous.aircraft.y, 'climb does not reverse');
    if(i/1000<cuts[1].start)assert.ok(p.camera.y>=p.aircraft.y+s.clearance-1e-9,'front camera stays above aircraft');
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
for(let i=1;i<=100;i++){const u=openingEnd*i/100;const p=pose(u,defaults);assert.ok(p.aircraft.z-p.camera.z>=defaults.nose-1e-6,'opening never crosses through plane')}
for(const cut of schedule(defaults).slice(0,-1)){const a=pose(cut.end-1e-8,defaults),b=pose(cut.end+1e-8,defaults);assert.ok(Math.hypot(a.camera.x-b.camera.x,a.camera.y-b.camera.y,a.camera.z-b.camera.z)<.1,'phase boundary stays continuous')}
console.log('Opening approach motion and phase continuity passed.');

const revisedCuts=schedule(defaults);
assert.equal(last.camera.x,0,'closing endpoint remains head-on');
assert.ok(Math.abs(last.camera.y-(defaults.flightHeight+defaults.clearance))<1e-8,'closing reaches the supplied frame height');
assert.ok(Math.abs(last.aircraft.z-last.camera.z-defaults.nose)<1e-8,'single approach reaches exact close frame');
let priorGap=Infinity,priorHeight=Infinity;
for(let n=0;n<=200;n++){
 const p=pose(openingEnd*n/200,defaults),gap=p.aircraft.z-p.camera.z;
 assert.ok(gap<=priorGap+1e-7,'single closing path never retreats');
 assert.ok(p.camera.y<=priorHeight+1e-7,'camera descends continuously through closing path');
 priorGap=gap;priorHeight=p.camera.y;
}
for(let n=0;n<=100;n++){
 const u=revisedCuts[1].start+(1-revisedCuts[1].start)*n/100,p=pose(u,defaults);
 const radius=Math.hypot(p.camera.x-p.aircraft.x,p.camera.z-p.aircraft.z);
 if(u>=revisedCuts[1].end)assert.ok(radius<=defaults.nose+1e-8,'rear follow only pushes closer');
 if(u>=revisedCuts[1].end){const nozzleY=p.aircraft.y-9.5*Math.sin(p.pitch);assert.ok(Math.abs(p.camera.y-nozzleY-defaults.exhaustHeight)<1e-8,'camera follows nozzle eye height during climb');}
}
const exhaust=pose(revisedCuts[2].start,defaults);
assert.ok(exhaust.camera.z>exhaust.aircraft.z,'camera acquired rear');
const rearAlignment=Math.atan2(exhaust.camera.x-exhaust.aircraft.x,exhaust.camera.z-exhaust.aircraft.z)+exhaust.heading;
assert.ok(Math.abs(rearAlignment-(defaults.orbitAngle*Math.PI/180-Math.PI))<1e-8,'saved rear angle retained relative to turning aircraft');
const beforeClimb=pose(revisedCuts[3].start-.01,defaults);
assert.equal(beforeClimb.aircraft.y,defaults.flightHeight,'aircraft stays level while bank establishes');
assert.ok(beforeClimb.bank>.1,'visible bank established before climb');
assert.equal(pose(1,defaults).fade,0,'ending preserves horizon and exhausts without wash');
const end=pose(1,defaults);
assert.ok(end.aircraft.x>0,'departure curves toward aircraft right');
assert.ok(end.bank>0&&end.heading>0&&end.pitch>0,'departure banks, turns, and climbs together');
assert.equal(revisedCuts.length,5,'nose reveal removed; closing feeds directly into orbit');
const whipQuarter=pose(revisedCuts[1].start+.25*(revisedCuts[1].end-revisedCuts[1].start),defaults);
assert.ok(whipQuarter.bank>.1,'bank visible during camera whip');
const dx=whipQuarter.camera.x-whipQuarter.aircraft.x,dz=whipQuarter.camera.z-whipQuarter.aircraft.z;
const localX=Math.cos(whipQuarter.heading)*dx+Math.sin(whipQuarter.heading)*dz;
assert.ok(Math.abs(localX)<defaults.nose*.6,'pass hugs aircraft more closely than former circle');
const endRadius=Math.hypot(end.camera.x-end.aircraft.x,end.camera.z-end.aircraft.z);
assert.ok(Math.abs(endRadius-defaults.pushGap)<1e-8,'late jet push reaches requested closer gap');
console.log('Tight side whip, bank during whip, eye-level follow, and late jet push passed.');

const dt=1e-6,relativeForward=u=>{const p=pose(u,defaults);return p.camera.z-p.aircraft.z};
const enterBefore=(relativeForward(openingEnd)-relativeForward(openingEnd-dt))/(dt*defaults.duration);
const enterAfter=(relativeForward(openingEnd+dt)-relativeForward(openingEnd))/(dt*defaults.duration);
assert.ok(enterBefore>30&&enterAfter>30,'forward rush continues into the slowed whip without stopping');

const originalTiming=schedule({...defaults,duration:defaults.duration-.65,whipExtra:0}),extendedTiming=schedule(defaults);
for(let i=0;i<originalTiming.length;i++)assert.ok(Math.abs(extendedTiming[i].duration-originalTiming[i].duration-(i===1?.65:0))<1e-8,'only section two gains exactly 0.65 seconds');
console.log('Section two adds exactly 0.65 seconds; other phase durations preserved.');

const startSettle=pose(revisedCuts[2].start,defaults),endSettle=pose(revisedCuts[2].end,defaults);
const localOffset=p=>{const dx=p.camera.x-p.aircraft.x,dz=p.camera.z-p.aircraft.z;return {x:Math.cos(p.heading)*dx+Math.sin(p.heading)*dz,z:-Math.sin(p.heading)*dx+Math.cos(p.heading)*dz}};
const a=localOffset(startSettle),b=localOffset(endSettle);
assert.ok(Math.abs(b.x-a.x-defaults.settlePan)<1e-8,'section three pans right');
assert.ok(Math.abs(a.z-b.z-defaults.settleZoom)<1e-8,'section three pushes closer');
const oldTiming=schedule({...defaults,hold:.45,duration:7.65});
for(let i=0;i<oldTiming.length;i++)assert.ok(Math.abs(revisedCuts[i].duration-oldTiming[i].duration-(i===2?-.15:0))<1e-8,'only section three loses one third of its duration');
