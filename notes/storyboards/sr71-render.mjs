import {cleanSettings,pose,schedule,beats} from './sr71-path.mjs?v=10';
export function renderBrief(settings,options){
 const phases=schedule(settings).map((b,i)=>`${(b.start*settings.duration).toFixed(2)}–${(b.end*settings.duration).toFixed(2)}s: ${beats[i]}`).join('\n');
 return `SR-71 / render handoff\n\n${options.route==='3d'?'3D render: preserve the exported camera and aircraft motion.':'AI exploration: use the motion reference for blocking; validate geometry and motion against the blockout.'}\n${settings.duration.toFixed(2)} seconds · ${options.width} × ${options.height} · ${options.fps} fps · silent\n\nVISUAL DIRECTION\n${options.look}\n\nSHOT\n${phases}\nBegin with a tiny aircraft beneath a vast storm sky. Close head-on, pass above and tight along the wing while the aircraft banks right, then finish the same sweep near the paired exhausts at eye level. Follow the climb and push toward the jets. Keep flight nose-forward. No cuts.\n\nREFERENCES\nOriginal poster: notes/inspo/sr71-metal-print-reference.png (atmosphere, not screenshot border).\nTwilight studies: notes/storyboards/stills/04-distant-elevated-twilight.png and 06-side-twilight.png.\nUse captured blockout frames for composition only, not aircraft geometry or material.\n\nNEXT\n${options.route==='3d'?'Import motion samples into Blender, convert world coordinates, bake transforms, replace proxy geometry, and approve one styled frame before rendering the draft.':'Prepare approved first/last stills and a blockout video reference. Review the prompt, reference roles, price, and duration before submitting a generation.'}\n`;
}
export function motionPackage(settings,options){
 const s=cleanSettings(settings),fps=[24,30,60].includes(+options.fps)?+options.fps:30;
 const output={...options,fps};const intervals=Math.ceil(s.duration*fps);
 return {kind:'sr71-render-handoff',version:1,shotVersion:10,units:'relative-not-meters',
  coordinates:{world:'right-handed; +Y up; aircraft local forward -Z',camera:'position + look-at target; world up (0,1,0); vertical fov in degrees',aircraft:'Euler YXZ: (pitch, -heading, -bank) in radians',blender:'Convert each vector (x,y,z) to (x,-z,y); transform orientations consistently. Proxy model is not included.'},
  output:{width:output.width,height:output.height,fps,duration:s.duration,aspect:16/9,audio:false},settings:s,route:output.route,brief:renderBrief(s,output),
  phases:schedule(s).map((b,i)=>({name:beats[i],start:b.start*s.duration,end:b.end*s.duration})),
  samples:Array.from({length:intervals+1},(_,frame)=>{const time=Math.min(frame/fps,s.duration);return {frame,time,...pose(time/s.duration,s),verticalFov:s.fov}})};
}
