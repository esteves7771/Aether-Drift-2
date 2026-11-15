"""Offline Blender 4.2 conversion/catalog. Never runs scripts embedded in supplied .blend files.
Run: blender --background --factory-startup --disable-autoexec --python tools/prepare-models.py -- [slug ...]
Outputs inspection GLBs, JSON measurements and honest rendered thumbnails outside public/.
"""
import bpy, json, math, sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / '.local-tools/model-sources'
OUT = ROOT / '.local-tools/model-candidates'
CATALOG = ROOT / 'artifacts/model-integration/catalog'
MODELS = {
    'spaceship-free-001': ('source/fast_texturing_output.fbx', 12000),
    'alien-flying-saucer': ('source/ovni ch.fbx', 18000),
    'futuristic-sci-fi-spaceship': ('source/Spaceship.fbx', 24000),
    'futuristic-sci-fi-jet-plasticity-boxcutter': ('source/spaceship 308 2025.fbx', 16000),
    'sci-fi-concept-spaceship': ('source/spaceship-expanded/spaceship/spaceship.blend', 18000),
    'spaceship': ('source/model.dae', 16000),
    'sci-fi-box': ('source/Caja1.fbx', 2000),
    'star-sparrow-modular-spaceship': ('source/Unity.blend', 12000),
    'sci-fi-space-station': ('source/LP_SpaceStation-expanded/LP_SpaceStation.fbx', 26000),
    'iss': ('International Space Station (ISS) (B).glb', 26000)
}

def meshes():
    return [o for o in bpy.context.scene.objects if o.type == 'MESH' and not o.hide_render]

def geometry(objects, surface_bounds=False):
    bpy.context.view_layer.update()
    mins, maxs = [float('inf')]*3, [-float('inf')]*3
    triangles = vertices = 0
    graph=bpy.context.evaluated_depsgraph_get()
    for o in objects:
        evaluated=o.evaluated_get(graph); m=evaluated.to_mesh();m.calc_loop_triangles()
        triangles+=len(m.loop_triangles);vertices+=len(m.vertices)
        if surface_bounds:
            points=[]
            for tri in m.loop_triangles:
                a,b,c=[o.matrix_world@m.vertices[i].co for i in tri.vertices]
                if (b-a).cross(c-a).length_squared>1e-10:points.extend((a,b,c))
        else:points=[o.matrix_world@v.co for v in m.vertices]
        for p in points:
            for axis in range(3):mins[axis]=min(mins[axis],p[axis]);maxs[axis]=max(maxs[axis],p[axis])
        evaluated.to_mesh_clear()
    return {'triangles':triangles,'vertices':vertices,'min':mins,'max':maxs,'dimensions':[maxs[i]-mins[i] for i in range(3)]}

def repair_images(folder):
    files={p.name.lower():p for p in folder.rglob('*') if p.suffix.lower() in ('.png','.jpg','.jpeg','.tga')}
    for image in bpy.data.images:
        if image.type!='IMAGE':continue
        name=Path(image.filepath.replace('\\','/')).name.lower()
        p=files.get(name) or files.get(image.name.lower())
        if p: image.filepath=str(p); image.reload()
    return files

