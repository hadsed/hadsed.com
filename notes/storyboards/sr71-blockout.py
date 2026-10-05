"""Editable SR-71 camera blockout. Run: blender -b --python notes/storyboards/sr71-blockout.py

Original proxy geometry, not a downloaded aircraft asset. Two five-shot routes.
Camera cuts are storyboard keyframes; interpolation is only a rough starting point.
"""
from pathlib import Path
import math
import bpy
from mathutils import Vector

OUT = Path(__file__).resolve().parent
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 640
scene.render.resolution_y = 360
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.render.fps = 24
scene.view_settings.view_transform = 'AgX'
scene.world.use_nodes = True
nodes = scene.world.node_tree.nodes
nodes.clear()
output = nodes.new('ShaderNodeOutputWorld')
background = nodes.new('ShaderNodeBackground')
background.inputs['Strength'].default_value = .65
noise = nodes.new('ShaderNodeTexNoise')
noise.inputs['Scale'].default_value = 3
noise.inputs['Detail'].default_value = 4
noise.inputs['Roughness'].default_value = .7
tex = nodes.new('ShaderNodeTexCoord')
ramp = nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].position = .22
ramp.color_ramp.elements[0].color = (.055,.078,.087,1)
ramp.color_ramp.elements[1].position = .78
ramp.color_ramp.elements[1].color = (.32,.42,.46,1)
links = scene.world.node_tree.links
links.new(tex.outputs['Normal'], noise.inputs['Vector'])
links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
links.new(ramp.outputs['Color'], background.inputs['Color'])
links.new(background.outputs[0], output.inputs['Surface'])

def material(name,color,metal=.0,rough=.45,emission=0):
    mat=bpy.data.materials.new(name);mat.use_nodes=True
    p=mat.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal
    p.inputs['Roughness'].default_value=rough
    if emission:
        p.inputs['Emission Color'].default_value=(*color,1)
        p.inputs['Emission Strength'].default_value=emission
    return mat
metal=material('Matte graphite titanium',(.07,.09,.105),.7,.36)
glass=material('Smoked canopy',(.035,.075,.095),.8,.2)
nozzle=material('Nozzle dark metal',(.018,.024,.028),.8,.24)
fire=material('Afterburner amber',(.95,.24,.04),0,.4,6)
core=material('Afterburner core',(1,.7,.28),0,.4,12)
root=bpy.data.objects.new('Aircraft / original proxy geometry',None)
scene.collection.objects.link(root);root.location=(0,0,3.8)

def mesh(name,verts,faces,mat,parent=root):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj)
    obj.data.materials.append(mat);obj.parent=parent
    return obj

def loft(name,sections,mat,segments=16,xcenter=0):
    verts=[]
    for y,w,h,z in sections:
        for i in range(segments):
            a=2*math.pi*i/segments;verts.append((xcenter+w*math.cos(a),y,z+h*math.sin(a)))
    faces=[]
    for j in range(len(sections)-1):
        for i in range(segments):
            a=j*segments+i;b=j*segments+(i+1)%segments
            faces.append((a,b,b+segments,a+segments))
    faces.extend([tuple(reversed(range(segments))),tuple(range((len(sections)-1)*segments,len(sections)*segments))])
    obj=mesh(name,verts,faces,mat)
    for p in obj.data.polygons:p.use_smooth=True
    return obj
loft('Long tapered fuselage',[(-16,.03,.02,0),(-12,.65,.25,.15),(-8,1.05,.6,.3),(-3,1.15,.6,.25),(4,1.0,.5,.1),(10,.55,.35,0),(11,.2,.15,0)],metal)
outline=[(0,-15),(-1.6,-6),(-6.9,4),(-7.2,9),(-1,10.5),(0,11),(1,10.5),(7.2,9),(6.9,4),(1.6,-6)]
verts=[(x,y,-.10) for x,y in outline]+[(0,1,.07)]
mesh('Delta wing and chines',verts,[(10,i,(i+1)%10) for i in range(10)],metal)
loft('Canopy',[(-10,.06,.05,.62),(-9,.48,.38,.65),(-7.5,.55,.52,.65),(-6,.3,.27,.62),(-5.7,.02,.02,.62)],glass)
for sign in [-1,1]:
    xc=sign*4.5
    loft('Twin nacelle '+str(sign),[(-5,.8,.8,0),(-3.5,1.25,1.25,0),(3,1.35,1.35,0),(9,1.05,1.05,0),(10.5,.92,.92,0)],metal,xcenter=xc)
    loft('Intake spike '+str(sign),[(-7,.02,.02,0),(-4,.67,.67,0)],nozzle,xcenter=xc)
    loft('Exhaust nozzle '+str(sign),[(10.3,.94,.94,0),(11.1,.8,.8,0)],nozzle,xcenter=xc)
    loft('Afterburner '+str(sign),[(11.13,.65,.65,0),(12.7,.52,.52,0),(16,.025,.025,0)],fire,xcenter=xc)
    loft('Hot core '+str(sign),[(11.14,.43,.43,0),(14,.01,.01,0)],core,xcenter=xc)
    mesh('Canted vertical tail '+str(sign),[(xc,3.5,.5),(xc,9.4,.7),(xc+sign*.65,8.4,3.6),(xc+sign*.65,6.1,3.6)],[(0,1,2,3)],metal)

