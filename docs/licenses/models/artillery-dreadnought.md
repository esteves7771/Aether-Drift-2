# Artillery Dreadnought source record

- Supplied archive: `assets-source/spaceship boss.zip`; user explicitly requested its integration for the new first boss.
- Archive SHA-256: `C6757EA04CEA71DA7D35C27446C18AA7B9A42FE3929D956C1946306F95AAF384`.
- Source: `source/SpaceShip.zip` → `SpaceShip.fbx`; reference `SpaceShip_Highpoly.obj`/MTL; five supplied 4096² DefaultMaterial PBR maps.
- Author, original URL and license: **not supplied**. No attribution or permission terms are invented. The user authorized inclusion in the v0.5g public release. Original source/redistribution evidence remains unavailable; this record does not assert a specific license.
- Production GLB: `public/models/artillery-dreadnought.glb`, 8,441,632 bytes, one material, 140,000 triangles, no skin/animation, external resources or runtime decoder. SHA-256 `62C84E3C07F176425840648FAF6DFFD5B523F896595386747E0731FCDA2CF133`.
- FBX source geometry: 361,794 triangles, one object/material. Blender world dimensions 2.0361 × 4.2293 × 1.3599; decoded GLB dimensions 2.0362 × 1.36 × 4.2294, center (-0.0028,-0.0991,-0.0547), nose -Z, yaw 0. Runtime length 240 m.
- Conversion: `tools/extract-boss-source.py` (contained extraction, size/link checks); `tools/prepare-artillery-boss.py` (Blender 4.2, `--disable-autoexec`); `tools/optimize-boss-glb.mjs` (existing local FFmpeg). Original archives/textures unchanged; scratch GLBs/maps/studio images remain ignored.
- Material: supplied base color, normal OpenGL, metallic, roughness and emissive preserved; no unrelated substitute artwork. Base map 2048²; remaining maps 1024², metallic/roughness packed by glTF exporter. Native glTF color-space semantics retained.
- Source-derived studio views and inspection report: `artifacts/phase5g/model/`. Weapon/coolant anchors were checked against nearest surface vertices, then positioned on the hull; cheap collision proxies remain independent from render meshes.
