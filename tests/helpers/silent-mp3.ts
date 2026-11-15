/** Self-generated MPEG-1 Layer III silence, test-only. No copyrighted replacement music. */
export function silentMp3(frames = 500) {
    const body = Buffer.alloc(417 * frames);
    for (let i = 0; i < frames; i++) body.set([0xff, 0xfb, 0x90, 0x00], i * 417);
    return body;
}
