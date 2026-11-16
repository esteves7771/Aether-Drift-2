import bpy,json,math
from pathlib import Path
from mathutils import Vector,Matrix
root=Path.cwd();src=root/'.local-tools/model-sources/nms-starship'
bpy.ops.wm.open_mainfile(filepath=str(src/'source/nms_starship.blend'),load_ui=False,use_scripts=False)
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
print('PTAH_NODES '+json.dumps([{'name':m.name,'nodes':[{'name':n.name,'type':n.type} for n in m.node_tree.nodes],'links':[l.from_node.name+'.'+l.from_socket.name+' -> '+l.to_node.name+'.'+l.to_socket.name for l in m.node_tree.links]} for m in bpy.data.materials if m.use_nodes]),flush=True)
for im in bpy.data.images:
 p=src/'textures'/(im.name+'.png')
 if p.exists():im.filepath=str(p);im.reload();im.colorspace_settings.name='sRGB' if im.name=='D' else 'Non-Color';cap=2048 if im.name=='D' else 1024;im.scale(cap,cap);im.pack()
for o in list(bpy.context.scene.objects):
 if o not in meshes:bpy.data.objects.remove(o,do_unlink=True)
for o in meshes:
 o.data.calc_loop_triangles();tri=len(o.data.loop_triangles)
 for mod in list(o.modifiers):o.modifiers.remove(mod)
 bpy.context.view_layer.objects.active=o;m=o.modifiers.new('PTAH browser geometry','DECIMATE');m.ratio=48000/tri;bpy.ops.object.modifier_apply(modifier=m.name)
 bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
 for a in list(o.data.color_attributes):o.data.color_attributes.remove(a)
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
# Bake the original height-driven Bump node to a real tangent-space normal map.
# Exporting H.png directly as normalTexture would be incorrect.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=1
mat=meshes[0].data.materials[0];nodes=mat.node_tree.nodes
normal_image=bpy.data.images.new('PTAH_micro_normal',width=1024,height=1024);normal_image.colorspace_settings.name='Non-Color'
target=nodes.new('ShaderNodeTexImage');target.image=normal_image;nodes.active=target
bpy.ops.object.bake(type='NORMAL',normal_space='TANGENT',use_clear=True,margin=4)
normal_image.pack();normal_node=nodes.new('ShaderNodeNormalMap');mat.node_tree.links.new(target.outputs['Color'],normal_node.inputs['Color']);mat.node_tree.links.new(normal_node.outputs['Normal'],nodes.get('Principled BSDF').inputs['Normal'])
out=root/'.local-tools/model-candidates/ptah.glb';bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False)
scene=bpy.context.scene;points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices];lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)]);center=(lo+hi)*.5;size=max(hi-lo)
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=8;scene.render.resolution_x=800;scene.render.resolution_y=600;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.03,.05,.08,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
for v,power in [((1,1,1),40),((-1,0,1),25),((0,-1,.6),30)]:
 bpy.ops.object.light_add(type='AREA',location=center+Vector(v)*size);l=bpy.context.object;l.rotation_euler=(center-l.location).to_track_quat('-Z','Y').to_euler();l.data.energy=power*size*size;l.data.size=size
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=size*1.3
for name,v in [('ptah-front',(1,1.4,.8)),('ptah-rear',(-1,-1.4,.8)),('ptah-top',(0,0,2))]:
 cam.location=center+Vector(v)*size;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(root/'artifacts/phase5h'/f'{name}.png');bpy.ops.render.render(write_still=True)
