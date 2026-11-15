import type { Entity } from 'playcanvas';

import type { ModelLibrary } from './model-library';
/** Two visual choices, identical simulation/muzzle/camera roots. Original fighter stays default. */
export class ShipHangar {
    selected: 'classic' | 'surveyor' = 'classic';
    private alternate?: Entity;
    private loading = false;
    private closed = false;
    private desired: 'classic' | 'surveyor' = 'classic';
    private readonly library: ModelLibrary;
    private readonly ship: Entity;
    private readonly original: Entity;
    private readonly panel: HTMLElement;
    private readonly status: HTMLElement;
    private readonly originalButton: HTMLButtonElement;
    private readonly alternateButton: HTMLButtonElement;
    private readonly events = new AbortController();
    constructor(library: ModelLibrary, ship: Entity) {
        this.library = library;
        this.ship = ship;
        this.original = ship.children[0] as Entity;
        document
            .querySelector('#home-panel .patrol-brief')!
            .insertAdjacentHTML(
                'beforebegin',
                `<div id="ship-hangar"><small>FLIGHTCRAFT / SHARED FLIGHT & WEAPONS</small><div><button id="ship-classic" type="button" aria-pressed="true">AE–01 <span>ORIGINAL FIGHTER</span></button><button id="ship-surveyor" type="button" aria-pressed="false">SURVEYOR <span>IMPORTED EXPLORER</span></button></div><p id="ship-status" role="status">AE–01 READY</p><a href="./MODEL_CREDITS.md" target="_blank" rel="noopener">MODEL CREDITS ↗</a></div>`
            );
        this.panel = document.getElementById('ship-hangar')!;
        this.status = document.getElementById('ship-status')!;
        this.originalButton = document.getElementById('ship-classic') as HTMLButtonElement;
        this.alternateButton = document.getElementById('ship-surveyor') as HTMLButtonElement;
        this.originalButton.addEventListener('click', () => this.chooseClassic(), { signal: this.events.signal });
        this.alternateButton.addEventListener('click', () => void this.chooseAlternate(), {
            signal: this.events.signal
        });
    }
    private apply() {
        this.original.enabled = this.selected === 'classic';
        if (this.alternate) this.alternate.enabled = this.selected === 'surveyor';
        this.originalButton.setAttribute('aria-pressed', String(this.selected === 'classic'));
        this.alternateButton.setAttribute('aria-pressed', String(this.selected === 'surveyor'));
        this.status.textContent =
            this.selected === 'classic' ? 'AE–01 READY' : 'SURVEYOR READY / SAME FLIGHT PERFORMANCE';
        const caption = document.querySelector('.ship-index');
        if (caption) caption.textContent = this.selected === 'classic' ? 'AE–01 / INTERCEPTOR' : 'SV–02 / SURVEYOR';
    }
    chooseClassic() {
        this.desired = 'classic';
        this.selected = 'classic';
        this.apply();
    }
    async chooseAlternate() {
        this.desired = 'surveyor';
        if (this.loading) return;
        if (this.alternate) {
            this.selected = 'surveyor';
            this.apply();
            return;
        }
        this.loading = true;
        this.alternateButton.disabled = true;
        const launch = document.getElementById('launch') as HTMLButtonElement;
        launch.disabled = true;
        this.status.textContent = 'PREPARING SURVEYOR…';
        const ok = await this.library.load('surveyor');
        if (this.closed) return;
        this.loading = false;
        this.alternateButton.disabled = false;
        launch.disabled = false;
        if (!ok) {
            this.status.textContent = 'SURVEYOR UNAVAILABLE / AE–01 REMAINS READY';
            return;
        }
        this.alternate = this.library.create('surveyor');
        if (!this.alternate) return;
        this.ship.addChild(this.alternate);
        this.selected = this.desired;
        this.apply();
    }
    destroy() {
        this.closed = true;
        this.events.abort();
        this.alternate?.destroy();
        this.panel.remove();
    }
}
