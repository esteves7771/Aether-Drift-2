import { ARCADE } from './arcade-config';
import type { CombatFlow } from './combat-flow';
const TITLES = [
    `PRECISION / ${Math.round(ARCADE.challenges.accuracy * 100)}% ACCURACY`,
    'CLEAN FLIGHT / NO HULL HITS',
    `OVERDRIVE / ${ARCADE.challenges.boostKills} BOOST KILLS`
];
/** Optional deterministic goals; failure never changes spawning or blocks the next wave. */
export class WaveChallenge {
    wave = 0;
    kind = 0;
    completed = false;
    resolved = false;
    enabled = true;
    private shots = 0;
    private hits = 0;
    private hull = 0;
    private boost = 0;
    get title() {
        return this.wave === 15
            ? 'FORTRESS / NO HULL DAMAGE'
            : this.wave === 10
              ? 'PHANTOM / NO HULL DAMAGE'
              : TITLES[this.kind];
    }
    begin(wave: number, flow: CombatFlow, enabled: boolean) {
        this.wave = wave;
        this.kind = wave === 10 || wave === 15 ? 1 : (wave - 1) % 3;
        this.enabled = enabled && wave !== 5;
        this.completed = this.resolved = false;
        this.shots = flow.shots;
        this.hits = flow.hits;
        this.hull = flow.hullHits;
        this.boost = flow.boostKills;
    }
    finish(flow: CombatFlow) {
        if (this.resolved || !this.enabled) return false;
        this.resolved = true;
        const shots = flow.shots - this.shots;
        this.completed =
            this.kind === 0
                ? shots > 0 && (flow.hits - this.hits) / shots >= ARCADE.challenges.accuracy
                : this.kind === 1
                  ? flow.hullHits === this.hull
                  : flow.boostKills - this.boost >= ARCADE.challenges.boostKills;
        if (this.completed) flow.bonus(ARCADE.scoring.challenge, 'CHALLENGE COMPLETE');
        return this.completed;
    }
    reset() {
        this.wave = 0;
        this.completed = this.resolved = false;
    }
}
