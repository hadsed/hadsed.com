import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {defaults,ranges,cleanSettings,pose,schedule,beats,clamp,approachMotion} from './sr71-path.mjs';
const $=id=>document.getElementById(id);
const descriptions=[
 'Barely visible at the far end of the sky. Camera rushes toward the aircraft while it races toward us; the closing move brakes into the reveal.',
 'The aircraft becomes readable as the last front-on distance closes. Keep the elevated viewpoint and sky-heavy framing.',
 'The nose grows. Move above the upper fuselage and ease out to the side; never pass under the aircraft.',
 'Match the aircraft’s forward speed in an elevated three-quarter profile. Hold this composition while the water travels underneath.',
 'The flight path curves upward and the nose follows that path. The camera falls behind in forward distance.',
 'Arc from the side to the rear while staying above the aircraft. Camera translation and camera aim are separate.',
 'Close the rear gap. The paired exhausts grow as the camera gains on the climbing aircraft.',
 'A palette-matched light overlay takes over. Disable it in the sidebar to inspect the final camera position.'
];
let settings={...defaults},progress=0,playing=false,sceneView=false,lastTime=0,captures=[];
try{const current=JSON.parse(localStorage.getItem('sr71-directing-3d-v2'));const previous=JSON.parse(localStorage.getItem('sr71-directing-3d-v1'));if(current){settings=cleanSettings(current);progress=settings.progress/100}else if(previous){settings=cleanSettings({...previous,distant:defaults.distant,duration:previous.duration+defaults.approachDuration});progress=0}}catch{}
const phaseFields=[
 ['distant','approachDuration','cameraRush','planeRush','height','framing','fov','ease'],
 ['nose','height','framing','fov','soft','ease'],
 ['side','lead','sideHeight','clearance','framing','fov','soft','ease'],
 ['hold','side','lead','sideHeight','framing','fov','speed','soft'],
 ['climb','speed','sideHeight','clearance','framing','fov','soft','ease'],
 ['rear','clearance','framing','fov','soft','ease'],
 ['endGap','clearance','framing','fov','soft','ease'],
 ['fade','fadeStart','endGap','framing','fov']
];
const fieldInfo={
 distant:['Starting distance','Almost invisible at 1,800 units; increase for a smaller speck.'],
 approachDuration:['Approach duration','Seconds for the opening rush.'],
 cameraRush:['Camera rush speed','Average forward rush before braking; relative units/s.'],
 planeRush:['Aircraft approach speed','Nose-forward speed during the opening; relative units/s.'],
 height:['Camera height','Altitude above water for the head-on phases.'],
 fov:['Lens / field of view','Degrees; lower values give a longer lens.'],
 framing:['Vertical aim bias','Positive places the aircraft lower in frame.'],
 nose:['Nose reveal gap','Front distance before the overhead move.'],
 side:['Side separation','Lateral distance at the side hold.'],
 lead:['Side forward lead','Positive = ahead; negative = behind.'],
 sideHeight:['Side camera height','Altitude before climbing; minimum clearance takes priority.'],
 rear:['Rear acquisition gap','Behind the aircraft before catch-up.'],
 endGap:['Final rear gap','Behind the aircraft at the light transition.'],
 clearance:['Minimum height above plane','Keeps the camera above the aircraft.'],
 flightHeight:['Low flight altitude','Relative units above the water.'],
 speed:['Tracking flight speed','Nose-forward speed after the opening.'],
 climb:['Climb gain','Altitude gained after the side hold.'],
 duration:['Clip duration','Seconds including the new approach.'],
 hold:['Side-track hold','Seconds; other phases share the remaining time.'],
 soft:['Tracking softness','Seconds of lag after the opening; zero follows exactly.'],
 ease:['Motion easing','Opening: brake the closing rush. Other phases: smooth start/stop.'],
 grid:['Water grid','Depth and speed cues.'],clay:['Neutral clay view','Geometry without twilight styling.'],
 fade:['Light transition','Palette overlay; not a physical exhaust simulation.'],fadeStart:['Light begins at','Percentage of the full clip.']
};
const inputs=new Map(),controlNodes=new Map();let activePhase=-1;
for(const [key,[label,hint]] of Object.entries(fieldInfo)){
 const node=document.createElement('label');const [min,max,step]=ranges[key];
 if(['grid','clay','fade'].includes(key)){
  node.className='toggle';const input=document.createElement('input');input.type='checkbox';input.id=key;input.checked=!!settings[key];node.append(input,document.createTextNode(label));inputs.set(key,[input]);input.onchange=()=>{settings[key]=+input.checked;configurationChanged()};
 }else{
  node.className='control';const top=document.createElement('span');top.className='control-top';const text=document.createElement('span');text.textContent=label;top.append(text);
  const number=document.createElement('input');number.type='number';number.min=min;number.max=max;number.step=step;number.value=settings[key];number.setAttribute('aria-label',label+' value');top.append(number);
  const slider=document.createElement('input');slider.type='range';slider.id=key;slider.min=min;slider.max=max;slider.step=step;slider.value=settings[key];slider.setAttribute('aria-label',label);
  const small=document.createElement('small');small.textContent=hint;node.append(top,slider,small);inputs.set(key,[slider,number]);
  for(const input of [slider,number])input.oninput=()=>{if(input.value===''||!Number.isFinite(+input.value))return;settings[key]=clamp(+input.value,min,max);for(const other of [slider,number])if(other!==input)other.value=settings[key];configurationChanged()};
 }
 controlNodes.set(key,node);
 if(['duration','flightHeight','grid','clay'].includes(key))$('global-controls').append(node);
 else $('controls').append(node);
}
function phaseControls(index,cuts){
 if(activePhase!==index){activePhase=index;const keys=phaseFields[index];
  for(const [key,node] of controlNodes)if(!['duration','flightHeight','grid','clay'].includes(key))node.hidden=!keys.includes(key);
  // Reorder only when changing phases, so dragging a control keeps focus.
  for(const key of keys)$('controls').append(controlNodes.get(key));
  $('controls').closest('aside').scrollTop=0;
 }
 $('phase-controls-title').textContent=`${index+1} · ${beats[index]}`;
 $('phase-controls-time').textContent=`${(cuts[index].start*settings.duration).toFixed(2)}–${(cuts[index].end*settings.duration).toFixed(2)}s · current phase`;
}
function annotateTimeline(cuts){
 $('beats').style.gridTemplateColumns=cuts.map(b=>`${b.duration}fr`).join(' ');
 [...$('beats').children].forEach((button,i)=>{
  const start=(cuts[i].start*settings.duration).toFixed(2),end=(cuts[i].end*settings.duration).toFixed(2);
  button.title=`${beats[i]} · ${start}–${end}s`;button.setAttribute('aria-label',button.title);
  button.querySelector('small').textContent=`${start}–${end}s`;
 });
}
function syncControls(){for(const [key,list] of inputs)for(const input of list){if(input.type==='checkbox')input.checked=!!settings[key];else input.value=settings[key]}}
function persist(){settings.progress=progress*100;try{localStorage.setItem('sr71-directing-3d-v2',JSON.stringify(settings))}catch{}}
function configurationChanged(){persist();annotateTimeline(schedule(settings));rebuildPaths();render()}
function setProgress(value){progress=clamp(value);$('progress').value=(progress*100).toFixed(1);persist();render()}
function stop(){playing=false;$('play').textContent='Play'}
const scene=new THREE.Scene();
const renderer=new THREE.WebGLRenderer({canvas:$('canvas'),antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
const shotCamera=new THREE.PerspectiveCamera(settings.fov,16/9,.1,6000);
const overviewCamera=new THREE.PerspectiveCamera(48,16/9,.1,6000);
overviewCamera.position.set(200,150,220);
const orbit=new OrbitControls(overviewCamera,$('canvas'));orbit.enabled=false;orbit.enableDamping=true;
scene.add(new THREE.HemisphereLight(0xbfc5ff,0x24243f,2.7));
const keyLight=new THREE.DirectionalLight(0xd9def9,3);keyLight.position.set(-70,100,-100);scene.add(keyLight);
const rim=new THREE.DirectionalLight(0xe4a08b,1.7);rim.position.set(80,12,60);scene.add(rim);
// An original low-poly proxy: elongated chines, delta wing, two nacelles and canted tails.
// This is not a downloaded or flight-accurate model.
const plane=new THREE.Group();scene.add(plane);
const bodyMaterial=new THREE.MeshStandardMaterial({color:0x1c2030,roughness:.8,metalness:.35});
const glass=new THREE.MeshStandardMaterial({color:0x6c799c,roughness:.3,metalness:.6});
const exhaustMaterial=new THREE.MeshBasicMaterial({color:0xd7e8ff});
function mesh(geometry,material=bodyMaterial){const m=new THREE.Mesh(geometry,material);plane.add(m);return m}
// Ellipsoid fuselage with a long nose taper; local forward is -Z.
const body=mesh(new THREE.SphereGeometry(1,20,12));body.scale.set(1.25,.7,10.5);
const nose=mesh(new THREE.ConeGeometry(1.23,7,16));nose.rotation.x=-Math.PI/2;nose.position.z=-10;
const chineShape=new THREE.Shape();chineShape.moveTo(0,-14);chineShape.lineTo(1.9,-6);chineShape.lineTo(7.3,7);chineShape.lineTo(3,9);chineShape.lineTo(0,9);chineShape.lineTo(-3,9);chineShape.lineTo(-7.3,7);chineShape.lineTo(-1.9,-6);chineShape.closePath();
const wing=mesh(new THREE.ExtrudeGeometry(chineShape,{depth:.23,bevelEnabled:false}));wing.rotation.x=Math.PI/2;wing.position.y=.05;
const canopy=mesh(new THREE.SphereGeometry(1,16,10),glass);canopy.scale.set(.65,.65,2.3);canopy.position.set(0,.65,-5);
for(const side of [-1,1]){
 const engine=mesh(new THREE.CylinderGeometry(.97,1.05,14,16));engine.rotation.x=Math.PI/2;engine.position.set(side*5,0,2.2);
 const inlet=mesh(new THREE.ConeGeometry(.78,3.6,16));inlet.rotation.x=-Math.PI/2;inlet.position.set(side*5,0,-5.4);
 const finShape=new THREE.Shape();finShape.moveTo(0,0);finShape.lineTo(-1.2,3);finShape.lineTo(1.7,3);finShape.lineTo(3.1,0);finShape.closePath();
 const fin=mesh(new THREE.ExtrudeGeometry(finShape,{depth:.18,bevelEnabled:false}));fin.rotation.y=-Math.PI/2;fin.rotation.z=side*-.22;fin.position.set(side*5,.7,4.7);
 const nozzle=mesh(new THREE.CylinderGeometry(.76,.82,.7,16),exhaustMaterial);nozzle.rotation.x=Math.PI/2;nozzle.position.set(side*5,0,9.5);
 const flame=mesh(new THREE.ConeGeometry(.72,7,14),new THREE.MeshBasicMaterial({color:0x9cafef,transparent:true,opacity:.32,depthWrite:false}));flame.rotation.x=Math.PI/2;flame.position.set(side*5,0,13.3);
}
const oceanMaterial=new THREE.MeshStandardMaterial({color:0x303951,roughness:.65,metalness:.35});
const ocean=new THREE.Mesh(new THREE.PlaneGeometry(6000,6000),oceanMaterial);ocean.rotation.x=-Math.PI/2;scene.add(ocean);
const grid=new THREE.GridHelper(2400,120,0x646b8d,0x434b6c);grid.position.y=.025;grid.material.transparent=true;grid.material.opacity=.4;scene.add(grid);
const skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{clay:{value:0}},vertexShader:'varying vec3 vDirection; void main(){ vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',fragmentShader:`varying vec3 vDirection; uniform float clay;
 void main(){vec3 d=normalize(vDirection);float h=max(d.y,0.0);vec3 low=vec3(.22,.24,.39);vec3 high=vec3(.055,.068,.16);vec3 c=mix(low,high,smoothstep(0.,.8,h));float seam=exp(-abs(d.y-.018)*45.);float glow=pow(max(0.,dot(normalize(d.xz),normalize(vec2(-.7,.7)))),9.);c+=vec3(.29,.13,.07)*seam*glow;float layer=sin(d.y*28.+d.x*2.)*.006;c+=layer; c=mix(c,vec3(.28,.29,.32),clay);gl_FragColor=vec4(c,1.);}`});
