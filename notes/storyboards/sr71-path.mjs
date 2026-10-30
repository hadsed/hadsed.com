// Pure camera blocking model. World +Y is up; the aircraft flies toward -Z.
export const beats = ['Closing approach','Side-hugging whip','Nose-locked climb'];
export const defaults = {progress:0,height:42,soft:0.6,duration:7.876,climbExtra:1.128,settlePan:2.6,settleZoom:0.3,settleAim:0.025,whipExtra:0.95,approachDuration:3.73,cameraRush:500,planeRush:280,fov:56,framing:-0.12,distant:1800,nose:19,side:42,lead:0,sideHeight:12,rear:90,endGap:19,clearance:4,flightHeight:4,speed:65,climb:35,exhaustHeight:0.6,bankLead:1,exhaustAim:0.06,orbitAngle:172,bank:50,bankRamp:0.85,hug:9,pushStart:0.65,pushGap:17,turn:35,ease:1,fadeStart:91,fade:0,grid:1,clay:0};
export const ranges = {
 height:[8,100,1], fov:[20,85,1], framing:[-0.6,0.7,0.01], distant:[300,2600,10], nose:[16,160,1],
 climbExtra:[0,3,.001], approachDuration:[.5,5,.01],cameraRush:[50,1000,10],planeRush:[80,600,10],
 side:[25,100,1], lead:[-30,40,1], sideHeight:[8,60,1], rear:[35,200,1], endGap:[16,70,1], clearance:[4,30,1],
 settlePan:[0,6,.1], settleZoom:[0,3,.1], settleAim:[-.2,.2,.005], whipExtra:[0,2,.05], hug:[8,16,.1], bankRamp:[.2,2,.05], pushStart:[.5,.8,.05], pushGap:[14,19,.1], exhaustHeight:[0,6,0.1], bankLead:[0,2,0.1], exhaustAim:[-0.4,0.5,0.01], orbitAngle:[140,180,1], bank:[0,65,1], turn:[0,70,1], flightHeight:[2,25,1], speed:[20,150,1], climb:[0,180,1],  soft:[0,1.5,0.05], duration:[6,30,0.05], ease:[0,1,0.05], fadeStart:[80,100,1], progress:[0,100,0.1], fade:[0,1,1], grid:[0,1,1], clay:[0,1,1]
};
export const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
export function cleanSettings(input){
 const source=input.settings || input; const result={...defaults};
 for(const [key,[min,max]] of Object.entries(ranges)) if(typeof source[key]==='number' && Number.isFinite(source[key])) result[key]=clamp(source[key],min,max);
 return result;
}
// Migrate saved shots once: merge the old settle, then trim the old fourth section.
export function migrateSettings(input){
 const source=input.settings||input;
 if(input.version>=12)return cleanSettings(source);
 if(input.version>=11){const old=cleanSettings({...source,climbExtra:0}),extra=+schedule(old)[2].duration.toFixed(6);return cleanSettings({...old,climbExtra:extra,duration:old.duration+extra})}
 const merged=cleanSettings(input.version>=10?source:{...source,whipExtra:(source.whipExtra??.65)+(source.hold??.3)});
 const extra=Math.min(merged.whipExtra,merged.duration-2),approach=Math.min(merged.approachDuration,merged.duration-extra-1.5);
 const trimmed={...merged,climbExtra:0,duration:merged.duration-(merged.duration-approach-extra)*1.2/4.5};
 return migrateSettings({version:11,settings:trimmed});
}
export function schedule(s){
 const added=Math.min(s.climbExtra||0,Math.max(0,s.duration-6));
 if(added){const base=schedule({...s,duration:s.duration-added,climbExtra:0});let time=0;return base.map((b,i)=>{const duration=b.duration+(i===2?added:0),start=time/s.duration;time+=duration;return {start,end:time/s.duration,duration}})}
 const extra=Math.min(s.whipExtra,s.duration-2), approach=Math.min(s.approachDuration,s.duration-extra-1.1);
 const remaining=s.duration-approach-extra;let time=0;
 return [0,5,6].map((w,i)=>{const duration=i===0?approach:remaining*w/11+(i===1?extra:0);const start=time/s.duration;time+=duration;return {start,end:time/s.duration,duration}});
}
// Keep the surviving climb's speed and trajectory; do not squeeze the deleted tail into it.
const departureEnd=(s,cuts)=>1+cuts[2].duration*(2/3)/s.duration;
// One overlapping rear acquisition: position, eye height, and aim finish together.
const acquisition=(u,cuts)=>smooth(clamp(((u-cuts[1].start)/(cuts[1].end-cuts[1].start)-.55)/.45));
export function approachMotion(s){
 const seconds=schedule(s)[0].duration;
 const requested=s.cameraRush+s.planeRush;
 // Rush controls the initial tangent; close distance is an exact endpoint.
 const closing=Math.min(requested,3*(s.distant-s.nose)/seconds);
 const factor=closing/requested;
 return {seconds,cameraSpeed:s.cameraRush*factor,planeSpeed:s.planeRush*factor,endGap:s.nose,limited:factor<.999};
}
function flight(u,s,cuts,rush){
 const fastUntil=cuts[0].end*s.duration;
 const elapsed=u*s.duration,opening=Math.min(elapsed,fastUntil),after=Math.max(0,elapsed-fastUntil),blend=cuts[1].duration,v=Math.min(after,blend);
 const travel=rush.planeSpeed*opening+s.speed*after+(rush.planeSpeed-s.speed)*(v-v*v/(2*blend));
 const start=cuts[2].start,end=departureEnd(s,cuts), t=clamp((u-start)/(end-start)), seconds=(end-start)*s.duration;
 // Integrate the turning heading, so the bank turns the flight path rather than sliding the model sideways.
 const bankStart=cuts[1].start,bankSeconds=(end-bankStart)*s.duration;
 const bankT=clamp((u-bankStart)/(end-bankStart));
 const heading=s.turn*Math.PI/180*smooth(bankT),bank=s.bank*Math.PI/180*smooth(clamp((u-bankStart)*s.duration/s.bankRamp));
 let dx=0,dz=0;
 const count=240,dt=bankT*bankSeconds/count;
 for(let n=0;n<count;n++){const h=s.turn*Math.PI/180*smooth((n+.5)*bankT/count);dx+=s.speed*Math.sin(h)*dt;dz+=s.speed*(1-Math.cos(h))*dt}
 return {aircraft:{x:dx,y:s.flightHeight+s.climb*t*t*t,z:-travel+dz},heading,bank,pitch:Math.atan2(3*s.climb*t*t/seconds,s.speed)};
}
// Cubic Hermite interpolation matches position AND velocity at phase boundaries.
function hermite(a,b,velocityA,velocityB,seconds,t){
 const t2=t*t,t3=t2*t;
 return (2*t3-3*t2+1)*a+(t3-2*t2+t)*seconds*velocityA+(-2*t3+3*t2)*b+(t3-t2)*seconds*velocityB;
}
function desired(u,s,cuts,rush){
 const i=Math.max(0,cuts.findIndex((b,index)=>u<b.end-1e-10 || index===cuts.length-1));const b=cuts[i];const raw=clamp((u-b.start)/(b.end-b.start));
 const q=mix(raw,smooth(raw),s.ease);
 let x=0,z=0,height=s.height;
 if(i===0){
  z=hermite(-s.distant,-s.nose,rush.cameraSpeed+rush.planeSpeed,Math.min(80,(s.distant-s.nose)/b.duration),b.duration,raw);
  height=mix(s.height,s.flightHeight+s.clearance,q);
 }
 if(i>=1){
  // Fast elliptical pass along the wing, settling into the saved rear angle.
  const whip=i===1?1-(1-raw)**2:1;
  const angle=s.orbitAngle*Math.PI/180*whip;
  // Elliptical pass hugs the wing instead of tracing a circle around the fuselage.
  x=-(i===1?Math.min(s.hug,s.nose):s.nose)*Math.sin(angle);z=-s.nose*Math.cos(angle);
  if(i===1){
   const entrySpeed=Math.min(80,(s.distant-s.nose)/cuts[0].duration);
   z+=entrySpeed*(b.duration-Math.min(s.whipExtra,s.duration-2))*raw*(1-raw)**6;
   // Match the terminal rear offset while retaining tight wing clearance mid-pass.
   x=mix(x,-s.nose*Math.sin(angle),smooth(clamp((raw-.65)/.35)));
  }
  const settling=acquisition(u,cuts);
  x+=s.settlePan*settling;z-=s.settleZoom*settling;
  const pushAt=cuts[2].start+s.pushStart*(cuts[2].end-cuts[2].start);
  const push=smooth(clamp((u-pushAt)/(departureEnd(s,cuts)-pushAt)));
  const rearRadius=Math.hypot(x,z);
  const factor=mix(1,Math.min(s.pushGap,rearRadius)/rearRadius,push);x*=factor;z*=factor;
  height=s.flightHeight+s.clearance;
 }
 return {x,z,height,i};
}
function basePose(progress,s){
 const u=clamp(progress),cuts=schedule(s),rush=approachMotion(s),relative=desired(u,s,cuts,rush);
 const f=flight(u,s,cuts,rush),aircraft=f.aircraft;
 const c=Math.cos(f.heading),sn=Math.sin(f.heading);
 const orbitProgress=clamp((u-cuts[1].start)/(cuts[1].end-cuts[1].start));
 // Lower only late in the orbit, then track nozzle height rather than fuselage height.
 const eyeBlend=acquisition(u,cuts);
 const nozzleY=aircraft.y-9.5*Math.sin(f.pitch);
 const camera={x:aircraft.x+c*relative.x-sn*relative.z,
  y:Math.max(.2,mix(Math.max(aircraft.y+s.clearance,relative.height),nozzleY+s.exhaustHeight,eyeBlend)),
  z:aircraft.z+sn*relative.x+c*relative.z};
 const distance=Math.hypot(camera.x-aircraft.x,camera.y-aircraft.y,camera.z-aircraft.z);
 const focus=smooth(orbitProgress),tail=9.5*focus;
 const settle=acquisition(u,cuts);
 const rearAim=mix(s.exhaustAim,s.settleAim,settle);
 let aim={x:aircraft.x-Math.sin(f.heading)*Math.cos(f.pitch)*tail,
  y:aircraft.y-Math.sin(f.pitch)*tail+distance*Math.tan(s.fov*Math.PI/360)*mix(s.framing,rearAim,focus),
  z:aircraft.z+Math.cos(f.heading)*Math.cos(f.pitch)*tail};
 // Acquire the physical nose tip at the end of the whip, then keep it on the optical axis.
 const noseLock=smooth(clamp((orbitProgress-.8)/.2));
 const nose={x:aircraft.x+sn*Math.cos(f.pitch)*13.5,y:aircraft.y+Math.sin(f.pitch)*13.5,z:aircraft.z-c*Math.cos(f.pitch)*13.5};
 aim={x:mix(aim.x,nose.x,noseLock),y:mix(aim.y,nose.y,noseLock),z:mix(aim.z,nose.z,noseLock)};
 const climbProgress=clamp((u-cuts[2].start)/(cuts[2].end-cuts[2].start));
 const roll=f.bank*smooth(climbProgress);
 const up={x:c*Math.sin(roll),y:Math.cos(roll),z:sn*Math.sin(roll)};
 const fade=s.fade?smooth((u-s.fadeStart/100)/Math.max(.001,1-s.fadeStart/100)):0;
 return {aircraft,camera,aim,up,roll,pitch:f.pitch,heading:f.heading,bank:f.bank,beat:relative.i,time:u*s.duration,fade};
}

// Stretch only the third section; ease out of the original speed into the slower move.
export function pose(progress,s){
 const cuts=schedule(s),added=Math.min(s.climbExtra||0,Math.max(0,s.duration-6));
 if(!added)return basePose(progress,s);
 const base={...s,duration:s.duration-added,climbExtra:0},time=clamp(progress)*s.duration,start=cuts[2].start*s.duration;
 let sourceTime=time;
 if(time>start){const t=clamp((time-start)/cuts[2].duration),baseSeconds=cuts[2].duration-added;const tangent=Math.min(3,cuts[2].duration/baseSeconds);sourceTime=start+baseSeconds*hermite(0,1,tangent,0,1,t)}
 return {...basePose(sourceTime/base.duration,base),time};
}
