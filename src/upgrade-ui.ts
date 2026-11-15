import { UPGRADES } from './run-upgrades';
import type { RunUpgrades } from './run-upgrades';
/** Application owns pausing; this panel only displays offers and forwards a valid choice. */
export class UpgradeUI {
    private readonly root = document.createElement('section');
    private readonly cards: HTMLButtonElement[] = [];
    private readonly events = new AbortController();
    private serial = -1;
    constructor(upgrades: RunUpgrades, choose: (index: number) => void) {
        this.root.id = 'upgrade-panel';
        this.root.hidden = true;
        this.root.setAttribute('role', 'dialog');
        this.root.setAttribute('aria-modal', 'true');
        this.root.innerHTML =
            '<div class="upgrade-card"><small>FIELD REFIT / RUN-LOCAL</small><h2>Choose your advantage.</h2><p>Combat is paused. Select one; all upgrades reset next run.</p><div id="upgrade-options"></div></div>';
        document.body.append(this.root);
        for (let n = 0; n < 3; n++) {
            const b = document.createElement('button');
            b.type = 'button';
            b.innerHTML = '<small></small><strong></strong><span></span>';
            this.cards.push(b);
            b.addEventListener(
                'click',
                () => {
                    const i = upgrades.offers[n];
                    if (i !== undefined) choose(i);
                },
                { signal: this.events.signal }
            );
            this.root.querySelector('#upgrade-options')!.append(b);
        }
        window.addEventListener(
            'keydown',
            (e) => {
                if (this.root.hidden || e.repeat) return;
                const n = Number(e.key) - 1;
                if (n >= 0 && n < 3) {
                    e.preventDefault();
                    const i = upgrades.offers[n];
                    if (i !== undefined) choose(i);
                }
            },
            { signal: this.events.signal }
        );
    }
    update(u: RunUpgrades) {
        this.root.hidden = !u.pending;
        if (!u.pending || this.serial === u.milestone) return;
        this.serial = u.milestone;
        this.cards.forEach((b, n) => {
            const i = u.offers[n];
            b.hidden = i === undefined;
            if (i === undefined) return;
            b.dataset.upgrade = String(i);
            b.querySelector('small')!.textContent = `${n + 1} / RANK ${u.ranks[i] + 1} OF ${UPGRADES[i].maximum}`;
            b.querySelector('strong')!.textContent = UPGRADES[i].name;
            b.querySelector('span')!.textContent = UPGRADES[i].detail;
        });
        this.cards[0].focus();
    }
    reset() {
        this.serial = -1;
        this.root.hidden = true;
    }
    destroy() {
        this.events.abort();
        this.root.remove();
    }
}
