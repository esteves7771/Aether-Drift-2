// Lossless geometry; re-encode supplied maps to browser-sized 8-bit PNG/JPEG. No runtime decoder.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const slug = process.argv[2] ?? 'space-voyage';
const source = `.local-tools/model-candidates/${slug}.glb`;
const bytes = fs.readFileSync(source),
    jsonLength = bytes.readUInt32LE(12),
    json = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength)),
    binary = bytes.subarray(28 + jsonLength);
const scratch = `.local-tools/${slug}-textures`;
fs.mkdirSync(scratch, { recursive: true });
const ffmpeg = process.argv[3] ?? '.local-tools/ffmpeg/ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe';
const replacement = new Map();
for (const [i, image] of json.images.entries()) {
    const view = json.bufferViews[image.bufferView],
        input = path.join(scratch, `${i}-source.png`),
        jpeg = /base.?color|albedo/i.test(image.name),
        output = path.join(scratch, `${i}-prepared.${jpeg ? 'jpg' : 'png'}`);
    fs.writeFileSync(input, binary.subarray(view.byteOffset, view.byteOffset + view.byteLength));
    execFileSync(ffmpeg, [
        '-y',
        '-nostdin',
        '-loglevel',
        'error',
        '-i',
        input,
        '-frames:v',
        '1',
        '-pix_fmt',
        'rgb24',
        ...(jpeg ? ['-q:v', '2'] : ['-compression_level', '9']),
        '-update',
        '1',
        output
    ]);
    replacement.set(image.bufferView, fs.readFileSync(output));
    image.mimeType = jpeg ? 'image/jpeg' : 'image/png';
}
const chunks = [];
let offset = 0;
for (const [i, view] of json.bufferViews.entries()) {
    const data = replacement.get(i) ?? binary.subarray(view.byteOffset, view.byteOffset + view.byteLength);
    view.byteOffset = offset;
    view.byteLength = data.length;
    chunks.push(data);
    offset += data.length;
    const pad = (4 - (offset % 4)) % 4;
    if (pad) {
        chunks.push(Buffer.alloc(pad));
        offset += pad;
    }
}
json.buffers[0].byteLength = offset;
let text = JSON.stringify(json);
text += ' '.repeat((4 - (Buffer.byteLength(text) % 4)) % 4);
const jsonBytes = Buffer.from(text),
    header = Buffer.alloc(20),
    binHeader = Buffer.alloc(8);
header.writeUInt32LE(0x46546c67);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + jsonBytes.length + offset, 8);
header.writeUInt32LE(jsonBytes.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
binHeader.writeUInt32LE(offset);
binHeader.writeUInt32LE(0x004e4942, 4);
const output = `public/models/${slug}.glb`;
fs.writeFileSync(output, Buffer.concat([header, jsonBytes, binHeader, ...chunks]));
console.log(
    JSON.stringify({
        output,
        bytes: fs.statSync(output).size,
        images: json.images.length,
        materials: json.materials.length
    })
);
