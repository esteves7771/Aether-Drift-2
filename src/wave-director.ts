import type { EnemyKind } from './combat-config';
import { EVOLUTION } from './evolution-config';
import { FLEET } from './fleet-config';
import { FRONTIER } from './frontier-config';
import { bossForWave } from './guardian-config';
import { LIVING } from './living-config';
import { THREAT, wavePopulation } from './threat-config';
const TEMPLATES = [
    { name: 'INTERCEPTOR AMBUSH', roles: ['interceptor', 'interceptor', 'interceptor'], minWave: 3, weight: 2 },
    { name: 'HEAVY ESCORT', roles: ['heavy', 'interceptor', 'interceptor'], minWave: 4, weight: 2 },
    { name: 'HUNTER SQUADRON', roles: ['interceptor', 'interceptor', 'heavy'], minWave: 6, weight: 2 },
    { name: 'ARTILLERY SCREEN', roles: ['heavy', 'interceptor', 'heavy'], minWave: 8, weight: 2 },
    ...FLEET.encounters,
    ...FRONTIER.encounters
] as readonly { name: string; roles: readonly EnemyKind[]; minWave: number; weight: number }[];
export type WaveOrder = 'none' | 'squad' | 'boss';
/** Quota-based rolling reinforcement pacing. Combat commits only ships actually spawned safely. */
export class WaveDirector {
    wave = 0;
    group = 0;
    countdown = LIVING.arrival - LIVING.approach;
    stage: 'inbound' | 'engaged' | 'regroup' | 'clear' = 'inbound';
    cleared = false;
    deployed = 0;
    private pending = 0;
    private waiting = false;
    private hadEnemies = false;
    get plan() {
        return THREAT.early[Math.min(3, Math.max(0, this.wave - 1))];
    }
    get total() {
        return bossForWave(this.wave) ? 0 : wavePopulation(this.wave);
    }
    get activeLimit() {
        return this.wave <= 4
            ? this.plan.active
            : Math.min(THREAT.late.activeLimit, 4 + Math.floor(Math.max(0, this.wave - 6) / 3));
    }
    get batch() {
        return this.wave <= 4 ? this.plan.batch : THREAT.late.batch;
    }
    get attackers() {
        return this.wave <= 4
            ? this.plan.attackers
            : Math.min(THREAT.late.attackers, 4 + Math.floor(Math.max(0, this.wave - 6) / 3));
    }
    get reinforcementDelay() {
        return this.wave <= 4
            ? this.plan.delay
            : Math.max(THREAT.late.minimumDelay, THREAT.late.delay - Math.max(0, this.wave - 6) * 0.08);
    }
    get reserves() {
        return Math.max(0, this.total - this.deployed);
    }
    get groupCount() {
        return bossForWave(this.wave)
            ? 1
            : Math.max(this.group, 1 + Math.ceil(Math.max(0, this.total - this.activeLimit) / this.batch));
    }
    get size() {
        return bossForWave(this.wave) ? 0 : this.pending || Math.min(this.activeLimit, this.reserves);
    }
    get encounter() {
        if (this.wave < 3 || bossForWave(this.wave)) return null;
        if (this.wave === 6 && this.group === 1) return FLEET.encounters[0];
        if (this.wave === 7 && this.group === 1) return FLEET.encounters[1];
        let total = 0;
        for (const e of TEMPLATES) if (this.wave >= e.minWave) total += e.weight;
        let choice = (Math.imul(this.wave * 997 + this.group * 131, 1664525) >>> 0) % total;
        for (const e of TEMPLATES)
            if (this.wave >= e.minWave) {
                choice -= e.weight;
                if (choice < 0) return e;
            }
        return FLEET.encounters[0];
    }
    reset() {
        this.wave = this.group = this.deployed = this.pending = 0;
        this.countdown = LIVING.arrival - LIVING.approach;
        this.stage = 'inbound';
        this.waiting = this.hadEnemies = this.cleared = false;
    }
    commitSpawn(count: number) {
        const actual = Math.max(0, Math.min(this.pending, count));
        this.deployed += actual;
        this.pending = 0;
        this.countdown = actual ? this.reinforcementDelay : 1;
        this.hadEnemies ||= actual > 0;
        if (!actual && this.group > 1) this.group--;
    }
    private finish() {
        this.cleared = true;
        this.waiting = true;
        this.hadEnemies = false;
        this.stage = 'clear';
        this.countdown = EVOLUTION.director.waveBreak;
    }
    step(dt: number, alive: number): WaveOrder {
        this.cleared = false;
        if (this.wave === 0 && alive > 0) {
            this.hadEnemies = true;
            this.stage = 'engaged';
            return 'none';
        }
        if (this.wave === 0 || this.waiting) {
            this.countdown -= dt;
            if (this.countdown > 0) return 'none';
            this.waiting = false;
            this.wave++;
            this.group = 1;
            this.deployed = this.pending = 0;
            this.hadEnemies = false;
            this.stage = 'inbound';
            if (bossForWave(this.wave)) {
                this.hadEnemies = true;
                return 'boss';
            }
            this.pending = Math.min(this.activeLimit, this.total);
            return 'squad';
        }
        if (alive > 0) {
            this.hadEnemies = true;
            this.stage = 'engaged';
        }
        if (bossForWave(this.wave)) {
            if (alive === 0 && this.hadEnemies) this.finish();
            return 'none';
        }
        this.countdown = Math.max(0, this.countdown - dt);
        if (this.reserves > 0) {
            if (this.countdown <= 0 && alive <= this.activeLimit - this.batch) {
                this.pending = Math.min(
                    this.reserves,
                    this.activeLimit - alive,
                    this.deployed === 0 ? this.activeLimit : this.batch
                );
                this.group = this.deployed === 0 ? 1 : this.group + 1;
                this.stage = 'inbound';
                return 'squad';
            }
            if (alive === 0) this.stage = 'regroup';
            return 'none';
        }
        if (alive === 0 && (this.hadEnemies || this.deployed >= this.total)) this.finish();
        return 'none';
    }
}
