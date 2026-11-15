"""Offline supplied-FBX conversion. Run Blender with --disable-autoexec; sources stay untouched."""
import bpy, json, math
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/'.local-tools/model-sources/spaceship-boss'
OUT=ROOT/'.local-tools/model-candidates/artillery-dreadnought.glb'
CATALOG=ROOT/'artifacts/phase5g/model'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(SOURCE/'source/expanded/SpaceShip.fbx'),use_anim=False)
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
triangles=sum(len(o.data.polygons) for o in objects)
material=bpy.data.materials.new('Artillery hunter / supplied PBR');material.use_nodes=True
bsdf=material.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Emission Strength'].default_value=.8
textures=[]
CATALOG.mkdir(parents=True,exist_ok=True)
for socket,suffix,cap,color in [('Base Color','Base_color',2048,True),('Normal','Normal_OpenGL',1024,False),('Roughness','Roughness',1024,False),('Metallic','Metallic',1024,False),('Emission Color','Emissive',1024,True)]:
    image=bpy.data.images.load(str(SOURCE/f'textures/DefaultMaterial_{suffix}.png'))
    original=list(image.size)
    image.colorspace_settings.name='sRGB' if color else 'Non-Color'
    image.scale(cap,cap)
    image.pack()
    tex=material.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
    output=tex.outputs['Color']
    if socket=='Normal':
        normal=material.node_tree.nodes.new('ShaderNodeNormalMap');material.node_tree.links.new(output,normal.inputs['Color']);output=normal.outputs['Normal']
    material.node_tree.links.new(output,bsdf.inputs[socket]);textures.append({'source':suffix,'original':original,'prepared':[cap,cap]})
for o in objects:
    for a in list(o.data.color_attributes):o.data.color_attributes.remove(a)
    o.data.materials.clear();o.data.materials.append(material)
    for p in o.data.polygons:p.material_index=0
    o.data.calc_loop_triangles()
    modifier=o.modifiers.new('Browser capital geometry budget','DECIMATE');modifier.ratio=min(1,140000/len(o.data.loop_triangles));modifier.use_collapse_triangulate=True
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
OUT.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False)
prepared=0
for o in objects:o.data.calc_loop_triangles();prepared+=len(o.data.loop_triangles)
report={'source':'assets-source/spaceship boss.zip','sourceTriangles':361794,'preparedTriangles':prepared,'bytes':OUT.stat().st_size,'materials':1,'textures':textures}
(CATALOG/'inspection.json').write_text(json.dumps(report,indent=2))
# Source-derived studio views expose facing and possible weapon-bank attachment surfaces.
points=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
lo=Vector([min(p[a] for p in points) for a in range(3)]);hi=Vector([max(p[a] for p in points) for a in range(3)]);center=(lo+hi)*.5;size=max(hi-lo)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=8
scene.render.resolution_x=800;scene.render.resolution_y=600;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
scene.world=bpy.data.worlds.new('Catalog studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.035,.055,.085,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
for offset,power in [((1,-1,2),45),((-1,0,1),20),((0,1,1),30)]:
    bpy.ops.object.light_add(type='AREA',location=center+Vector(offset)*size);lamp=bpy.context.object;lamp.rotation_euler=(center-lamp.location).to_track_quat('-Z','Y').to_euler();lamp.data.energy=power*size*size;lamp.data.size=size
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=size*1.3
for name,offset in [('front',(1,1.5,1)),('rear',(-1,-1.5,1)),('top',(0,0,2))]:
    cam.location=center+Vector(offset)*size;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(CATALOG/(name+'.png'));bpy.ops.render.render(write_still=True)
print('ARTILLERY_PREPARED '+json.dumps(report),flush=True)
