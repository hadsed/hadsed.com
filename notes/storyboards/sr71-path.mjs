// Pure camera blocking model. World +Y is up; the aircraft flies toward -Z.
export const beats = ['Closing approach','Nose reveal','Over to side','Side-track hold','Pitch into climb','Arc behind','Rear catch-up','Light transition'];
export const defaults = {progress:0,height:28,hold:1.25,soft:0.6,duration:8.75,approachDuration:2,cameraRush:500,planeRush:280,fov:42,framing:0.48,distant:1800,nose:28,side:42,lead:0,sideHeight:12,rear:90,endGap:19,clearance:7,flightHeight:4,speed:65,climb:90,ease:1,fadeStart:91,fade:1,grid:1,clay:0};
export const ranges = {
 height:[8,100,1], fov:[20,85,1], framing:[-0.6,0.7,0.01], distant:[300,2600,10], nose:[16,160,1],
 approachDuration:[.5,5,.1],cameraRush:[50,1000,10],planeRush:[80,600,10],
 side:[25,100,1], lead:[-30,40,1], sideHeight:[8,60,1], rear:[35,200,1], endGap:[16,70,1], clearance:[4,30,1],
 flightHeight:[2,25,1], speed:[20,150,1], climb:[0,180,1], hold:[0.5,6,0.05], soft:[0,1.5,0.05], duration:[8,30,0.25], ease:[0,1,0.05], fadeStart:[80,100,1], progress:[0,100,0.1], fade:[0,1,1], grid:[0,1,1], clay:[0,1,1]
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
 // Preserve at least 1.5s for the other six phases, even at extreme controls.
 const hold=Math.min(s.hold,s.duration-2), approach=Math.min(s.approachDuration,s.duration-hold-1.5);
 const weights=[0,2.75,.75,0,1.5,1.4,1.4,1.2], sum=9;let time=0;
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
 const t=clamp((u-cuts[4].start)/(1-cuts[4].start));
 return {x:0,y:s.flightHeight+s.climb*t*t,z:-travel};
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
 const x=[0,0,0,-s.side,-s.side,-s.side*0.75,0,0,0];
 const z=[-s.distant,-rush.endGap,-s.nose,-s.lead,-s.lead,s.rear,s.rear,s.endGap,s.endGap];
 const noseHeight=Math.max(s.flightHeight+s.clearance,s.flightHeight+(s.height-s.flightHeight)*s.nose/rush.endGap);
 const height=[s.height,s.height,noseHeight,s.sideHeight,s.sideHeight,s.sideHeight,s.clearance,s.clearance,s.clearance];
 let forward=mix(z[i],z[i+1],q);
 if(i===0)forward=hermite(z[0],z[1],rush.cameraSpeed+rush.planeSpeed,rate,b.duration,raw);
 if(i===1)forward=hermite(z[1],z[2],rate,rate,b.duration,raw);
 if(i===2){
  const delta=z[3]-z[2];
  const startVelocity=Math.sign(delta)*Math.min(rate,3*Math.abs(delta)/b.duration);
  forward=hermite(z[2],z[3],startVelocity,0,b.duration,raw);
 }
 const cameraHeight=i===1?s.flightHeight+(s.height-s.flightHeight)*(-forward)/rush.endGap:mix(height[i],height[i+1],q);
 return {x:mix(x[i],x[i+1],q),z:forward,height:cameraHeight,i};
}
export function pose(progress,s){
 const u=clamp(progress),cuts=schedule(s),rush=approachMotion(s),target=desired(u,s,cuts,rush);let relative=desired(0,s,cuts,rush);
 const samples=Math.ceil(u*360), dt=s.duration/360;
 for(let n=1;n<=samples;n++){
  const at=Math.min(u,n/360),next=desired(at,s,cuts,rush);
  const step=n===samples?(u-(n-1)/360)*s.duration:dt;
  const alpha=at<=cuts[3].end||s.soft===0?1:1-Math.exp(-step/s.soft);
  for(const key of ['x','z','height']) relative[key]=mix(relative[key],next[key],alpha);
 }
 const aircraft=flight(u,s,cuts,rush);
 const following=u>=cuts[5].start?smooth((u-cuts[5].start)/(cuts[5].end-cuts[5].start)):0;
 const camera={x:relative.x,y:Math.max(aircraft.y+s.clearance,mix(relative.height,aircraft.y+relative.height,following)),z:aircraft.z+relative.z};
 const t=clamp((u-cuts[4].start)/(1-cuts[4].start));
 const rise=2*s.climb*t/((1-cuts[4].start)*s.duration);
 const pitch=Math.atan2(rise,s.speed);
 const distance=Math.hypot(camera.x-aircraft.x,camera.y-aircraft.y,camera.z-aircraft.z);
 const aim={...aircraft,y:aircraft.y+distance*Math.tan(s.fov*Math.PI/360)*s.framing};
 const fade=s.fade?smooth((u-s.fadeStart/100)/Math.max(.001,1-s.fadeStart/100)):0;
 return {aircraft,camera,aim,pitch,beat:target.i,time:u*s.duration,fade};
}
