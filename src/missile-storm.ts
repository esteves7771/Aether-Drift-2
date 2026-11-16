import { BULLETHELL } from './bullethell-config';
import type { CombatTarget } from './combat-target';
import type { Flight } from './flight';
import type { Missiles } from './missiles';
/** Fixed six-slot launch plan. Each acquired ID/generation is immutable for its missile. */
export class MissileStorm {
    charge = 0;
    pending = 0;
    fired = 0;
    feedback = 0;
    message = 'CHARGING';
    private clock = 0;
    private cursor = 0;
    private readonly ids = new Int16Array(BULLETHELL.storm.missiles);
    private readonly generations = new Uint32Array(BULLETHELL.storm.missiles);
    private readonly choices: CombatTarget[] = [];
    get ready() {
        return this.charge >= BULLETHELL.storm.charge && this.pending === 0;
    }
    reset(missiles: Missiles) {
        this.charge = this.pending = this.fired = this.feedback = this.clock = this.cursor = 0;
        this.choices.length = 0;
        missiles.reserved = 0;
        this.message = 'CHARGING';
    }
    cancel(missiles: Missiles) {
        this.pending = 0;
        this.clock = 0;
        missiles.reserved = 0;
        for (const m of missiles.items) if (m.storm) m.active = false;
    }
    activate(ship: Flight, targets: readonly CombatTarget[], selected: number, missiles: Missiles) {
        if (!this.ready || ship.hull <= 0) return false;
        this.choices.length = 0;
        const eligible = (t: CombatTarget) =>
            t.active &&
            t.targetable &&
            t.health > 0 &&
            (t.targetRole === 'craft' || t.targetRole === 'boss') &&
            t.position.distance(ship.position) <= BULLETHELL.storm.range;
        const explicit = targets.find((t) => t.id === selected && eligible(t));
        if (explicit) this.choices.push(explicit);
        for (const role of ['craft', 'boss'])
            for (let slot = this.choices.length; slot < BULLETHELL.storm.missiles; slot++) {
                let best: CombatTarget | undefined,
                    distance = Infinity;
                for (const t of targets) {
                    if (t.targetRole !== role || !eligible(t) || this.choices.includes(t)) continue;
                    const d = t.position.distance(ship.position);
                    if (d < distance) {
                        distance = d;
                        best = t;
                    }
                }
                if (!best) break;
                this.choices.push(best);
            }
        if (!this.choices.length) {
            this.message = 'NO HOSTILE LOCK';
            this.feedback = 1.5;
            return false;
        }
        if (missiles.items.filter((m) => !m.active).length < BULLETHELL.storm.missiles) {
            this.message = 'LAUNCHERS BUSY';
            this.feedback = 1.5;
            return false;
        }
        for (let i = 0; i < this.ids.length; i++) {
            const t = this.choices[i % this.choices.length];
            this.ids[i] = t.id;
            this.generations[i] = t.generation ?? 0;
        }
        this.charge = 0;
        this.pending = this.ids.length;
        this.cursor = 0;
        this.clock = 0.2;
        this.message = 'MISSILE STORM';
        this.feedback = 1.2;
        missiles.reserved = this.pending;
        return true;
    }
    step(dt: number, ship: Flight, targets: readonly CombatTarget[], missiles: Missiles, launch: () => void) {
        if (dt <= 0) return;
        if (ship.hull <= 0) {
            this.cancel(missiles);
            return;
        }
        this.charge = Math.min(BULLETHELL.storm.charge, this.charge + dt);
        if (BULLETHELL.storm.charge - this.charge < 1e-7) this.charge = BULLETHELL.storm.charge;
        this.feedback = Math.max(0, this.feedback - dt);
        if (!this.pending) return;
        this.clock -= dt;
        while (this.pending > 0 && this.clock <= 0) {
            const i = this.cursor++,
                t = targets.find((t) => t.id === this.ids[i]);
            this.pending--;
            missiles.reserved = Math.max(0, missiles.reserved - 1);
            if (
                t?.active &&
                t.targetable &&
                (t.generation ?? 0) === this.generations[i] &&
                missiles.launch(ship, t, true, i)
            ) {
                this.fired++;
                launch();
            }
            this.clock += BULLETHELL.storm.interval;
        }
    }
}