# A dark mirrored proxy supplies a readable reflection at blockout fidelity.
reflection_root=bpy.data.objects.new('Reflection / compositional proxy',None)
scene.collection.objects.link(reflection_root)
reflection_root.location=(0,0,-3.8);reflection_root.scale=(1,1,-1)
reflection_mat=material('Dim reflection',(.032,.048,.057),.4,.6)
for obj in list(root.children):
    dup=obj.copy();dup.data=obj.data.copy();scene.collection.objects.link(dup)
    dup.parent=reflection_root
    dup.data.materials.clear();dup.data.materials.append(reflection_mat)

# Water under the mirrored proxy; this is a shot-planning surface, not final simulation.
bpy.ops.mesh.primitive_plane_add(size=2000,location=(0,0,-8))
water=bpy.context.object;water.name='Water / horizon blockout'
water.data.materials.append(material('Cold slate water',(.055,.09,.11),.45,.26))
water_mat=water.data.materials[0];wn=water_mat.node_tree.nodes
n=wn.new('ShaderNodeTexNoise');n.inputs['Scale'].default_value=80;n.inputs['Detail'].default_value=2
bump=wn.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.12;bump.inputs['Distance'].default_value=.07
water_mat.node_tree.links.new(n.outputs['Fac'],bump.inputs['Height']);water_mat.node_tree.links.new(bump.outputs[0],wn.get('Principled BSDF').inputs['Normal'])

# Diffuse storm lighting, with a brighter opening off to one side.
def area(name,location,power,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=location
    obj.rotation_euler=(Vector((0,0,3.8))-obj.location).to_track_quat('-Z','Y').to_euler()
area('Cloud opening',(-25,-25,40),65000,45)
area('Soft sky fill',(20,12,35),30000,40)

# A gentle volume gives a low-contrast horizon. Clouds are deliberately unresolved.
bpy.ops.mesh.primitive_cube_add(size=2,location=(0,0,15))
fog=bpy.context.object;fog.name='Atmospheric placeholder';fog.scale=(250,250,100)
fog_mat=bpy.data.materials.new('Blue-gray haze');fog_mat.use_nodes=True
fn=fog_mat.node_tree.nodes;fn.clear()
fout=fn.new('ShaderNodeOutputMaterial');volume=fn.new('ShaderNodeVolumePrincipled')
volume.inputs['Density'].default_value=.0009;volume.inputs['Color'].default_value=(.4,.5,.55,1)
fog_mat.node_tree.links.new(volume.outputs[0],fout.inputs['Volume']);fog.data.materials.append(fog_mat)

shots_a=[
    ('a1-side-follow',(48,-9,13),(0,0,3.8),40,0),
    ('a2-rise-over-wing',(25,-3,40),(0,0,3.8),42,0),
    ('a3-rear-settle',(2,50,17),(0,2,3.8),48,0),
    ('a4-afterburners',(0,39,9),(0,1,3.8),48,0),
    ('a5-departure',(0,27,7),(0,-55,3.8),46,-100),
]
shots_b=[
    ('b1-distant-nose',(0,-105,7),(0,0,3.8),44,0),
    ('b2-nose-approach',(0,-43,7),(0,-3,3.8),44,0),
    ('b3-retreat-and-rise',(9,-31,19),(0,-2,3.8),40,0),
    ('b4-side-reveal',(48,-16,12),(0,-1,3.8),40,0),
    ('b5-poster-profile',(70,0,8),(0,0,2.8),45,0),
]

def camera(name):
    data=bpy.data.cameras.new(name);obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj)
    data.clip_end=1200;data.clip_start=.1
    return obj

def animate(cam,shots):
    for i,(name,location,look,lens,plane_y) in enumerate(shots):
        frame=1+i*48
        cam.location=location;cam.rotation_euler=(Vector(look)-Vector(location)).to_track_quat('-Z','Y').to_euler();cam.data.lens=lens
        cam.keyframe_insert(data_path='location',frame=frame);cam.keyframe_insert(data_path='rotation_euler',frame=frame);cam.data.keyframe_insert(data_path='lens',frame=frame)
    return cam
ca=animate(camera('Route A / side to rear to horizon'),shots_a)
cb=animate(camera('Route B / head-on to poster'),shots_b)
scene.frame_end=193
root.location.y=0;root.keyframe_insert(data_path='location',frame=1)
root.keyframe_insert(data_path='location',frame=145)
root.location.y=-100;root.keyframe_insert(data_path='location',frame=193)
reflection_root.location.y=0;reflection_root.keyframe_insert(data_path='location',frame=1)
reflection_root.keyframe_insert(data_path='location',frame=145)
reflection_root.location.y=-100;reflection_root.keyframe_insert(data_path='location',frame=193)
# Route A has departure; route B stills explicitly keep the aircraft stationary.
for route,cam,shots in [('a',ca,shots_a),('b',cb,shots_b)]:
    scene.camera=cam
    if route=='b':
        root.animation_data.action=None;reflection_root.animation_data.action=None
    for i,(name,location,look,lens,plane_y) in enumerate(shots):
        scene.frame_set(1+i*48)
        cam.location=location;cam.rotation_euler=(Vector(look)-Vector(location)).to_track_quat('-Z','Y').to_euler();cam.data.lens=lens
        root.location.y=plane_y;reflection_root.location.y=plane_y
        scene.render.filepath=str(OUT/(name+'.png'))
        bpy.ops.render.render(write_still=True)
    if route=='a':
        scene.frame_set(1)
        bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'sr71-route-a.blend'))
scene.frame_set(1);scene.camera=cb
# Make the default saved scene use the head-on route with no aircraft translation.
root.animation_data.action=None;reflection_root.animation_data.action=None
root.location.y=reflection_root.location.y=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'sr71-blockout.blend'))
print('STORYBOARD_COMPLETE',OUT)
