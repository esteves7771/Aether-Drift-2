"""Space Voyage offline preparation; supplied archive remains unchanged. Blender --disable-autoexec."""
import bpy,math,json
from pathlib import Path
from mathutils import Vector,Matrix
root=Path.cwd();src=root/'.local-tools/model-sources/space-voyage';out=root/'.local-tools/model-candidates/space-voyage.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(src/'source/Space Voyage .fbx'),use_anim=False)
selected=[]
for o in list(bpy.context.scene.objects):
 if o.type!='MESH':continue
 pts=[o.matrix_world@Vector(c) for c in o.bound_box];cx=sum(p.x for p in pts)/8
 if not -90<cx<0 or sum(p.z for p in pts)/8 < -10 or 'thruster fire' in o.name.lower():continue
 o.data=o.data.copy();o.data.transform(o.matrix_world);o.parent=None;o.matrix_world=Matrix.Identity(4)
 selected.append(o)
for o in list(bpy.context.scene.objects):
 if o not in selected:bpy.data.objects.remove(o,do_unlink=True)
source_tris=0
for o in selected:o.data.calc_loop_triangles();source_tris+=len(o.data.loop_triangles)
for o in selected:
 o.data.calc_loop_triangles();n=len(o.data.loop_triangles)
 if n>300:
  bpy.context.view_layer.objects.active=o;m=o.modifiers.new('Bounded cruiser detail','DECIMATE');m.ratio=min(1,65000/source_tris);bpy.ops.object.modifier_apply(modifier=m.name)
 for a in list(o.data.color_attributes):o.data.color_attributes.remove(a)
for im in bpy.data.images:
 name=Path(im.filepath).name;p=src/'textures'/name
 if p.exists():
  im.filepath=str(p);im.reload();cap=2048 if 'BaseColor' in name else 1024
  if max(im.size)>cap:ratio=cap/max(im.size);im.scale(round(im.size[0]*ratio),round(im.size[1]*ratio))
  im.pack()
bpy.ops.object.select_all(action='DESELECT')
for o in selected:o.select_set(True)
bpy.context.view_layer.objects.active=selected[0];bpy.ops.object.join();o=bpy.context.object
points=[v.co for v in o.data.vertices];lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)]);center=(lo+hi)*.5
# Original nose -Y, rear engine mouths +Y. Rotate to glTF -Z forward, +Z rear.
o.data.transform(Matrix.Rotation(math.pi,4,'Z')@Matrix.Translation(-center))
o.data.calc_loop_triangles();out.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False)
report={'sourceMeshes':len(selected),'sourceTriangles':source_tris,'triangles':len(o.data.loop_triangles),'sourceCenter':list(center),'sourceDims':list(hi-lo),'engineMouthsSource':[[-38.18,176,28.54],[-38.18,162,40],[-38.18,162,16]]}
(root/'artifacts/phase5h/space-voyage-prepared.json').write_text(json.dumps(report,indent=2));print('PREPARED '+json.dumps(report),flush=True)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=8;scene.render.resolution_x=800;scene.render.resolution_y=600;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.03,.05,.08,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
size=max(hi-lo)
for v,power in [((1,1,1),50),((-1,0,1),30),((0,-1,.6),30)]:
 bpy.ops.object.light_add(type='AREA',location=Vector(v)*size);l=bpy.context.object;l.rotation_euler=(-l.location).to_track_quat('-Z','Y').to_euler();l.data.energy=power*size*size;l.data.size=size
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=size*1.2
for name,v in [('voyage-front',(1,1.4,.8)),('voyage-rear',(1,-1.4,.8))]:
 cam.location=Vector(v)*size;cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(root/'artifacts/phase5h'/f'{name}.png');bpy.ops.render.render(write_still=True)
