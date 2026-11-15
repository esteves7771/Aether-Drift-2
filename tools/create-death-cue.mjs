import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const input = resolve(root, 'public/audio/music/death.mp3');
const output = resolve(root, 'public/audio/music/death-cue.mp3');
const args = process.argv.slice(2);
const value = (flag) => args[args.indexOf(flag) + 1];
if (!existsSync(input)) {
    console.error('Missing public/audio/music/death.mp3. Download the specified licensed track first.');
    process.exit(1);
}
if (!args.includes('--start')) {
    console.error('Audition death.mp3, then choose a passage: npm run music:cue -- --start <seconds> [--duration 8]');
    process.exit(1);
}
const start = Number(value('--start')),
    duration = args.includes('--duration') ? Number(value('--duration')) : 8;
if (!Number.isFinite(start) || start < 0 || !Number.isFinite(duration) || duration < 2 || duration > 8) {
    console.error('Use a nonnegative start and a duration between 2 and 8 seconds.');
    process.exit(1);
}
const fadeOut = Math.min(2.5, duration * 0.4);
const portableRoot = resolve(root, '.local-tools/ffmpeg');
const portable = existsSync(portableRoot)
    ? readdirSync(portableRoot)
          .map((name) => resolve(portableRoot, name, 'bin/ffmpeg.exe'))
          .find((path) => existsSync(path))
    : undefined;
const executable = process.env.FFMPEG_PATH || portable || 'ffmpeg';
const result = spawnSync(
    executable,
    [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-ss',
        String(start),
        '-i',
        input,
        '-t',
        String(duration),
        '-vn',
        '-af',
        `afade=t=in:st=0:d=0.08,afade=t=out:st=${duration - fadeOut}:d=${fadeOut}`,
        '-codec:a',
        'libmp3lame',
        '-q:a',
        '3',
        output
    ],
    { stdio: 'inherit', windowsHide: true }
);
if (result.error) {
    console.error('FFmpeg with libmp3lame is required. Install it or set FFMPEG_PATH to the executable.');
    process.exit(1);
}
if (result.status !== 0) process.exit(result.status || 1);
writeFileSync(
    resolve(root, 'public/audio/music/death-cue.edit.json'),
    JSON.stringify(
        {
            source: 'death.mp3',
            sourceSha256: createHash('sha256').update(readFileSync(input)).digest('hex'),
            output: 'death-cue.mp3',
            outputSha256: createHash('sha256').update(readFileSync(output)).digest('hex'),
            startSeconds: start,
            durationSeconds: duration,
            fadeInSeconds: 0.08,
            fadeOutSeconds: fadeOut,
            codec: 'MP3 / libmp3lame',
            generatedAt: new Date().toISOString()
        },
        null,
        2
    ) + '\n'
);
console.log(
    `Created ${duration}s death-cue.mp3 with ${fadeOut}s fade-out. Original death.mp3 is unchanged. Rebuild or refresh the dev page to update the asset manifest.`
);