def pbr_repair(files):
    # Source FBX/DAE often contains obsolete absolute paths or diffuse-only links.
    # Match authored material prefixes, never substitute unrelated texture artwork.
    for mat in bpy.data.materials:
        mat.use_nodes=True
        principled=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
        if not principled:continue
        key=mat.name.lower().replace('material::','')
        normalized=key.replace('_baked','_bake1_pbr')
        candidates=[p for name,p in files.items() if name.startswith(normalized+'_') or name.startswith(key+'_') or ('lp_spacestation_'+key+'_') in name]
        if not candidates and len({p.name.split('_')[0] for p in files.values()})<=2: candidates=list(files.values())
        if not candidates and len(files)<=6:candidates=list(files.values())
        for socket,terms,color in [
            ('Base Color',('basecolor','base_color','diffuse','albedo','starsparrow_red','material_0.png'),True),
            ('Roughness',('roughness',),False),('Metallic',('metallic','metalness'),False),
            ('Normal',('normal',),False),('Emission Color',('emissive','emission'),True)]:
            matches=[p for p in candidates if any(t in p.name.lower() for t in terms)]
            if not matches:continue
            node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=bpy.data.images.load(str(matches[0]),check_existing=True)
            node.image.colorspace_settings.name='sRGB' if color else 'Non-Color'
            if socket=='Normal':
                normal=mat.node_tree.nodes.new('ShaderNodeNormalMap');mat.node_tree.links.new(node.outputs['Color'],normal.inputs['Color']);output=normal.outputs['Normal']
            else: output=node.outputs['Color']
            mat.node_tree.links.new(output,principled.inputs[socket])
            if socket=='Emission Color':principled.inputs['Emission Strength'].default_value=.7
        principled.inputs['Roughness'].default_value=max(.25,principled.inputs['Roughness'].default_value)