const sky=new THREE.Mesh(new THREE.SphereGeometry(2800,32,16),skyMaterial);scene.add(sky);
const paths=new THREE.Group();scene.add(paths);
const cameraMarker=new THREE.Mesh(new THREE.BoxGeometry(4,3,5),new THREE.MeshBasicMaterial({color:0xb6a2f1}));scene.add(cameraMarker);
const aimLine=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:0xb6a2f1,dashSize:3,gapSize:2}));scene.add(aimLine);
const frustumCamera=shotCamera.clone();frustumCamera.far=90;
const cameraHelper=new THREE.CameraHelper(frustumCamera);scene.add(cameraHelper);
function rebuildPaths(){
 for(const child of [...paths.children]){child.geometry.dispose();child.material.dispose();paths.remove(child)}
 for(const [key,color] of [['aircraft',0xedae7b],['camera',0xb6a2f1]]){
  const points=[];for(let n=0;n<=180;n++){const v=pose(n/180,settings)[key];points.push(new THREE.Vector3(v.x,v.y,v.z))}
  paths.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color})));
 }
}
let overviewInitialized=false;
function updateScene(){
 const p=pose(progress,settings);phaseControls(p.beat,schedule(settings));$('phase-playhead').style.left=`${progress*100}%`;plane.position.set(p.aircraft.x,p.aircraft.y,p.aircraft.z);plane.rotation.x=p.pitch;
 shotCamera.position.set(p.camera.x,p.camera.y,p.camera.z);shotCamera.fov=settings.fov;shotCamera.lookAt(p.aim.x,p.aim.y,p.aim.z);shotCamera.updateProjectionMatrix();shotCamera.updateMatrixWorld();
 cameraMarker.position.copy(shotCamera.position);cameraMarker.quaternion.copy(shotCamera.quaternion);
 aimLine.geometry.dispose();aimLine.geometry=new THREE.BufferGeometry().setFromPoints([shotCamera.position,new THREE.Vector3(p.aircraft.x,p.aircraft.y,p.aircraft.z)]);aimLine.computeLineDistances();frustumCamera.position.copy(shotCamera.position);frustumCamera.quaternion.copy(shotCamera.quaternion);frustumCamera.fov=shotCamera.fov;frustumCamera.aspect=shotCamera.aspect;frustumCamera.updateProjectionMatrix();frustumCamera.updateMatrixWorld();cameraHelper.update();
 cameraHelper.visible=cameraMarker.visible=aimLine.visible=paths.visible=sceneView;
 grid.visible=!!settings.grid;grid.position.z=Math.round(p.aircraft.z/20)*20;
 ocean.position.z=p.aircraft.z;
 bodyMaterial.color.setHex(settings.clay?0x9b9c9e:0x1c2030);oceanMaterial.color.setHex(settings.clay?0x51535a:0x303951);skyMaterial.uniforms.clay.value=settings.clay;
 sky.position.copy(sceneView?overviewCamera.position:shotCamera.position);
 $('light').style.opacity=sceneView?'0':p.fade;
 $('time').textContent=`${p.time.toFixed(2)} / ${settings.duration.toFixed(2)}s`;
 $('beat-title').textContent=`${p.beat+1} · ${beats[p.beat]}`;$('beat-note').textContent=descriptions[p.beat];
 $('readout').textContent=`Aircraft ↑ ${p.aircraft.y.toFixed(1)} · Camera ↑ ${p.camera.y.toFixed(1)} · Pitch ${(p.pitch*180/Math.PI).toFixed(1)}° · Camera ${p.camera.z<p.aircraft.z?'ahead':'behind'} ${Math.abs(p.camera.z-p.aircraft.z).toFixed(1)} · Side ${p.camera.x.toFixed(1)} · ${Math.round(progress*100)}%` + (p.beat===0 ? ` · Rush ${approachMotion(settings).limited?'limited to keep a safe gap':'active'} · ends at ${approachMotion(settings).endGap.toFixed(0)} units` : '');
 [...$('beats').children].forEach((b,i)=>b.setAttribute('aria-pressed',i===p.beat));
 return p;
}
function render(){updateScene();renderer.render(scene,sceneView?overviewCamera:shotCamera)}
function resize(){const box=$('viewport').getBoundingClientRect();renderer.setSize(box.width,box.height,false);shotCamera.aspect=overviewCamera.aspect=box.width/box.height;overviewCamera.updateProjectionMatrix();render()}
new ResizeObserver(resize).observe($('viewport'));
function view(mode){sceneView=mode;orbit.enabled=mode;
 if(mode&&!overviewInitialized){const p=pose(progress,settings);overviewCamera.position.set(220,p.aircraft.y+170,p.aircraft.z+230);orbit.target.set(0,p.aircraft.y,p.aircraft.z);overviewInitialized=true}
 $('shot-view').setAttribute('aria-pressed',!mode);$('scene-view').setAttribute('aria-pressed',mode);$('view-label').textContent=mode?'SCENE · PEACH = FLIGHT / LAVENDER = CAMERA':'SHOT CAMERA';$('viewport-hint').textContent=mode?'Drag to orbit · scroll to zoom · slider to scrub':'Scroll to scrub · ← → step';orbit.update();render();
}
$('shot-view').onclick=()=>view(false);$('scene-view').onclick=()=>view(true);
$('viewport').addEventListener('wheel',e=>{if(sceneView)return;e.preventDefault();stop();const delta=e.deltaMode===1?e.deltaY*16:e.deltaY;setProgress(progress+clamp(delta,-240,240)*.00035)},{passive:false});
$('viewport').onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();stop();setProgress(progress+(e.key==='ArrowRight'?1:-1)*(e.shiftKey?.05:.005))}if(e.code==='Space'){e.preventDefault();$('play').click()}};
$('progress').oninput=()=>{stop();setProgress(+$('progress').value/100)};
$('play').onclick=()=>{playing=!playing;if(playing&&progress>=1)setProgress(0);lastTime=0;$('play').textContent=playing?'Pause':'Play'};
$('start').onclick=()=>{stop();setProgress(0)};
beats.forEach((label,i)=>{const b=document.createElement('button');b.innerHTML=`<span>${i+1} ${label}</span><small></small>`;b.onclick=()=>{stop();setProgress(schedule(settings)[i].start+.00001)};$('beats').append(b)});
function animate(t){requestAnimationFrame(animate);if(playing){if(lastTime)setProgress(progress+Math.min(t-lastTime,100)/(settings.duration*1000));lastTime=t;if(progress>=1)stop()}else lastTime=0;if(sceneView){orbit.update();render()}}
function exportObject(){return {kind:'sr71-3d-camera-blocking',version:2,units:'relative-not-meters',progress:progress*100,settings:{...settings,progress:progress*100},pose:pose(progress,settings)}}
function download(data,name,type){const url=URL.createObjectURL(data instanceof Blob?data:new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('save').onclick=()=>download(JSON.stringify(exportObject(),null,2)+'\n','sr71-camera-settings.json','application/json');
$('reset').onclick=()=>{stop();settings={...defaults};syncControls();progress=0;configurationChanged();setProgress(0);$('status').textContent='Restored your imported preset and initial 3D defaults.'};
$('import').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;const parsed=JSON.parse(await file.text());const source=parsed.settings||parsed;if(!Object.keys(ranges).some(k=>typeof source[k]==='number'&&Number.isFinite(source[k])))throw Error('No camera settings found');settings=cleanSettings(parsed);progress=settings.progress/100;stop();syncControls();configurationChanged();setProgress(progress);$('status').textContent='Settings imported.'}catch(err){$('status').textContent='Could not import: '+err.message}finally{e.target.value=''}};
function tab(gallery){$('directing').hidden=gallery;$('storyboard').hidden=!gallery;$('directing-tab').setAttribute('aria-selected',!gallery);$('storyboard-tab').setAttribute('aria-selected',gallery);if(gallery)renderGallery();else requestAnimationFrame(resize)}
$('directing-tab').onclick=()=>tab(false);$('storyboard-tab').onclick=()=>tab(true);
const studies=[
 ['latest','04-distant-elevated-twilight','Elevated distance','Small aircraft, high camera, sky dominant.','stills/'],
 ['latest','05-nose-elevated-twilight','Nose approach','Composition study; downward angle is stronger than the intended near-level gaze.','stills/'],
 ['latest','06-side-twilight','Twilight side tracking','Preferred angle and blue-purple / afterglow palette.','stills/'],
 ['earlier','01-distant-approach','Earlier distant approach','Earlier head-on composition before the elevated-camera correction.','stills/'],
 ['earlier','02-close-nose-above','Earlier close nose','Earlier upper-nose study.','stills/'],
 ['earlier','03-blue-ending-angle','Blue ending angle','Poster mood merged with the blue afterburner reference.','stills/'],
 ['blockout','route-a','Route A · contact sheet','Initial side → rear → departure proposal.',''],
 ['blockout','route-b','Route B · contact sheet','Initial distant nose → side → poster proposal.',''],
 ...['b1-distant-nose','b2-nose-approach','b3-retreat-and-rise','b4-side-reveal','b5-poster-profile','a1-side-follow','a2-rise-over-wing','a3-rear-settle','a4-afterburners','a5-departure'].map(name=>['blockout',name,name.replace(/-/g,' '),'Original Blender blockout; superseded by the adjustable 3D shot.',''])
].map(([category,id,title,note,path])=>({id,category,title,note,src:path+id+'.png'}));
let db=null;
try{db=await new Promise((resolve,reject)=>{const req=indexedDB.open('sr71-directing-room',1);req.onupgradeneeded=()=>req.result.createObjectStore('captures',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});captures=await new Promise((resolve,reject)=>{const req=db.transaction('captures').objectStore('captures').getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}catch{$('status').textContent='Browser storage unavailable. Captures last for this session; download them to keep them.'}
function storeCapture(entry){if(!db)return Promise.resolve();return new Promise((resolve,reject)=>{const tx=db.transaction('captures','readwrite');tx.objectStore('captures').put(entry);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
$('capture').onclick=async()=>{
 stop();const originalView=sceneView;sceneView=false;render();
 // Capture clean 16:9 output, independent of sidebar size, without planning labels.
 const width=renderer.domElement.width,height=renderer.domElement.height,ratio=renderer.getPixelRatio();renderer.setPixelRatio(1);renderer.setSize(1600,900,false);shotCamera.aspect=16/9;shotCamera.updateProjectionMatrix();renderer.render(scene,shotCamera);
 const output=document.createElement('canvas');output.width=1600;output.height=900;const ctx=output.getContext('2d');ctx.drawImage(renderer.domElement,0,0);
 const state=pose(progress,settings);if(state.fade>0){const g=ctx.createRadialGradient(800,450,0,800,450,950);g.addColorStop(0,'#f5f4ff');g.addColorStop(.35,'#d4d0ed');g.addColorStop(.72,'#71658e');g.addColorStop(1,'#d99c84');ctx.globalAlpha=state.fade;ctx.fillStyle=g;ctx.fillRect(0,0,1600,900)}
 const entry={id:'capture-'+Date.now(),category:'capture',title:`${beats[state.beat]} · ${state.time.toFixed(2)}s`,note:'Camera blockout captured at '+new Date().toLocaleString(),src:output.toDataURL('image/png'),configuration:exportObject()};
 sceneView=originalView;renderer.setPixelRatio(ratio);renderer.setSize(width/ratio,height/ratio,false);resize();captures.unshift(entry);
 try{await storeCapture(entry);$('status').textContent='Frame captured. Open Storyboard to review or download.'}catch{$('status').textContent='Storage full. Frame is available this session; download it from Storyboard.'}
 renderGallery();
};
function renderGallery(){
 $('capture-count').textContent=captures.length?`(${captures.length})`:'';const filter=$('gallery-filter').value;const entries=[...captures].sort((a,b)=>b.id.localeCompare(a.id)).concat(studies).filter(e=>filter==='all'||e.category===filter);$('gallery').replaceChildren();
 if(!entries.length){const p=document.createElement('p');p.className='empty';p.textContent='No captures yet. Capture a frame from the directing tab.';$('gallery').append(p)}
 for(const entry of entries){const card=document.createElement('article');card.className='card';const b=document.createElement('button');const image=document.createElement('img');image.src=entry.src;image.alt=entry.title;image.loading='lazy';const caption=document.createElement('div');caption.className='caption';const h=document.createElement('h2');h.textContent=entry.title;const p=document.createElement('p');p.textContent=entry.note;caption.append(h,p);b.append(image,caption);b.onclick=()=>openEntry(entry);card.append(b);$('gallery').append(card)}
}
function openEntry(entry){$('dialog-image').src=entry.src;$('dialog-image').alt=entry.title;$('dialog-title').textContent=entry.title;$('dialog-note').textContent=entry.note;$('dialog-actions').replaceChildren();
 function action(label,run){const b=document.createElement('button');b.textContent=label;b.onclick=run;$('dialog-actions').append(b)}
 if(entry.configuration){
  action('Restore shot settings',()=>{settings=cleanSettings(entry.configuration);progress=settings.progress/100;stop();syncControls();configurationChanged();setProgress(progress);view(false);$('image-dialog').close();tab(false)});
  action('Download frame PNG',async()=>download(await (await fetch(entry.src)).blob(),entry.id+'.png','image/png'));
  action('Download frame settings',()=>download(JSON.stringify(entry.configuration,null,2)+'\n',entry.id+'.json','application/json'));
  action('Edit note',async()=>{const note=prompt('Shot note',entry.note);if(note===null)return;entry.note=note;try{await storeCapture(entry)}catch{$('status').textContent='Note could not be saved to browser storage.'}$('dialog-note').textContent=note;renderGallery()});
  action('Delete capture',async()=>{if(db){await new Promise((resolve,reject)=>{const tx=db.transaction('captures','readwrite');tx.objectStore('captures').delete(entry.id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}captures=captures.filter(e=>e.id!==entry.id);$('image-dialog').close();renderGallery()});
 }
 $('image-dialog').showModal();
}
$('gallery-filter').onchange=renderGallery;$('close-dialog').onclick=()=>$('image-dialog').close();
$('image-dialog').onclick=e=>{if(e.target===$('image-dialog'))$('image-dialog').close()};
$('loading').hidden=true;annotateTimeline(schedule(settings));rebuildPaths();setProgress(progress);renderGallery();resize();requestAnimationFrame(animate);
