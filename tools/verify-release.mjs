import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const digest = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function files(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const file = path.join(dir, e.name);
        assert.ok(!e.isSymbolicLink(), 'No deploy symlinks: ' + file);
        return e.isDirectory() ? files(file) : [file];
    });
}
const publicDir = fileURLToPath(new URL('public/', root)),
    distDir = fileURLToPath(new URL('dist/', root));
let bytes = 0,
    count = 0;
for (const file of files(publicDir)) {
    const relative = path.relative(publicDir, file),
        output = path.join(distDir, relative);
    assert.ok(fs.existsSync(output), 'Missing deployed asset: ' + relative);
    assert.equal(digest(file), digest(output), 'Changed deployed asset: ' + relative);
    const size = fs.statSync(file).size;
    assert.ok(size < 100 * 1024 * 1024, 'GitHub file size limit: ' + relative);
    bytes += size;
    count++;
}
const index = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
assert.ok(index.includes('/Aether-Drift-2/assets/'), 'Pages subpath in built index');
const manifest = JSON.parse(fs.readFileSync(path.join(distDir, 'audio/music/manifest.json'), 'utf8'));
assert.deepEqual(Object.keys(manifest).sort(), ['boss', 'combat', 'death', 'menu']);
for (const file of Object.values(manifest))
    assert.ok(fs.statSync(path.join(distDir, 'audio/music', file)).size > 10000);
for (const file of files(path.join(distDir, 'assets')).filter((f) => f.endsWith('.js'))) {
    const source = fs.readFileSync(file, 'utf8');
    assert.ok(!source.includes('__phase4'), 'No test driver in release');
    assert.ok(!source.includes('Test pilot orientation'), 'No test pilot in release');
}
const total = files(distDir).reduce((sum, f) => sum + fs.statSync(f).size, 0);
console.log(
    JSON.stringify(
        {
            verifiedPublicFiles: count,
            publicMiB: +(bytes / 1048576).toFixed(2),
            buildMiB: +(total / 1048576).toFixed(2)
        },
        null,
        2
    )
);