def prepare(slug):
    relative,budget=MODELS[slug]
    folder=SOURCES/slug
    source=ROOT/'assets-source'/relative if slug=='iss' else folder/relative
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if source.suffix=='.blend':bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False,use_scripts=False)
    elif source.suffix=='.fbx':bpy.ops.import_scene.fbx(filepath=str(source),use_anim=False)
    elif source.suffix=='.dae':bpy.ops.wm.collada_import(filepath=str(source),import_units=True)
    else:bpy.ops.import_scene.gltf(filepath=str(source))
    # The modular sample animates every module from zero scale at frame 1.
    # Inspect a populated assembly frame, not an empty introductory frame.
    bpy.context.scene.frame_set(120 if slug=='star-sparrow-modular-spaceship' else 1)
    objects=meshes()
    if not objects:raise RuntimeError('No visible source geometry: '+slug)
    original=geometry(objects)
    source_materials=[m.name for m in bpy.data.materials]
    for o in objects:
        if not any(o.data.materials):
            o.data.materials.clear()
            o.data.materials.append(bpy.data.materials.new('Restored source PBR'))
    files=repair_images(folder)
    # Native Blender materials are retained. FBX/DAE links are repaired from accompanying maps.
    pbr_repair(files)
    images=[{'name':i.name,'width':i.size[0],'height':i.size[1]} for i in bpy.data.images if i.type=='IMAGE' and i.size[0]>0]
    report={'slug':slug,'source':str(source.relative_to(ROOT)), 'sourceGeometry':original,'objects':[o.name for o in objects], 'sourceMaterials':source_materials, 'materials':[m.name for m in bpy.data.materials], 'sourceTextures':images}
    for o in list(bpy.context.scene.objects):
        if o not in objects and o.type not in ('EMPTY','ARMATURE'):bpy.data.objects.remove(o,do_unlink=True)
    # Static visual assets: bake source modifiers and bound total visible triangles.
    ratio=min(1,budget/max(1,original['triangles']))
    for o in objects:
        if ratio<.99:
            modifier=o.modifiers.new('Browser triangle budget','DECIMATE');modifier.ratio=ratio;modifier.use_collapse_triangulate=True
    cap=256 if slug=='sci-fi-box' else 512 if slug in ('sci-fi-space-station','alien-flying-saucer','futuristic-sci-fi-spaceship') else 1024
    for image in bpy.data.images:
        if image.type!='IMAGE' or image.size[0]==0:continue
        w,h=image.size
        if max(w,h)>cap:image.scale(max(1,round(w*cap/max(w,h))),max(1,round(h*cap/max(w,h))))
        if 'directx' in image.name.lower():
            import numpy as np
            pixels=np.empty(len(image.pixels),dtype=np.float32);image.pixels.foreach_get(pixels);pixels[1::4]=1-pixels[1::4];image.pixels.foreach_set(pixels);image.update()
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.hide_set(False);o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    OUT.mkdir(parents=True,exist_ok=True);CATALOG.mkdir(parents=True,exist_ok=True)
    # Apply static modifiers, then merge objects into material primitives. The station's
    # hundreds of source objects must not become hundreds of runtime draw calls.
    graph=bpy.context.evaluated_depsgraph_get()
    baked=[]
    for o in objects:
        mesh=bpy.data.meshes.new_from_object(o.evaluated_get(graph),preserve_all_data_layers=True,depsgraph=graph)
        mesh.transform(o.matrix_world)
        fresh=bpy.data.objects.new(o.name+' static',mesh);bpy.context.collection.objects.link(fresh);baked.append(fresh)
    for o in objects:bpy.data.objects.remove(o,do_unlink=True)
    objects=baked
    if slug=='iss':
        shared=objects[0].data.materials[0]
        for o in objects:
            o.data.materials.clear();o.data.materials.append(shared)
            for face in o.data.polygons:face.material_index=0
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.ops.object.join();objects=[bpy.context.object]
    bpy.ops.export_scene.gltf(filepath=str(OUT/(slug+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_image_format='AUTO',export_yup=True)
    report['preparedGeometry']=geometry(objects);report['preparedBytes']=(OUT/(slug+'.glb')).stat().st_size
    # Reimport the actual exported candidate into a clean studio. Legacy .blend view layers,
    # compositors and visibility flags must not contaminate the catalog image.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(OUT/(slug+'.glb')))
    objects=meshes();framing=geometry(objects,True)
    # Honest source-derived image, not generative artwork. CPU rendering is reproducible/headless.
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=8
    scene.render.use_border=False
    scene.render.use_compositing=False
    for collection in bpy.data.collections:collection.hide_render=False
    def show_collection(layer):
        layer.exclude=False;layer.hide_viewport=False
        for child in layer.children:show_collection(child)
    for layer in scene.view_layers:show_collection(layer.layer_collection)
    for layer in scene.view_layers:layer.use=True
    for o in objects:
        if hasattr(o,'visible_camera'):o.visible_camera=True
    scene.render.resolution_x=640;scene.render.resolution_y=480;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
    scene.world=bpy.data.worlds.new('Catalog studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.035,.055,.085,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
    center=Vector([(framing['min'][i]+framing['max'][i])/2 for i in range(3)]);size=max(framing['dimensions'])
    bpy.ops.object.camera_add(location=center+Vector((1.15,-1.5,1.0))*size);cam=bpy.context.object;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=size*1.5;scene.camera=cam
    for offset,power in [((1,-1,2),45),((-1,-.5,.6),25),((0,1,1),35)]:
        bpy.ops.object.light_add(type='AREA',location=center+Vector(offset)*size);lamp=bpy.context.object;lamp.rotation_euler=(center-lamp.location).to_track_quat('-Z','Y').to_euler();lamp.data.energy=power*size*size;lamp.data.shape='DISK';lamp.data.size=size
    scene.view_settings.view_transform='AgX'
    if slug=='star-sparrow-modular-spaceship':
        scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='SINGLE';scene.display.shading.single_color=(.55,.62,.75);report['thumbnail']='Geometry-only module-layout preview; legacy material/assembly needs manual authoring.'
    scene.render.filepath=str(CATALOG/(slug+'.png'));bpy.ops.render.render(write_still=True)
    (CATALOG/(slug+'.json')).write_text(json.dumps(report,indent=2),encoding='utf8')
    print('ASSET_DONE '+json.dumps({'slug':slug,'sourceTriangles':original['triangles'],'preparedTriangles':report['preparedGeometry']['triangles'],'bytes':report['preparedBytes']}),flush=True)

requested=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(MODELS)
for slug in requested:prepare(slug)
