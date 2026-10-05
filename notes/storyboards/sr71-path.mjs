// Pure camera blocking model. World +Y is up; the aircraft flies toward -Z.
export const beats = ['Distant approach', 'Nose grows', 'Side-track hold', 'Pitch into climb', 'Arc behind', 'Rear catch-up', 'Light transition'];
export const defaults = {progress:0,height:28,hold:2.5,soft:0.6,duration:8,fov:42,framing:0.48,distant:280,nose:48,side:42,lead:8,sideHeight:12,rear:90,endGap:19,clearance:7,flightHeight:4,speed:65,climb:90,ease:1,fadeStart:91,fade:1,grid:1,clay:0};
export const ranges = {
 height:[8,100,1], fov:[20,85,1], framing:[-0.6,0.7,0.01], distant:[100,600,5], nose:[28,160,1],
 side:[25,100,1], lead:[-30,40,1], sideHeight:[8,60,1], rear:[35,200,1], endGap:[16,70,1], clearance:[4,30,1],
 flightHeight:[2,25,1], speed:[20,150,1], climb:[0,180,1], hold:[0.5,6,0.1], soft:[0,1.5,0.05], duration:[8,30,0.5], ease:[0,1,0.05], fadeStart:[80,100,1], progress:[0,100,0.1], fade:[0,1,1], grid:[0,1,1], clay:[0,1,1]
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
 const weights=[2,1.5,0,1.5,1.4,1.4,1.2], sum=9;let time=0;
 return weights.map((w,i)=>{const duration=i===2?s.hold:(s.duration-s.hold)*w/sum;const start=time/s.duration;time+=duration;return {start,end:time/s.duration,duration}});
}
function flight(u,s,cuts){
 const t=clamp((u-cuts[3].start)/(1-cuts[3].start));
 // Quadratic climb: monotonically rising, increasing pitch, no lateral drift.
 return {x:0,y:s.flightHeight+s.climb*t*t,z:-s.speed*s.duration*u};
}
function desired(u,s,cuts){
 const i=Math.max(0,cuts.findIndex(b=>u<=b.end+1e-9));const b=cuts[i];const raw=clamp((u-b.start)/(b.end-b.start));const q=mix(raw,smooth(raw),s.ease);
 const x=[0,0,-s.side,-s.side,-s.side*0.75,0,0,0];
 const z=[-s.distant,-s.nose,-s.lead,-s.lead,s.rear,s.rear,s.endGap,s.endGap];
 const height=[s.height,s.height,s.sideHeight,s.sideHeight,s.sideHeight,s.clearance,s.clearance,s.clearance];
 return {x:mix(x[i],x[i+1],q),z:mix(z[i],z[i+1],q),height:mix(height[i],height[i+1],q),i};
}
export function pose(progress,s){
 const u=clamp(progress),cuts=schedule(s),target=desired(u,s,cuts);let relative=desired(0,s,cuts);
 // Fixed-time integration makes scrolling backwards identical to playing forwards.
 const samples=Math.ceil(u*360), dt=s.duration/360;
 for(let n=1;n<=samples;n++){
  const at=Math.min(u,n/360),next=desired(at,s,cuts);
  const step=n===samples?(u-(n-1)/360)*s.duration:dt;
  const alpha=s.soft===0?1:1-Math.exp(-step/s.soft);
  for(const key of ['x','z','height']) relative[key]=mix(relative[key],next[key],alpha);
 }
 const aircraft=flight(u,s,cuts);
 const following=u>=cuts[4].start?smooth((u-cuts[4].start)/(cuts[4].end-cuts[4].start)):0;
 const camera={x:relative.x,y:Math.max(aircraft.y+s.clearance,mix(relative.height,aircraft.y+relative.height,following)),z:aircraft.z+relative.z};
 const t=clamp((u-cuts[3].start)/(1-cuts[3].start));
 const rise=2*s.climb*t/((1-cuts[3].start)*s.duration);
 const pitch=Math.atan2(rise,s.speed);
 const distance=Math.hypot(camera.x-aircraft.x,camera.y-aircraft.y,camera.z-aircraft.z);
 const aim={...aircraft,y:aircraft.y+distance*Math.tan(s.fov*Math.PI/360)*s.framing};
 const fade=s.fade?smooth((u-s.fadeStart/100)/Math.max(.001,1-s.fadeStart/100)):0;
 return {aircraft,camera,aim,pitch,beat:target.i,time:u*s.duration,fade};
}
