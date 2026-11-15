import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

/** @returns {import('vite').Plugin} */
export function musicManifest() {
    let root = '';
    const manifest = () => {
        const files = { menu: 'menu.mp3', combat: 'combat.mp3', boss: 'boss.mp3', death: 'death-cue.mp3' };
        return JSON.stringify(
            Object.fromEntries(
                Object.entries(files).filter(([, name]) => {
                    const path = resolve(root, 'public/audio/music', name);
                    return existsSync(path) && statSync(path).isFile() && statSync(path).size > 64;
                })
            )
        );
    };
    return {
        name: 'local-music-manifest',
        configResolved(config) {
            root = config.root;
        },
        configureServer(server) {
            server.middlewares.use((request, response, next) => {
                if (request.url?.split('?')[0] !== '/audio/music/manifest.json') {
                    next();
                    return;
                }
                response.setHeader('Content-Type', 'application/json');
                response.setHeader('Cache-Control', 'no-store');
                response.end(manifest());
            });
        },
        generateBundle() {
            this.emitFile({ type: 'asset', fileName: 'audio/music/manifest.json', source: manifest() });
        }
    };
}
