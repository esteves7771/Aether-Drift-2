import type { Entity } from 'playcanvas';

import { AVAILABLE_SHIPS } from './distribution';
import type { ModelLibrary } from './model-library';
import { ShipRoster } from './ship-roster';
import type { PlayerShip } from './thruster-state';
/** One selection authority and a bounded model cache below the shared simulation root. */
export class ShipHangar {
    selected: PlayerShip = 'classic';
    private desired: PlayerShip = 'classic';
    private readonly visuals = new Map<PlayerShip, Entity>();
    private readonly loading = new Map<PlayerShip, Promise<void>>();
    private playing = false;
    setPlaying(value: boolean) {
        this.playing = value;
        for (const key of AVAILABLE_SHIPS)
            (document.getElementById('ship-' + key) as HTMLButtonElement).disabled = value;
    }
    private closed = false;
    private readonly library: ModelLibrary;
    private readonly ship: Entity;
    private readonly panel: HTMLElement;
    private readonly status: HTMLElement;
    readonly roster: ShipRoster;
    private readonly events = new AbortController();
    constructor(library: ModelLibrary, ship: Entity) {
        this.library = library;
        this.ship = ship;
        this.visuals.set('classic', ship.children[0] as Entity);
        document
            .querySelector('#roster-slot')!
            .insertAdjacentHTML(
                'beforeend',
                `<div id="ship-hangar"><small>▪ PATROL ROSTER <em>/ AVAILABLE SHIPS</em></small><div>${AVAILABLE_SHIPS.map((key, i) => `<button id="ship-${key}" type="button" aria-pressed="${i === 0}"><img src="${import.meta.env.BASE_URL}images/menu-${key}.webp" alt="${key} spacecraft"><b>${key === 'classic' ? 'AE-01' : key.toUpperCase()}</b><span>${key === 'classic' ? 'INTERCEPTOR' : key === 'surveyor' ? 'EXPLORER' : 'STRIKER'}</span></button>`).join('')}</div><p id="ship-status" role="status">AE–01 READY</p></div>`
            );
        this.panel = document.getElementById('ship-hangar')!;
        this.status = document.getElementById('ship-status')!;
        this.roster = new ShipRoster(this.panel.querySelector('div')!);
        for (const key of AVAILABLE_SHIPS)
            document
                .getElementById('ship-' + key)!
                .addEventListener('click', () => void this.choose(key), { signal: this.events.signal });
        try {
            const saved = localStorage.getItem('aether-drift-2-ship');
            if ((saved === 'surveyor' || saved === 'ptah') && AVAILABLE_SHIPS.includes(saved)) {
                if (saved === 'ptah') {
                    this.roster.pages.page = 1;
                    this.roster.render();
                }
                void this.choose(saved);
            }
        } catch {
            /* Storage is optional. */
        }
    }
    private apply() {
        for (const [key, e] of this.visuals) e.enabled = key === this.selected;
        for (const key of AVAILABLE_SHIPS)
            document.getElementById('ship-' + key)!.setAttribute('aria-pressed', String(key === this.selected));
        const label =
            this.selected === 'classic'
                ? 'AE-01 / INTERCEPTOR'
                : this.selected === 'surveyor'
                  ? 'SURVEYOR / EXPLORER'
                  : 'PTAH / STRIKER';
        this.status.textContent =
            (this.selected === 'classic' ? 'AE–01' : this.selected.toUpperCase()) +
            ' READY / ' +
            (this.selected === 'classic' ? 'INTERCEPTOR' : this.selected === 'surveyor' ? 'EXPLORER' : 'STRIKER');
        const caption = document.querySelector('.ship-index');
        if (caption) caption.textContent = label;
        try {
            localStorage.setItem('aether-drift-2-ship', this.selected);
        } catch {
            /* Storage is optional. */
        }
    }
    chooseClassic() {
        void this.choose('classic');
    }
    chooseAlternate() {
        return this.choose('surveyor');
    }
    async choose(key: PlayerShip) {
        if (this.playing || !AVAILABLE_SHIPS.includes(key)) return;
        this.desired = key;
        if (this.visuals.has(key)) {
            this.selected = key;
            this.apply();
            return;
        }
        const pending = this.loading.get(key);
        if (pending) {
            await pending;
            if (this.desired === key && this.visuals.has(key) && !this.playing) {
                this.selected = key;
                this.apply();
            }
            return;
        }
        const launch = document.getElementById('launch') as HTMLButtonElement;
        launch.disabled = true;
        this.status.textContent = 'PREPARING ' + key.toUpperCase() + '…';
        const load = (async () => {
            const ok = await this.library.load(key === 'ptah' ? 'ptah' : 'surveyor');
            if (this.closed) return;
            if (ok) {
                const e = this.library.create(key === 'ptah' ? 'ptah' : 'surveyor');
                if (e) {
                    this.ship.addChild(e);
                    this.visuals.set(key, e);
                    e.enabled = false;
                }
            }
            if (this.desired === key && this.visuals.has(key) && !this.playing) {
                this.selected = key;
                this.apply();
            } else if (!ok && this.desired === key) this.status.textContent = key.toUpperCase() + ' UNAVAILABLE';
            this.loading.delete(key);
            launch.disabled = this.loading.size > 0;
        })();
        this.loading.set(key, load);
        await load;
    }
    destroy() {
        this.closed = true;
        this.events.abort();
        this.roster.destroy();
        for (const [key, e] of this.visuals) if (key !== 'classic') e.destroy();
        this.panel.remove();
    }
}
