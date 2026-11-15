import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..'),
    dir = path.join(root, 'artifacts/model-integration/catalog');
const choices = {
    'spaceship-free-001': ['RitorDP', 'CC BY 4.0', 'Imported raider / existing interceptor role', 'Selected'],
    'alien-flying-saucer': [
        'Victor.Alfonso.Ibarra.Ortega',
        'CC BY 4.0',
        'Finite elite ambush variant; same interceptor AI/stats',
        'Selected'
    ],
    'futuristic-sci-fi-spaceship': [
        'Schwaeli',
        'CC BY 4.0',
        'Existing heavy fighter; PBR five-material hull',
        'Selected'
    ],
    'futuristic-sci-fi-jet-plasticity-boxcutter': [
        'mgfxer',
        'CC BY-NC 4.0',
        'Potential cinematic fighter',
        'Not distributed: noncommercial restriction; no need to constrain game licensing'
    ],
    'sci-fi-concept-spaceship': [
        'Aditya Voxel',
        'CC BY 4.0',
        'Potential transport / wreck',
        'Catalog only: simplification loses surface detail; keep the clearer existing carrier/bomber silhouettes'
    ],
    spaceship: ['Darren McNerney 3D', 'CC BY 4.0', 'Surveyor alternate player; original remains default', 'Selected'],
    'sci-fi-box': ['diegoavpro', 'CC BY 4.0', 'Finite supplies at existing wreck locations', 'Selected'],
    'star-sparrow-modular-spaceship': [
        'Ebal Studios',
        'Sketchfab Free Standard',
        'Future authored modular assemblies',
        'Catalog only: animated module layout; frame 1 has zero-scale introductory pieces; frame 120 geometry preview shown'
    ],
    'sci-fi-space-station': ['Dim Bagautdinov', 'CC BY 4.0', 'Kepler orbital recovery landmark', 'Selected'],
    iss: [
        'NASA / Michael D. Carbajal',
        'NASA media usage guidance',
        'ISS heritage/recovery landmark, 130 m visual extent',
        'Selected; source uses untextured gray materials'
    ]
};
const escape = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const reports = [];
function imageSize(data, mime) {
    if (mime === 'image/png') return [data.readUInt32BE(16), data.readUInt32BE(20)];
    for (let i = 2; i + 8 < data.length;) {
        if (data[i] !== 255) {
            i++;
            continue;
        }
        const marker = data[i + 1];
        if (marker === 255) {
            i++;
            continue;
        }
        const length = data.readUInt16BE(i + 2);
        if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker))
            return [data.readUInt16BE(i + 7), data.readUInt16BE(i + 5)];
        if (length < 2) break;
        i += length + 2;
    }
    return [null, null];
}
for (const [slug, [author, license, role, decision]] of Object.entries(choices)) {
    const r = JSON.parse(fs.readFileSync(path.join(dir, slug + '.json'), 'utf8'));
    const file = slug === 'iss' ? 'International Space Station (ISS) (B).glb' : slug + '.zip';
    const raw = fs.readFileSync(path.join(root, 'assets-source', file));
    const prepared = fs.readFileSync(path.join(root, '.local-tools/model-candidates', slug + '.glb'));
    const gltf = JSON.parse(prepared.subarray(20, 20 + prepared.readUInt32LE(12)).toString());
    const bin = prepared.subarray(28 + prepared.readUInt32LE(12));
    const preparedTextures = (gltf.images ?? []).map((image) => {
        const view = gltf.bufferViews[image.bufferView],
            data = bin.subarray(view.byteOffset, view.byteOffset + view.byteLength);
        const [width, height] = imageSize(data, image.mimeType);
        return {
            name: image.name ?? 'embedded',
            width,
            height,
            bytes: view.byteLength
        };
    });
    reports.push({
        ...r,
        preparedMaterials: gltf.materials?.length ?? 0,
        preparedTextures,
        author,
        license,
        role,
        decision,
        originalFile: file,
        originalBytes: raw.length,
        sha256: crypto.createHash('sha256').update(raw).digest('hex')
    });
}
fs.writeFileSync(path.join(dir, 'catalog.json'), JSON.stringify(reports, null, 2));
const cards = reports
    .map(
        (r) =>
            `<article><img src="${r.slug}.png" alt="Actual ${escape(r.slug)} geometry preview"><div><h2>${escape(r.slug)}</h2><p class="author">${escape(r.author)} · ${escape(r.license)}</p><p>${escape(r.role)}</p><dl><dt>Source dimensions (Blender XYZ)</dt><dd>${r.sourceGeometry.dimensions.map((n) => n.toFixed(3)).join(' × ')} source units</dd><dt>Triangles / candidate</dt><dd>${r.sourceGeometry.triangles.toLocaleString()} → ${r.preparedGeometry.triangles.toLocaleString()}</dd><dt>Source objects / prepared material draws</dt><dd>${r.objects.length} / ${r.preparedMaterials}</dd><dt>Textures supplied</dt><dd>${r.sourceTextures.length ? r.sourceTextures.map((t) => escape(t.name) + ' ' + t.width + '×' + t.height).join('<br>') : 'None embedded/assigned in source'}</dd><dt>Prepared texture sizes</dt><dd>${r.preparedTextures.map((t) => (t.width ? t.width + '×' + t.height : 'none')).join(', ') || 'No image textures'}</dd><dt>Archive → prepared GLB</dt><dd>${(r.originalBytes / 1048576).toFixed(2)} → ${(r.preparedBytes / 1048576).toFixed(2)} MiB</dd></dl><p class="decision">${escape(r.decision)}</p></div></article>`
    )
    .join('');
