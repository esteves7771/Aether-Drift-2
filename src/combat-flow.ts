import { ARCADE } from './arcade-config';

/** Sole score owner. Called once per confirmed damaging hit, kill or completed challenge. */
export class CombatFlow {
    score = 0;
    chain = 0;
    longest = 0;
    activity = 0;
    shots = 0;
    hits = 0;
    boostKills = 0;
    damageCount = 0;
    hullHits = 0;
    private level = 0;
    private progress = 0;
    private clean = true;
    lastReward = 0;
    rewardText = '';
    rewardTime = 0;
    rewardSerial = 0;
    get multiplier() {
        return 1 + this.level * ARCADE.flow.step;
    }
    get accuracy() {
        return this.shots > 0 ? Math.min(1, this.hits / this.shots) : 0;
    }
    reset() {
        this.score =
            this.chain =
            this.longest =
            this.activity =
            this.shots =
            this.hits =
            this.boostKills =
            this.damageCount =
            this.hullHits =
            this.level =
            this.progress =
            this.lastReward =
            this.rewardTime =
            this.rewardSerial =
                0;
        this.clean = true;
        this.rewardText = '';
    }
    step(dt: number, engaged: boolean) {
        this.rewardTime = Math.max(0, this.rewardTime - dt);
        if (!engaged) return;
        this.activity = Math.max(0, this.activity - dt);
        if (this.activity <= 0) this.breakChain();
    }
    hit() {
        this.hits++;
        this.activity = ARCADE.flow.window;
    }
    damage(hull: boolean) {
        this.damageCount++;
        this.clean = false;
        if (hull) {
            this.hullHits++;
            this.breakChain();
        } else {
            this.level = Math.max(0, this.level - 1);
            this.progress = 0;
        }
    }
    private breakChain() {
        this.chain = this.level = this.progress = 0;
        this.activity = 0;
    }
    kill(base: number, boosted: boolean, label: string) {
        const bonus = (this.clean ? ARCADE.scoring.clean : 0) + (boosted ? ARCADE.scoring.boost : 0);
        const amount = Math.round((base + bonus) * this.multiplier);
        this.add(amount, label + (this.clean ? ' / CLEAN' : '') + (boosted ? ' / BOOST' : ''));
        this.chain++;
        this.longest = Math.max(this.longest, this.chain);
        this.progress++;
        if (this.progress >= ARCADE.flow.killsPerStep) {
            this.progress = 0;
            this.level = Math.min((ARCADE.flow.maximum - 1) / ARCADE.flow.step, this.level + 1);
        }
        if (boosted) this.boostKills++;
        this.activity = ARCADE.flow.window;
        this.clean = true;
        return amount;
    }
    bonus(amount: number, label: string) {
        this.add(amount, label);
    }
    private add(amount: number, label: string) {
        this.score += amount;
        this.lastReward = amount;
        this.rewardText = label;
        this.rewardTime = ARCADE.flow.feedback;
        this.rewardSerial++;
    }
}
