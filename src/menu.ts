import { version } from '../package.json';

import { ARCADE } from './arcade-config';
import type { Settings } from './config';
import { menuIcon } from './menu-icons';
import type { Records, RecordName, RunSummary } from './records';
type Screen = 'home' | 'pause' | 'records' | 'settings' | 'credits' | 'debrief' | 'flight';
const format = (n: number) => Math.round(n).toLocaleString('en-US');
const clock = (n: number | null) =>
    n === null ? '—' : `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
/** DOM presentation only. Reuses the existing settings widgets and their audio bindings. */
export class Menu {
    screen: Screen = 'home';
    private parent: Screen = 'home';
    private readonly panel = document.getElementById('menu')!;
    private readonly heading = document.getElementById('menu-heading')!;
    private readonly events = new AbortController();
    private readonly records: Records;
    constructor(settings: Settings, records: Records, mainMenu: () => void, retry: () => void) {
        this.records = records;
        this.panel.setAttribute('aria-labelledby', 'menu-heading');
        const el = (id: string) => document.getElementById(id)!;
        const launch = el('launch'),
            restart = el('restart'),
            details = this.panel.querySelector('details')!;
        details.open = true;
        this.panel.querySelector('.menu-card')!.innerHTML =
            `<div class="menu-topline"><span><i></i> PERSEID DEFENSE NETWORK</span><button id="menu-back" hidden>← BACK</button></div><p class="eyebrow" id="menu-kicker">ARCADE PATROL / VOL. 05</p><div id="title-slot"></div>
        <section id="home-panel"><p class="intro">One ship. An unforgiving frontier.<br>Chain your kills. Own the expanse.</p><div class="menu-actions" id="action-slot"></div><div class="menu-links"><button id="show-records">RECORDS <span>01</span></button><button id="show-settings">SETTINGS <span>02</span></button></div><button id="end-patrol" class="quiet" hidden>END PATROL & DEBRIEF</button><div class="patrol-brief"><small>YOUR FLIGHT PLAN</small><p>Survive four patrol waves. Break the capital ship at Wave 5. Keep the streak alive.</p><div><span id="home-best"></span><b>6DOF / SOLO</b></div></div></section>
        <section id="records-panel" hidden><p class="intro">Your frontier. Your benchmark.</p><div id="record-grid" class="stat-grid"></div><div id="best-run" class="record-note"></div><p id="record-storage" class="controls"></p></section>
        <section id="settings-panel" hidden><div id="settings-slot"></div><label class="challenge-option">Optional wave challenges <input id="challenges" type="checkbox" ${settings.challenges ? 'checked' : ''}></label><label>Camera & peripheral speed cues <input id="cameraEffects" type="checkbox" ${settings.cameraEffects ? 'checked' : ''}></label><p class="controls">FLOW / +${ARCADE.flow.step} every ${ARCADE.flow.killsPerStep} kills, up to ×${ARCADE.flow.maximum}. Hit an exposed target within ${ARCADE.flow.window} seconds to maintain Flow. Shield hits lower it one step; hull hits break the chain. Recovery and protected boss phases freeze the timer. Clean kills (+${ARCADE.scoring.clean}): no damage since your last kill. Boost kills: +${ARCADE.scoring.boost}. Bonuses are multiplied.</p><p class="controls">BASE POINTS / Interceptor ${ARCADE.scoring.interceptor} · Heavy ${ARCADE.scoring.heavy} · Elite ${ARCADE.scoring.elite}<br>Boss turret ${ARCADE.scoring.turret} · Capital victory ${ARCADE.scoring.boss}<br>Challenge preference applies at the next wave; failure never blocks progression.</p></section>
        <section id="debrief-panel" hidden><p class="intro" id="run-verdict"></p><div id="run-grid" class="stat-grid"></div><p id="run-records" role="status"></p><div class="debrief-actions"><button id="retry" class="primary">RETRY PATROL ↗</button><button id="return-home" class="secondary">MAIN MENU</button></div></section><p class="build">AD–02 / LOCAL FLIGHT RECORDS / NO SIGNAL REQUIRED</p>`;
        el('title-slot').append(this.heading);
        this.panel
            .querySelector('.menu-card')!
            .insertAdjacentHTML(
                'afterbegin',
                '<svg class="command-frame" viewBox="0 0 600 1000" preserveAspectRatio="none" aria-hidden="true"><path d="M200 5H38L5 38V185L27 212V330L5 355V670L25 695V935L60 975H170L178 970H367L377 960H579L596 942V782L568 754H550V256L505 212H370"/><path d="M5 120V40L32 12H96M5 925V968L35 997H555L595 958"/></svg>'
            );
        el('action-slot').append(launch, restart);
        el('home-panel').insertAdjacentHTML(
            'afterbegin',
            `<div class="command-logo" aria-label="Aether Drift 2.0"><strong>AETHER</strong><span>DRIFT / 2.0</span></div><div class="command-sector"><i></i><div>PERSEID EXPANSE<small>COMBAT PATROL</small></div><b>///</b></div>`
        );
        el('show-records').innerHTML = `${menuIcon('records')}<span>RECORDS</span>`;
        el('show-settings').innerHTML = `${menuIcon('settings')}<span>SETTINGS</span>`;
        this.panel
            .querySelector('.menu-links')!
            .insertAdjacentHTML(
                'beforeend',
                `<button id="show-credits">${menuIcon('info')}<span>CREDITS</span></button>`
            );
        el('home-panel').insertAdjacentHTML('beforeend', '<div id="roster-slot"></div>');
        el('settings-panel').insertAdjacentHTML(
            'afterend',
            `<section id="credits-panel" hidden><p class="intro">AETHER DRIFT / 2.0</p><p>Independent arcade space combat by Pedro Esteves.</p><p>Built with PlayCanvas Engine, TypeScript and Vite.</p><nav class="credits-links"><a href="${import.meta.env.BASE_URL}MODEL_CREDITS.md" target="_blank" rel="noopener">MODEL SOURCES & LICENSES ↗</a><a href="${import.meta.env.BASE_URL}MUSIC_CREDITS.md" target="_blank" rel="noopener">MUSIC SOURCES & LICENSES ↗</a></nav><p class="controls">Third-party works retain their individual licenses. Full attribution is provided in the linked records.</p></section>`
        );
        this.panel.insertAdjacentHTML(
            'beforeend',
            `<div class="command-status"><div>${menuIcon('ship')}<span><small>SELECTED SHIP</small><b class="ship-index">AE-01 / INTERCEPTOR</b></span></div><div>${menuIcon('records')}<span><small>PERSONAL BEST</small><b id="status-best">0</b></span></div><div>${menuIcon('records')}<span><small>LONGEST WAVE</small><b id="status-wave">WAVE 0</b></span></div><div>${menuIcon('planet')}<span><small>SECTOR</small><b>PERSEID EXPANSE</b></span></div><div>${menuIcon('code')}<span><small>BUILD</small><b>v${version.replace(/(\d+)\.(\d+)\.(\d+)-([a-z]+)$/, '$1.$2$4.$3').replace(/\.0$/, '')}</b></span></div></div>`
        );
        el('show-credits').onclick = () => {
            this.parent = this.screen;
            this.show('credits');
        };
        el('settings-slot').append(details);
        this.panel.querySelector('.menu-caption')!.remove();
        el('retry').onclick = retry;
        el('return-home').onclick = mainMenu;
        el('end-patrol').onclick = mainMenu;
        el('show-records').onclick = () => {
            this.parent = this.screen;
            this.show('records');
            this.renderRecords();
        };
        el('show-settings').onclick = () => {
            this.parent = this.screen;
            this.show('settings');
        };
        el('menu-back').onclick = () => this.show(this.parent);
        el('challenges').addEventListener(
            'input',
            () => {
                settings.challenges = (el('challenges') as HTMLInputElement).checked;
                try {
                    localStorage.setItem('aether-drift-2-settings', JSON.stringify(settings));
                } catch {
                    /* Storage optional. */
                }
            },
            { signal: this.events.signal }
        );
        el('cameraEffects').addEventListener(
            'input',
            () => {
                settings.cameraEffects = (el('cameraEffects') as HTMLInputElement).checked;
                try {
                    localStorage.setItem('aether-drift-2-settings', JSON.stringify(settings));
                } catch {
                    /* Optional storage. */
                }
            },
            { signal: this.events.signal }
        );
        window.addEventListener(
            'keydown',
            (e) => {
                if (this.screen === 'flight') return;
                if (e.code === 'Escape' && ['settings', 'records', 'credits'].includes(this.screen)) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    this.show(this.parent);
                    el('launch').focus();
                    return;
                }
                if (
                    !(e.target instanceof HTMLElement) ||
                    e.target.matches('input,select,summary') ||
                    !['ArrowDown', 'ArrowUp'].includes(e.code)
                )
                    return;
                const buttons = [...this.panel.querySelectorAll<HTMLButtonElement>('button')].filter(
                        (b) => b.getClientRects().length > 0
                    ),
                    current = buttons.indexOf(document.activeElement as HTMLButtonElement);
                e.preventDefault();
                buttons[(current + (e.code === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
            },
            { capture: true, signal: this.events.signal }
        );
        this.show('home');
    }
    get homeVisible() {
        return (
            this.screen === 'home' ||
            (['settings', 'records', 'credits'].includes(this.screen) && this.parent === 'home')
        );
    }
    private show(screen: Screen) {
        this.screen = screen;
        this.panel.hidden = screen === 'flight';
        this.panel.dataset.screen = screen;
        document.body.classList.toggle('menu-open', screen !== 'flight');
        for (const id of ['home', 'records', 'settings', 'credits', 'debrief'])
            document.getElementById(id + '-panel')!.hidden = id !== (screen === 'pause' ? 'home' : screen);
        document.getElementById('menu-back')!.hidden = !['records', 'settings', 'credits'].includes(screen);
        document.getElementById('restart')!.hidden = screen !== 'pause';
        document.getElementById('end-patrol')!.hidden = screen !== 'pause';
        document.getElementById('launch')!.innerHTML =
            `${menuIcon('play')}<span>${screen === 'pause' ? 'RESUME PATROL' : 'START PATROL'}</span><b>»</b>`;
        document.getElementById('restart')!.textContent = 'RESTART PATROL';
        this.heading.textContent =
            screen === 'pause'
                ? 'Flight paused.'
                : screen === 'records'
                  ? 'Leave your mark.'
                  : screen === 'settings'
                    ? 'Make it yours.'
                    : screen === 'debrief'
                      ? 'Ship lost. Debrief.'
                      : screen === 'credits'
                        ? 'Credits.'
                        : 'Aether Drift / 2.0';
        document.getElementById('menu-kicker')!.textContent =
            screen === 'records'
                ? 'LOCAL FLIGHT ARCHIVE'
                : screen === 'settings'
                  ? 'PILOT CONFIGURATION'
                  : screen === 'debrief'
                    ? 'PATROL COMPLETE / AFTER ACTION'
                    : 'ARCADE PATROL / VOL. 05';
        document.getElementById('home-best')!.textContent = 'PERSONAL BEST / ' + format(this.records.data.highScore);
        document.getElementById('status-best')!.textContent = format(this.records.data.highScore);
        document.getElementById('status-wave')!.textContent = 'WAVE ' + this.records.data.highWave;
    }
    menu(show: boolean) {
        this.show(show ? 'pause' : 'flight');
    }
    home() {
        this.show('home');
        document.getElementById('launch')!.focus();
    }
    debrief(run: RunSummary, news: RecordName[]) {
        this.show('debrief');
        this.heading.textContent = run.ended === 'lost' ? 'Ship lost. Debrief.' : 'Patrol complete.';
        document.getElementById('run-verdict')!.textContent = run.bosses
            ? 'Capital neutralized. The frontier remembers.'
            : run.cleared
              ? 'Every wave is another lesson. Take it further.'
              : 'First contact is a first step. Find your line and fly again.';
        const cells: [string, string, RecordName?][] = [
            ['TOTAL SCORE', format(run.score), 'score'],
            ['PERSONAL BEST', format(this.records.data.highScore)],
            ['WAVES SURVIVED', String(run.cleared)],
            ['ENEMIES DESTROYED', String(run.kills)],
            ['ACCURACY', run.shots ? Math.round((run.hits / run.shots) * 100) + '%' : '—'],
            ['LONGEST COMBO', String(run.combo) + ' KILLS', 'combo'],
            [
                'BOSS RESULT',
                run.guardianBosses
                    ? clock(run.guardianTime ?? null) + ' / TESSER'
                    : run.phantomBosses
                      ? clock(run.phantomTime ?? null) + ' / PHANTOM'
                      : run.bosses
                        ? clock(run.bossTime) + ' / VICTORY'
                        : run.wave >= 5
                          ? 'CAPITAL ENGAGED'
                          : 'NOT REACHED',
                run.guardianBosses ? 'guardian' : run.phantomBosses ? 'phantom' : 'boss'
            ],
            ['FURTHEST WAVE', String(run.wave), 'wave'],
            ['CHALLENGES', String(run.challenges)],
            ['DISCOVERIES / REFITS', `${run.discoveries ?? 0} / ${run.upgrades ?? 0}`]
        ];
        document.getElementById('run-grid')!.innerHTML = cells
            .map(
                ([k, v, n]) =>
                    `<div class="${n && news.includes(n) ? 'new-record' : ''}"><small>${k}</small><strong>${v}</strong>${n && news.includes(n) ? '<em>NEW RECORD</em>' : ''}</div>`
            )
            .join('');
        document.getElementById('run-records')!.textContent = news.length
            ? 'NEW PERSONAL MILESTONES / ' + news.map((n) => n.toUpperCase()).join(' · ')
            : 'FLIGHT RECORDED / YOUR NEXT RUN STARTS HERE';
        document.getElementById('retry')!.focus();
    }
    private renderRecords() {
        const d = this.records.data;
        document.getElementById('record-grid')!.innerHTML = [
            ['HIGH SCORE', format(d.highScore)],
            ['HIGHEST WAVE', d.highWave || '—'],
            ['LONGEST COMBO', d.longestCombo + ' KILLS'],
            ['BEST CAPITAL TIME', clock(d.bestBossTime)],
            ['BEST PHANTOM TIME', clock(d.bestPhantomTime ?? null)],
            ['BEST TESSER / LEGACY GUARDIAN TIME', clock(d.bestGuardianTime ?? null)]
        ]
            .map(([k, v]) => `<div><small>${k}</small><strong>${v}</strong></div>`)
            .join('');
        document.getElementById('best-run')!.textContent = d.bestRun
            ? `BEST RUN / ${format(d.bestRun.score)} POINTS · WAVE ${d.bestRun.wave} · ${d.bestRun.kills} HOSTILES · ${clock(d.bestRun.duration)}`
            : 'Your first patrol writes the first entry.';
        document.getElementById('record-storage')!.textContent = this.records.available
            ? 'Stored on this browser · ' + d.runs + ' completed patrols'
            : 'Storage unavailable · records kept for this session.';
    }
    destroy() {
        this.events.abort();
    }
}
