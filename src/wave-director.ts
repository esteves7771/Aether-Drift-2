import { ENCOUNTERS, EVOLUTION } from './evolution-config';
import { FLEET } from './fleet-config';
import { FRONTIER } from './frontier-config';
import { bossForWave } from './guardian-config';
import { LIVING } from './living-config';
const TEMPLATES = [...FLEET.encounters, ...FRONTIER.encounters];
export type WaveOrder = 'none' | 'squad' | 'boss';
export class WaveDirector {
    wave = 0;
    group = 0;
    countdown = LIVING.arrival - LIVING.approach;
    stage: 'inbound' | 'engaged' | 'regroup' | 'clear' = 'inbound';
    cleared = false;
    private hadEnemies = false;
    get encounter() {
        if (this.wave < 6 || bossForWave(this.wave)) return null;
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
    get plan() {
        return ENCOUNTERS[Math.min(3, Math.max(0, this.wave - 1))];
    }
    get groupCount() {
        return bossForWave(this.wave) ? 1 : this.plan.groups;
    }
    get size() {
        if (bossForWave(this.wave)) return 0;
        if (this.encounter) return this.encounter.roles.length;
        return Math.min(8, this.plan.size + Math.floor(Math.max(0, this.wave - 5) / 2));
    }
    reset() {
        this.wave = this.group = 0;
        this.countdown = LIVING.arrival - LIVING.approach;
        this.stage = 'inbound';
        this.hadEnemies = false;
        this.cleared = false;
    }
    step(dt: number, alive: number): WaveOrder {
        this.cleared = false;
        if (alive > 0) {
            this.hadEnemies = true;
            this.stage = 'engaged';
            return 'none';
        }
        if (this.hadEnemies) {
            this.hadEnemies = false;
            this.cleared = this.group >= this.groupCount;
            this.stage = this.cleared ? 'clear' : 'regroup';
            this.countdown = this.cleared ? EVOLUTION.director.waveBreak : EVOLUTION.director.groupBreak;
        }
        this.countdown -= dt;
        if (this.countdown > 0) return 'none';
        if (this.wave === 0 || this.group >= this.groupCount) {
            this.wave++;
            this.group = 1;
        } else this.group++;
        this.stage = 'inbound';
        this.hadEnemies = true;
        return bossForWave(this.wave) ? 'boss' : 'squad';
    }
}
