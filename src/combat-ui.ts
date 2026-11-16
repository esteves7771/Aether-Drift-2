import { Quat, Vec3 } from 'playcanvas';
import type { Entity } from 'playcanvas';

import { ARCADE } from './arcade-config';
import { Artillery } from './artillery';
import type { Combat } from './combat';
import { COMBAT } from './combat-config';
import { BLASTS } from './explosion-config';
import { Guardian } from './guardian';
import { Phantom } from './phantom';
export class CombatHUD {
    private lastHits = 0;
    private readonly markers: HTMLElement[] = [];
    private readonly labels: HTMLElement[] = [];
    private readonly bars: HTMLMeterElement[] = [];
    private readonly stats: HTMLElement;
    private readonly banner: HTMLElement;
    private readonly shield: HTMLMeterElement;
    private readonly direction: HTMLElement;
    private readonly flash: HTMLElement;
    private readonly telemetry: HTMLElement;
    private readonly point = new Vec3();
    private readonly local = new Vec3();
    private readonly inverse = new Quat();
    constructor() {
        document.body.insertAdjacentHTML(
            'beforeend',
            `<aside id="combat-stats"><small>COMBAT LINK</small><strong id="score">000000</strong><div id="flow"><b id="flow-multiplier">×1.0</b><span id="flow-chain">COMBAT FLOW</span></div><meter id="flow-meter" min="0" max="${ARCADE.flow.window}"></meter><span id="challenge-status"></span><span id="wave-status">WAVE 01 / INBOUND</span></aside><div id="wave-banner"></div><div id="damage-direction">▼</div><div id="shield-impact"></div><small id="combat-perf"></small><div id="targets"></div><div id="score-feedback" hidden><strong></strong><span></span></div><aside id="abilities"><span id="missile-ammo"></span><span id="emp-status"></span><span id="evasion-status"></span><span id="storm-status"></span><meter id="storm-charge" min="0" max="45" value="0"></meter><span id="target-status" role="status"></span></aside><aside id="boss-bar" hidden><small id="boss-name">CAPITAL SHIP / DREADNOUGHT</small><strong id="boss-phase"></strong><meter id="boss-health" min="0" max="1"></meter><span id="boss-attack"></span><div id="dual-boss" hidden><small id="dual-name"></small><meter id="dual-health" min="0" max="1"></meter><span id="dual-attack"></span></div></aside>`
        );
        const integrity = document.querySelector('.integrity')!;
        integrity.insertAdjacentHTML(
            'afterbegin',
            `<label>SHIELD <b id="shield-number">70</b></label><meter id="shield" min="0" max="70" value="70"></meter>`
        );
        const el = (id: string) => document.getElementById(id)!;
        this.stats = el('wave-status');
        this.banner = el('wave-banner');
        this.shield = el('shield') as HTMLMeterElement;
        this.direction = el('damage-direction');
        this.flash = el('shield-impact');
        this.telemetry = el('combat-perf');
        for (let i = 0; i < 58; i++) {
            const marker = document.createElement('div');
            marker.className = 'enemy-marker';
            marker.dataset.id = String(i);
            marker.innerHTML = '<i>◇</i><span></span><meter min="0" max="100"></meter>';
            el('targets').append(marker);
            this.markers.push(marker);
            this.labels.push(marker.querySelector('span')!);
            this.bars.push(marker.querySelector('meter')!);
            marker.hidden = true;
        }
    }
    update(combat: Combat, camera: Entity, effects: number) {
        const w = window.innerWidth,
            h = window.innerHeight,
            focal = h / (2 * Math.tan((camera.camera!.fov * Math.PI) / 360));
        this.inverse.copy(camera.getRotation()).invert();
        const cockpit = document.body.classList.contains('cockpit-view'),
            minY = cockpit ? h * 0.14 : 105,
            maxY = cockpit ? h * 0.52 : h - 100;
        for (const e of combat.targets) {
            const marker = this.markers[e.id];
            marker.hidden =
                !e.active ||
                (e.targetRole === 'boss' && combat.allBosses.some((b) => b.arriving && b.parts.some((p) => p === e))) ||
                (e.id >= 40 && combat.selected !== e.id) ||
                (((e.id >= 16 && e.id < 22) || (e.id >= 30 && e.id < 40)) &&
                    e.position.distance(combat.ship.position) > 450);
            if (marker.hidden) continue;
            this.point.sub2(e.position, camera.getPosition());
            this.inverse.transformVector(this.point, this.local);
            let x = w / 2 + (this.local.x / Math.max(0.01, -this.local.z)) * focal,
                y =
                    (h / 2) * (1 + camera.camera!.projectionMatrix.data[9]) -
                    (this.local.y / Math.max(0.01, -this.local.z)) * focal;
            const off = this.local.z >= 0 || x < 65 || x > w - 65 || y < minY || y > maxY;
            if (off) {
                const dx = this.local.x,
                    dy = -this.local.y;
                const angle = Math.atan2(dy, Math.abs(dx) + Math.abs(dy) < 0.01 ? -1 : dx);
                const radius = Math.min(
                    (w / 2 - 65) / Math.max(0.01, Math.abs(Math.cos(angle))),
                    (h / 2 - 105) / Math.max(0.01, Math.abs(Math.sin(angle)))
                );
                x = w / 2 + Math.cos(angle) * radius;
                y = h / 2 + Math.sin(angle) * radius;
                marker.style.setProperty('--angle', `${(angle * 180) / Math.PI}deg`);
            }
            if (cockpit && off) y = Math.max(minY, Math.min(maxY, y));
            marker.style.transform = `translate(${x}px,${y}px)`;
            marker.dataset.capital = String(
                e.targetRole === 'boss' && e.id === combat.boss.parts[combat.boss.parts.length - 1].id
            );
            marker.classList.toggle('offscreen', off);
            marker.classList.toggle(
                'charging-threat',
                'attackCue' in e ? Boolean(e.attackCue) : combat.boss.charge > 0
            );
            marker.classList.toggle('label-left', x > w * 0.65);
            marker.classList.toggle('locked', combat.selected === e.id);
            marker.classList.toggle('heavy', e.label.includes('HEAVY') || e.label.includes('ELITE'));
            marker.classList.toggle('armored', !e.targetable);
            marker.dataset.health = String(e.health);
            marker.dataset.state =
                'state' in e
                    ? String(e.state)
                    : combat.boss.arriving
                      ? 'arrival'
                      : e.targetable
                        ? 'exposed'
                        : 'armored';
            marker.dataset.kind = 'kind' in e ? String(e.kind) : 'boss';
            marker.classList.toggle('boss-component', !('kind' in e) && (e.id < 15 || (e.id >= 22 && e.id <= 28)));
            marker.dataset.elite = String('elite' in e && e.elite);
            const distance = Math.round(this.point.sub2(e.position, combat.ship.position).length());
            this.labels[e.id].textContent =
                `${e.label}${'warmup' in e && e.warmup ? ' / PREPARING' : ''}${e.targetable ? '' : ' / ARMORED'} · ${distance} m · ${Math.max(0, Math.ceil((e.health / e.maxHealth) * 100))}%`;
            this.bars[e.id].value = (e.health / e.maxHealth) * 100;
        }
        (document.getElementById('shield') as HTMLMeterElement).max = combat.ship.shieldCapacity;
        document.getElementById('score')!.textContent = String(combat.score).padStart(6, '0');
        document.getElementById('flow-multiplier')!.textContent = '×' + combat.flow.multiplier.toFixed(1);
        document.getElementById('flow-chain')!.textContent = combat.flow.chain
            ? combat.flow.chain + ' CHAIN'
            : 'COMBAT FLOW';
        (document.getElementById('flow-meter') as HTMLMeterElement).value = combat.flow.activity;
        document.getElementById('challenge-status')!.textContent =
            combat.challenge.enabled && combat.challenge.wave > 0
                ? combat.challenge.resolved
                    ? combat.challenge.completed
                        ? 'CHALLENGE COMPLETE / +' + ARCADE.scoring.challenge
                        : 'CHALLENGE CLOSED'
                    : 'OPTIONAL / ' + combat.challenge.title + ' · +' + ARCADE.scoring.challenge
                : '';
        const feedback = document.getElementById('score-feedback')!;
        feedback.hidden = combat.flow.rewardTime <= 0;
        feedback.style.opacity = String(Math.min(1, combat.flow.rewardTime * 3));
        feedback.querySelector('strong')!.textContent = '+' + combat.flow.lastReward;
        feedback.querySelector('span')!.textContent = combat.flow.rewardText;
        document.getElementById('abilities')!.dataset.deployed = String(combat.fleet.deployed);
        this.stats.textContent = `WAVE ${String(Math.max(1, combat.wave)).padStart(2, '0')} / ${combat.boss.active ? 'CAPITAL CONTACT' : combat.boss.dying > 0 ? (combat.victory > 0 ? 'SECTOR SECURED' : 'CAPITAL CRITICAL') : `SQUAD ${Math.max(1, combat.director.group)}/${combat.director.groupCount} · ${combat.remaining} HOSTILES${combat.director.reserves > 0 ? ' · ' + combat.director.reserves + ' INBOUND' : ''}`}`;
        document.getElementById('missile-ammo')!.textContent = 'M / MISSILES ' + combat.ammo + ' · RMB LOCK';
        document.getElementById('emp-status')!.textContent =
            (combat.fleet.threat > 0
                ? combat.empCooldown <= 0
                    ? 'SALVO / STRAFE OR EMP · '
                    : 'SALVO / EVADE · '
                : 'G / EMP ') + (combat.empCooldown > 0 ? Math.ceil(combat.empCooldown) + 's' : 'READY · 180m');
        document.getElementById('storm-status')!.textContent =
            combat.storm.feedback > 0
                ? combat.storm.message
                : combat.storm.ready
                  ? 'V / STORM READY'
                  : 'V / STORM ' + Math.floor((combat.storm.charge / 45) * 100) + '%';
        (document.getElementById('storm-charge') as HTMLMeterElement).value = combat.storm.charge;
        document.getElementById('evasion-status')!.textContent =
            'SPACE / EVADE ' +
            (combat.ship.evasion.cooldown > 0 ? Math.ceil(combat.ship.evasion.cooldown) + 's' : 'READY');
        document.getElementById('target-status')!.textContent =
            combat.targeting.messageTime > 0 ? combat.targeting.message : '';
        document.getElementById('abilities')!.dataset.ammo = String(combat.ammo);
        document.getElementById('abilities')!.dataset.emp = String(combat.empCooldown);
        const boss = combat.boss,
            bar = document.getElementById('boss-bar')!;
        bar.hidden = !boss.active;
        const secondary = combat.allBosses.find((b) => b !== boss && b.active),
            dual = document.getElementById('dual-boss')!;
        dual.hidden = !combat.encounter.dual || (!secondary && combat.encounter.pending < 0);
        if (!dual.hidden) {
            document.getElementById('dual-name')!.textContent = secondary
                ? secondary instanceof Phantom
                    ? 'PHANTOM / SECOND CAPITAL'
                    : secondary instanceof Guardian
                      ? 'TESSER / SECOND CAPITAL'
                      : 'DREADNOUGHT / SECOND CAPITAL'
                : 'SECOND RIFT / SIGNATURE BUILDING';
            (document.getElementById('dual-health') as HTMLMeterElement).value = secondary
                ? secondary.health / secondary.maxHealth
                : 1;
            document.getElementById('dual-attack')!.textContent = secondary
                ? secondary.arriving
                    ? 'ARRIVING'
                    : secondary.patterns.permitted
                      ? secondary.attackName
                      : 'REPOSITIONING / NEXT ATTACK'
                : 'WEAPONS HOLD';
        }
        document.getElementById('boss-name')!.textContent =
            boss instanceof Guardian
                ? 'TESSER / THE GRAVITATIONAL ARCHITECT'
                : boss instanceof Phantom
                  ? 'PHANTOM / THE RELENTLESS HUNTER'
                  : 'ARTILLERY DREADNOUGHT / HEAVY ASSAULT';
        bar.dataset.phase = String(boss.phase);
        bar.dataset.turrets = String(boss.parts.slice(0, 4).filter((p) => p.active).length);
        document.getElementById('boss-phase')!.textContent = boss.arriving
            ? 'SIGNATURE INBOUND'
            : boss.phase === 1
              ? 'I / THE HUNT — FOUR TURRETS'
              : boss.phase === 2
                ? 'II / CROSSFIRE — CYCLING COOLANT'
                : 'III / CRITICAL OVERLOAD';
        if (boss instanceof Phantom)
            document.getElementById('boss-phase')!.textContent = boss.arriving
                ? 'PHANTOM SIGNATURE / APPROACH'
                : boss.phase === 1
                  ? 'I / HUNTER'
                  : boss.phase === 2
                    ? 'II / EVASIVE PREDATOR'
                    : 'III / RELENTLESS ASSAULT';
        if (boss instanceof Guardian)
            document.getElementById('boss-phase')!.textContent = boss.arriving
                ? 'TESSER INBOUND / ENGINE FLARE'
                : boss.phase === 1
                  ? 'I / GEOMETRIC CONTROL'
                  : boss.phase === 2
                    ? 'II / SPATIAL COMPRESSION'
                    : 'III / SINGULARITY OVERDRIVE';
        if (boss instanceof Artillery) {
            document.getElementById('boss-phase')!.textContent = boss.arriving
                ? 'GRAVITATIONAL ARRIVAL'
                : boss.phase === 1
                  ? 'I / ARMAMENT — FOUR BATTERIES'
                  : boss.phase === 2
                    ? 'II / VENTING — COOLANT MANIFOLDS'
                    : 'III / REACTOR OVERLOAD';
        }
        (document.getElementById('boss-health') as HTMLMeterElement).value = boss.health / boss.maxHealth;
        document.getElementById('boss-attack')!.textContent = boss.arriving
            ? boss instanceof Artillery
                ? 'GRAVITATIONAL RIFT / ' + boss.arrival.stage.toUpperCase() + ' — KEEP CLEAR'
                : 'CAPITAL SIGNATURE / WEAPONS ARMING'
            : boss.disrupted > 0
              ? 'SYSTEMS DISRUPTED'
              : boss.charge > 0
                ? '⚠ ' + boss.attackName + ' — EVADE'
                : boss.grace > 0
                  ? 'ARMOR SHIFT / STAND BY'
                  : boss instanceof Guardian
                    ? boss.phase === 1
                        ? 'BREAK WEAPON BANKS / DODGE LOCKED VOLLEYS'
                        : boss.phase === 2
                          ? 'CAPACITORS EXPOSED / WATCH THE OVERLOAD FAN'
                          : 'REACTOR EXPOSED / KEEP MOVING'
                    : boss instanceof Phantom
                      ? boss.phase === 3
                          ? 'EXPOSED CORE / PRESS THE ATTACK'
                          : 'TRACK THE HULL / WATCH FOR CHARGE'
                      : 'AMBER COMPONENTS ARE VULNERABLE';
        if (!boss.arriving && boss.grace <= 0 && boss.disrupted <= 0) {
            document.getElementById('boss-attack')!.textContent =
                boss.patterns.state === 'recover'
                    ? 'RECOVERY / EXPOSED SYSTEMS — ATTACK'
                    : (boss.patterns.state === 'telegraph' ? '⚠ ' : '') +
                      boss.attackName +
                      ' / ' +
                      boss.patterns.spec.hint;
        }
        this.banner.textContent =
            combat.remaining === 0
                ? combat.wave > 0
                    ? `WAVE ${combat.wave} CLEAR — NEXT IN ${Math.max(1, Math.ceil(combat.countdown))}`
                    : 'CONTACTS INBOUND'
                : '';
        if (combat.enemies.some((e) => e.active && e.arrival > 0))
            this.banner.textContent = 'DISTANT SIGNATURES / FORMATION APPROACHING';
        if (combat.victory > 0)
            this.banner.textContent = `${boss instanceof Guardian ? 'TESSER NEUTRALIZED' : boss instanceof Phantom ? 'PHANTOM NEUTRALIZED' : 'CAPITAL SHIP DESTROYED'} / +${combat.bossReward} · SECTOR SECURED`;
        else if (combat.remaining === 0 && combat.director.stage === 'regroup')
            this.banner.textContent =
                'SQUADRON ' + combat.director.group + ' CLEAR / REINFORCEMENTS IN ' + Math.ceil(combat.countdown);
        if (combat.boss.dying > 0 && combat.victory <= 0)
            this.banner.textContent =
                boss instanceof Guardian
                    ? 'TESSER ENERGY OVERLOAD / KEEP CLEAR'
                    : boss instanceof Phantom
                      ? 'PHANTOM ENGINE CRITICAL / KEEP CLEAR'
                      : 'CAPITAL REACTOR CRITICAL / KEEP CLEAR';
        this.banner.classList.toggle('complete', combat.wave > 0 && combat.remaining === 0);
        document.querySelector('.reticle')!.classList.toggle('hit', combat.playerHits > this.lastHits);
        this.lastHits = combat.playerHits;
        this.shield.value = combat.ship.shield;
        document.getElementById('shield-number')!.textContent = String(Math.ceil(combat.ship.shield));
        this.flash.style.opacity = String(combat.shieldHit ? combat.damageFlash * 0.22 : 0);
        this.direction.style.opacity = String(combat.damageFlash);
        if (combat.damageFlash > 0) {
            this.point.sub2(combat.damageSource, combat.ship.position);
            this.inverse.transformVector(this.point, this.local);
            // A nearly axial hit still distinguishes front (top) from rear (bottom).
            const angle = Math.atan2(this.local.x, this.local.y - this.local.z * 0.3);
            this.direction.style.transform = `translate(-50%,-50%) rotate(${angle}rad)`;
            this.direction.style.color = combat.shieldHit ? '#72cfff' : '#ff527c';
        }
        let bolts = 0;
        for (const p of combat.projectiles.items) if (p.active) bolts++;
        this.telemetry.textContent = `LASERS ${bolts}/${COMBAT.projectileCapacity} · FX ${effects}/${COMBAT.effectCapacity + BLASTS.capacity}`;
        this.telemetry.dataset.kills = String(combat.kills);
        this.telemetry.dataset.playerHits = String(combat.playerHits);
        this.telemetry.dataset.enemyHits = String(combat.enemyHits);
        this.telemetry.dataset.wave = String(combat.wave);
        this.telemetry.dataset.projectiles = String(bolts);
    }
}
