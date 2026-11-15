"""Supplied OBJ -> one shared PBR atlas. Blender --factory-startup --disable-autoexec."""
import bpy
import numpy as np
from pathlib import Path

root = Path(__file__).resolve().parent.parent
source = root / '.local-tools/model-sources/space-satellite'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=str(source / 'source/Satellite-expanded/Satellite2.obj'))
mat = bpy.data.materials.new('Satellite supplied PBR atlas')
mat.use_nodes = True
p = mat.node_tree.nodes.get('Principled BSDF')
for socket, filename, color in [('Base Color', 'albedo.jpg', True), ('Roughness', 'roughness.jpg', False), ('Metallic', 'metallic.jpg', False), ('Normal', 'normal.png', False)]:
    atlas = np.zeros((256, 512, 4), dtype=np.float32)
    for tile, name in enumerate(['Satellite', 'Satellite2']):
        image = bpy.data.images.load(str(source / 'textures' / (name + '_' + filename)))
        if not color: image.colorspace_settings.name = 'Non-Color'
        image.scale(252, 252)
        data = np.empty(252*252*4, dtype=np.float32)
        image.pixels.foreach_get(data)
        atlas[:,tile*256:(tile+1)*256,:] = np.pad(data.reshape(252,252,4),((2,2),(2,2),(0,0)),mode='edge')
    prepared = bpy.data.images.new('Satellite atlas '+filename,width=512,height=256)
    if not color: prepared.colorspace_settings.name = 'Non-Color'
    prepared.pixels.foreach_set(atlas.ravel())
    prepared.update()
    node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    node.image = prepared
    if socket == 'Normal':
        normal = mat.node_tree.nodes.new('ShaderNodeNormalMap')
        mat.node_tree.links.new(node.outputs['Color'],normal.inputs['Color'])
        mat.node_tree.links.new(normal.outputs['Normal'],p.inputs[socket])
    else:
        mat.node_tree.links.new(node.outputs['Color'],p.inputs[socket])
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH': continue
    names = [m.name if m else 'Satellite' for m in obj.data.materials]
    for face in obj.data.polygons:
        tile = 1 if names[face.material_index] == 'Satellite2' else 0
        for loop in face.loop_indices:
            uv = obj.data.uv_layers.active.data[loop].uv
            uv.x = (uv.x*252+2+tile*256)/512
            uv.y = (uv.y*252+2)/256
        face.material_index = 0
    obj.data.materials.clear()
    obj.data.materials.append(mat)
bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
bpy.ops.object.join()
bpy.ops.export_scene.gltf(filepath=str(root/'public/models/satellite.glb'),export_format='GLB',export_animations=False,export_cameras=False,export_lights=False,export_yup=True)