fs.writeFileSync(
    path.join(dir, 'index.html'),
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Aether Drift — asset catalog</title><style>body{margin:0;background:#09121d;color:#d9e7ee;font:15px/1.6 system-ui}main{max-width:1280px;margin:50px auto;padding:0 28px}h1{font-size:40px}header p{max-width:900px;color:#96b5c5}section{display:grid;grid-template-columns:1fr 1fr;gap:24px}article{background:#101f2e;border:1px solid #263f51;border-radius:12px;overflow:hidden}article img{width:100%;display:block}article>div{padding:24px}h2{font-size:20px;overflow-wrap:anywhere}.author{color:#7ce0c7;font-size:12px}dl{font-size:12px}dt{color:#83a0b4;margin-top:12px}dd{margin:3px 0;overflow-wrap:anywhere}.decision{color:#f3be7b;border-top:1px solid #263f51;padding-top:14px}@media(max-width:800px){section{grid-template-columns:1fr}}</style><main><header><small>AE–02 / LOCAL SOURCE INSPECTION</small><h1>Fleet & Frontier Asset Catalog</h1><p>All ten supplied packages. Images are offline renders of source-derived prepared geometry, not generated artwork. Dimensions are authored source units, not claimed real-world metres. The Star Sparrow preview freezes its module assembly at frame 120 and uses a neutral geometry shader. Selection favors readable silhouettes, working PBR maps, verified usage terms and bounded draw/texture budgets.</p><p>Original archives stay in assets-source; only seven curated, self-contained GLBs enter public/models. Source hash, object list and texture details: <a href="catalog.json">machine-readable catalog</a>. Runtime calibration and real game screenshots are recorded in the parent verification report.</p></header><section>${cards}</section></main></html>`
);
const rows = reports
    .map(
        (r) =>
            `| ${r.slug} | ${r.sourceGeometry.triangles.toLocaleString()} → ${r.preparedGeometry.triangles.toLocaleString()} | ${r.preparedMaterials} | ${(r.preparedBytes / 1048576).toFixed(2)} MiB | ${r.decision} |`
    )
    .join('\n');
fs.writeFileSync(
    path.join(dir, 'CATALOG.md'),
    `# Local model catalog\n\nOpen [visual catalog](index.html). All 10 source packages were extracted and inspected; no original source was changed. See catalog.json for exact dimensions, original texture resolutions, source names and SHA-256 hashes.\n\n| Model | Source → prepared triangles | Prepared material draws | GLB size | Decision |\n| --- | --- | --- | --- | --- |\n${rows}\n\nTriangle/texture optimization is performed offline. The original NASA GLB is Draco-compressed; the shipped copy is decoded and simplified, with identical source material slots merged. The station's hundreds of objects were consolidated into five material primitives. Source PBR maps were relinked where FBX assignments were missing. GLBs retain embedded PNG images and need no external decoders. Catalog-only candidates are never requested by the game.\n`
);
console.log('Catalog: ' + reports.length + ' assets');
