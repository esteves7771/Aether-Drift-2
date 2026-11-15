/** Small code-native line icons; no external font or asset dependency. */
export function menuIcon(kind: string) {
    const paths: Record<string, string> = {
        ship: '<path d="m12 2 3 8 7 5v3l-8-2-2 4-2-4-8 2v-3l7-5z"/>',
        play: '<path d="m6 3 15 9L6 21z"/>',
        records: '<path d="M3 21V13h4v8m3 0V8h4v13m3 0V3h4v18"/>',
        settings: '<path d="m9 3 6 0 1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z"/><circle cx="12" cy="12" r="4"/>',
        info: '<circle cx="12" cy="12" r="10"/><path d="M12 10v8m0-13v2"/>',
        planet: '<circle cx="12" cy="12" r="7"/><ellipse cx="12" cy="12" rx="13" ry="4" transform="rotate(-35 12 12)"/>',
        code: '<path d="m7 7-5 5 5 5m10-10 5 5-5 5M14 4l-4 16"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">${paths[kind] ?? paths.ship}</svg>`;
}
