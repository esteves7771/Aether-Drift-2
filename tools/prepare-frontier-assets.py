import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parent.parent
S=R/'.local-tools/model-sources'; O=R/'public/models'; A=R/'artifacts/phase5e'; A.mkdir(parents=True,exist_ok=True)
for slug in (sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['turret','tesser','astronaut']):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 if slug=='turret':bpy.ops.wm.obj_import(filepath=str(S/'scifi-turret/source/Final-expanded/Final.obj'))
 elif slug=='tesser':bpy.ops.wm.collada_import(filepath=str(S/'tesser/source/model-expanded/model/model.dae'),import_units=True)
 else:bpy.ops.import_scene.gltf(filepath=str(S/'animated-floating-astronaut-in-space-suit-loop/source/Walking astronaut.glb'))
 objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
 tris=sum(len(o.data.polygons) if all(len(p.vertices)==3 for p in o.data.polygons) else sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects)
 report={'sourceTriangles':tris,'objects':[(o.name,len(o.data.vertices)) for o in objects],'actions':[a.name for a in bpy.data.actions]}
 if slug=='tesser':
  files=list((S/'tesser').rglob('*.jpg'))
  for m in bpy.data.materials:
   m.use_nodes=True;p=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
   if not p:continue
   prefix='Parts' if 'part' in m.name.lower() else 'Body'
   for socket,suffix in [('Base Color','albedo'),('Roughness','roughness'),('Metallic','metallic'),('Normal','normal'),('Emission Color','emissive')]:
    path=next((f for f in files if f.name==prefix+'_'+suffix+'.jpg'),None)
    if not path:continue
    n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=bpy.data.images.load(str(path),check_existing=True);n.image.colorspace_settings.name='sRGB' if suffix in ('albedo','emissive') else 'Non-Color';out=n.outputs['Color']
    if suffix=='normal':nn=m.node_tree.nodes.new('ShaderNodeNormalMap');m.node_tree.links.new(out,nn.inputs['Color']);out=nn.outputs['Normal']
    m.node_tree.links.new(out,p.inputs[socket])
   p.inputs['Emission Strength'].default_value=.8
 if slug=='turret':
  m=bpy.data.materials.new('Aether brushed gunmetal');m.diffuse_color=(.22,.3,.38,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.22,.3,.38,1);p.inputs['Metallic'].default_value=.65;p.inputs['Roughness'].default_value=.38
  for o in objects:o.data.materials.clear();o.data.materials.append(m)
 cap=512 if slug=='astronaut' else 1024
 for im in bpy.data.images:
  if im.type=='IMAGE' and max(im.size)>cap:im.scale(round(im.size[0]*cap/max(im.size)),round(im.size[1]*cap/max(im.size)))
 if slug!='astronaut':
  for o in objects:
   if tris>16000:mod=o.modifiers.new('Browser budget','DECIMATE');mod.ratio=16000/tris
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0]
  bpy.ops.object.convert(target='MESH')
  if slug!='turret':bpy.ops.object.join()
 if slug=='astronaut':
  # The supplied glTF repeats identical triangle vertices. Weld coincident vertices
  # with their existing skin weights; retain armature, named joints and floating action.
  for o in objects:
   if len(o.data.vertices)<1000:continue
   bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
   bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=.000001);bpy.ops.object.mode_set(mode='OBJECT')
   for p in o.data.polygons:p.use_smooth=True
  floating=next(a for a in bpy.data.actions if a.name.startswith('floating'))
  for o in bpy.context.scene.objects:
   if o.type=='ARMATURE':
    o.animation_data_create();o.animation_data.action=floating
    for track in list(o.animation_data.nla_tracks):o.animation_data.nla_tracks.remove(track)
  for a in list(bpy.data.actions):
   if a!=floating:bpy.data.actions.remove(a)
 bpy.ops.export_scene.gltf(filepath=str(O/(slug+'.glb')),export_format='GLB',export_apply=slug!='astronaut',export_animations=slug=='astronaut',export_cameras=False,export_lights=False)
 report['bytes']=(O/(slug+'.glb')).stat().st_size
 (A/(slug+'-source.json')).write_text(json.dumps(report,indent=2))
 print('PREPARED',slug,report,flush=True)
