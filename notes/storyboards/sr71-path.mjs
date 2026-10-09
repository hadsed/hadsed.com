// Pure camera blocking model. World +Y is up; the aircraft flies toward -Z.
export const beats = ['Closing approach','Nose reveal','Close exhaust orbit','Exhaust framing','Bank into climb','Light transition'];
export const defaults = {progress:0,height:28,hold:0.45,soft:0.6,duration:7,approachDuration:2,cameraRush:500,planeRush:280,fov:42,framing:0.48,distant:1800,nose:19,side:42,lead:0,sideHeight:12,rear:90,endGap:19,clearance:7,flightHeight:4,speed:65,climb:35,exhaustAim:0,orbitAngle:175,bank:40,turn:35,ease:1,fadeStart:91,fade:1,grid:1,clay:0};
export const ranges = {
 height:[8,100,1], fov:[20,85,1], framing:[-0.6,0.7,0.01], distant:[300,2600,10], nose:[16,160,1],
 approachDuration:[.5,5,.1],cameraRush:[50,1000,10],planeRush:[80,600,10],
 side:[25,100,1], lead:[-30,40,1], sideHeight:[8,60,1], rear:[35,200,1], endGap:[16,70,1], clearance:[4,30,1],
 exhaustAim:[-0.4,0.5,0.01], orbitAngle:[140,180,1], bank:[0,65,1], turn:[0,70,1], flightHeight:[2,25,1], speed:[20,150,1], climb:[0,180,1], hold:[0.1,3,0.05], soft:[0,1.5,0.05], duration:[6,30,0.25], ease:[0,1,0.05], fadeStart:[80,100,1], progress:[0,100,0.1], fade:[0,1,1], grid:[0,1,1], clay:[0,1,1]
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
 // Preserve at least 1.5s for the other four phases, even at extreme controls.
 const hold=Math.min(s.hold,s.duration-2), approach=Math.min(s.approachDuration,s.duration-hold-1.5);
 const weights=[0,2.75,1.5,0,1.8,1.2], sum=7.25;let time=0;
 return weights.map((w,i)=>{const duration=i===0?approach:i===3?hold:(s.duration-hold-approach)*w/sum;const start=time/s.duration;time+=duration;return {start,end:time/s.duration,duration}});
}
export function approachMotion(s){
 const seconds=schedule(s)[0].duration;
 const minimum=Math.max(s.nose+40,80);
 const requested=s.cameraRush+s.planeRush;
 const closing=Math.min(requested,(s.distant-minimum)/seconds);
 const factor=closing/requested;
 return {seconds,cameraSpeed:s.cameraRush*factor,planeSpeed:s.planeRush*factor,endGap:s.distant-closing*seconds,limited:factor<.999};
}
function flight(u,s,cuts,rush){
 const fastUntil=cuts[1].end*s.duration;
 const elapsed=u*s.duration,opening=Math.min(elapsed,fastUntil),after=Math.max(0,elapsed-fastUntil),blend=cuts[2].duration,v=Math.min(after,blend);
 const travel=rush.planeSpeed*opening+s.speed*after+(rush.planeSpeed-s.speed)*(v-v*v/(2*blend));
 const start=cuts[4].start, t=clamp((u-start)/(1-start)), seconds=(1-start)*s.duration;
 // Integrate the turning heading, so the bank turns the flight path rather than sliding the model sideways.
 const heading=s.turn*Math.PI/180*smooth(t),bank=s.bank*Math.PI/180*smooth(clamp(t*2));
 let dx=0,dz=0;
 const count=Math.ceil(t*240),dt=count?t*seconds/count:0;
 for(let n=0;n<count;n++){const h=s.turn*Math.PI/180*smooth((n+.5)*t/count);dx+=s.speed*Math.sin(h)*dt;dz+=s.speed*(1-Math.cos(h))*dt}
 return {aircraft:{x:dx,y:s.flightHeight+s.climb*t*t,z:-travel+dz},heading,bank,pitch:Math.atan2(2*s.climb*t/seconds,s.speed)};
}
// Cubic Hermite interpolation matches position AND velocity at phase boundaries.
function hermite(a,b,velocityA,velocityB,seconds,t){
 const t2=t*t,t3=t2*t;
 return (2*t3-3*t2+1)*a+(t3-2*t2+t)*seconds*velocityA+(-2*t3+3*t2)*b+(t3-t2)*seconds*velocityB;
}
function revealRate(s,cuts,rush){
 return Math.min((rush.endGap-s.nose)/cuts[1].duration,3*(s.distant-rush.endGap)/rush.seconds);
}
function desired(u,s,cuts,rush){
 const i=Math.max(0,cuts.findIndex((b,index)=>u<b.end-1e-10 || index===cuts.length-1));const b=cuts[i];const raw=clamp((u-b.start)/(b.end-b.start));
 const q=mix(raw,smooth(raw),s.ease),rate=revealRate(s,cuts,rush);
 let x=0,z=0,height=s.height;
 if(i===0)z=hermite(-s.distant,-rush.endGap,rush.cameraSpeed+rush.planeSpeed,rate,b.duration,raw);
 if(i===1){z=hermite(-rush.endGap,-s.nose,rate,rate,b.duration,raw);height=s.flightHeight+(s.height-s.flightHeight)*(-z)/rush.endGap}
 if(i>=2){
  // One uninterrupted orbit at the close reveal radius: no side retreat or rear gap excursion.
  const angle=s.orbitAngle*Math.PI/180*(i===2?q:1);
  x=-s.nose*Math.sin(angle);z=-s.nose*Math.cos(angle);
  height=s.flightHeight+s.clearance;
 }
 return {x,z,height,i};
}
export function pose(progress,s){
 const u=clamp(progress),cuts=schedule(s),rush=approachMotion(s),relative=desired(u,s,cuts,rush);
 const f=flight(u,s,cuts,rush),aircraft=f.aircraft;
 const c=Math.cos(f.heading),sn=Math.sin(f.heading);
 const camera={x:aircraft.x+c*relative.x-sn*relative.z,y:Math.max(aircraft.y+s.clearance,relative.height),z:aircraft.z+sn*relative.x+c*relative.z};
 const distance=Math.hypot(camera.x-aircraft.x,camera.y-aircraft.y,camera.z-aircraft.z);
 const orbitProgress=clamp((u-cuts[2].start)/(cuts[2].end-cuts[2].start));
 const focus=smooth(orbitProgress),tail=9.5*focus;
 const aim={x:aircraft.x-Math.sin(f.heading)*Math.cos(f.pitch)*tail,
  y:aircraft.y-Math.sin(f.pitch)*tail+distance*Math.tan(s.fov*Math.PI/360)*mix(s.framing,s.exhaustAim,focus),
  z:aircraft.z+Math.cos(f.heading)*Math.cos(f.pitch)*tail};
 const fade=s.fade?smooth((u-s.fadeStart/100)/Math.max(.001,1-s.fadeStart/100)):0;
 return {aircraft,camera,aim,pitch:f.pitch,heading:f.heading,bank:f.bank,beat:relative.i,time:u*s.duration,fade};
}
