// Pure camera blocking model. World +Y is up; the aircraft flies toward -Z.
export const beats = ['Closing approach','Side-hugging whip','Exhaust settle','Climb & exhaust follow','Exhaust ending'];
export const defaults = {progress:0,height:42,hold:0.45,soft:0.6,duration:7.65,whipExtra:0.65,approachDuration:3.73,cameraRush:500,planeRush:280,fov:56,framing:-0.12,distant:1800,nose:19,side:42,lead:0,sideHeight:12,rear:90,endGap:19,clearance:4,flightHeight:4,speed:65,climb:35,exhaustHeight:0.6,bankLead:1,exhaustAim:0.06,orbitAngle:172,bank:50,bankRamp:0.85,hug:9,pushStart:0.65,pushGap:17,turn:35,ease:1,fadeStart:91,fade:0,grid:1,clay:0};
export const ranges = {
 height:[8,100,1], fov:[20,85,1], framing:[-0.6,0.7,0.01], distant:[300,2600,10], nose:[16,160,1],
 approachDuration:[.5,5,.01],cameraRush:[50,1000,10],planeRush:[80,600,10],
 side:[25,100,1], lead:[-30,40,1], sideHeight:[8,60,1], rear:[35,200,1], endGap:[16,70,1], clearance:[4,30,1],
 whipExtra:[0,2,.05], hug:[8,16,.1], bankRamp:[.2,2,.05], pushStart:[.5,.8,.05], pushGap:[14,19,.1], exhaustHeight:[0,6,0.1], bankLead:[0,2,0.1], exhaustAim:[-0.4,0.5,0.01], orbitAngle:[140,180,1], bank:[0,65,1], turn:[0,70,1], flightHeight:[2,25,1], speed:[20,150,1], climb:[0,180,1], hold:[0.1,3,0.05], soft:[0,1.5,0.05], duration:[6,30,0.05], ease:[0,1,0.05], fadeStart:[80,100,1], progress:[0,100,0.1], fade:[0,1,1], grid:[0,1,1], clay:[0,1,1]
};
export const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
export function cleanSettings(input){
 const source=input.settings || input; const result={...defaults};
 for(const [key,[min,max]] of Object.entries(ranges)) if(typeof source[key]==='number' && Number.isFinite(source[key])) result[key]=clamp(source[key],min,max);
 return result;
}
export function schedule(s){
 // Preserve at least 1.5s for the other three phases, even at extreme controls.
 const hold=Math.min(s.hold,s.duration-2), extra=Math.min(s.whipExtra,s.duration-hold-2), approach=Math.min(s.approachDuration,s.duration-hold-extra-1.5);
 const weights=[0,1.5,0,1.8,1.2], sum=4.5;let time=0;
 return weights.map((w,i)=>{const duration=i===0?approach:i===2?hold:(s.duration-hold-approach-extra)*w/sum+(i===1?extra:0);const start=time/s.duration;time+=duration;return {start,end:time/s.duration,duration}});
}
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
 const start=cuts[3].start, t=clamp((u-start)/(1-start)), seconds=(1-start)*s.duration;
 // Integrate the turning heading, so the bank turns the flight path rather than sliding the model sideways.
 const bankStart=cuts[1].start,bankSeconds=(1-bankStart)*s.duration;
 const bankT=clamp((u-bankStart)/(1-bankStart));
 const heading=s.turn*Math.PI/180*smooth(bankT),bank=s.bank*Math.PI/180*smooth(clamp((u-bankStart)*s.duration/s.bankRamp));
 let dx=0,dz=0;
 const count=Math.ceil(bankT*240),dt=count?bankT*bankSeconds/count:0;
 for(let n=0;n<count;n++){const h=s.turn*Math.PI/180*smooth((n+.5)*bankT/count);dx+=s.speed*Math.sin(h)*dt;dz+=s.speed*(1-Math.cos(h))*dt}
 return {aircraft:{x:dx,y:s.flightHeight+s.climb*t*t,z:-travel+dz},heading,bank,pitch:Math.atan2(2*s.climb*t/seconds,s.speed)};
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
   z+=entrySpeed*(b.duration-Math.min(s.whipExtra,s.duration-s.hold-2))*raw*(1-raw)**6;
   // Match the terminal rear offset while retaining tight wing clearance mid-pass.
   x=mix(x,-s.nose*Math.sin(angle),smooth(clamp((raw-.65)/.35)));
  }
  const pushAt=cuts[3].start+s.pushStart*(cuts[3].end-cuts[3].start);
  const push=smooth(clamp((u-pushAt)/(1-pushAt)));
  const factor=mix(1,Math.min(s.pushGap,s.nose)/s.nose,push);x*=factor;z*=factor;
  height=s.flightHeight+s.clearance;
 }
 return {x,z,height,i};
}
export function pose(progress,s){
 const u=clamp(progress),cuts=schedule(s),rush=approachMotion(s),relative=desired(u,s,cuts,rush);
 const f=flight(u,s,cuts,rush),aircraft=f.aircraft;
 const c=Math.cos(f.heading),sn=Math.sin(f.heading);
 const orbitProgress=clamp((u-cuts[1].start)/(cuts[1].end-cuts[1].start));
 // Lower only late in the orbit, then track nozzle height rather than fuselage height.
 const eyeBlend=smooth(clamp((orbitProgress-.65)/.35));
 const nozzleY=aircraft.y-9.5*Math.sin(f.pitch);
 const camera={x:aircraft.x+c*relative.x-sn*relative.z,
  y:Math.max(.2,mix(Math.max(aircraft.y+s.clearance,relative.height),nozzleY+s.exhaustHeight,eyeBlend)),
  z:aircraft.z+sn*relative.x+c*relative.z};
 const distance=Math.hypot(camera.x-aircraft.x,camera.y-aircraft.y,camera.z-aircraft.z);
 const focus=smooth(orbitProgress),tail=9.5*focus;
 const aim={x:aircraft.x-Math.sin(f.heading)*Math.cos(f.pitch)*tail,
  y:aircraft.y-Math.sin(f.pitch)*tail+distance*Math.tan(s.fov*Math.PI/360)*mix(s.framing,s.exhaustAim,focus),
  z:aircraft.z+Math.cos(f.heading)*Math.cos(f.pitch)*tail};
 const fade=s.fade?smooth((u-s.fadeStart/100)/Math.max(.001,1-s.fadeStart/100)):0;
 return {aircraft,camera,aim,pitch:f.pitch,heading:f.heading,bank:f.bank,beat:relative.i,time:u*s.duration,fade};
}
