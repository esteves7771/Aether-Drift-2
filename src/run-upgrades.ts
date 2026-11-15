export const UPGRADES = [
    {
        id: 'laser',
        name: 'FOCUSED CAPACITORS',
        detail: '+12% laser damage per rank. Raw damage over utility.',
        step: 0.12,
        maximum: 2
    },
    {
        id: 'missile',
        name: 'RESERVE RACK',
        detail: '+2 missile capacity and 2 charges per rank. Finite ammunition.',
        step: 2,
        maximum: 2
    },
    {
        id: 'shield',
        name: 'REGEN MATRIX',
        detail: '+20% shield recharge per rank. Recharge delay remains.',
        step: 0.2,
        maximum: 2
    },
    {
        id: 'boost',
        name: 'EFFICIENT INJECTORS',
        detail: '15% less boost drain per rank. No extra top speed.',
        step: 0.15,
        maximum: 2
    },
    {
        id: 'emp',
        name: 'PULSE RECOVERY',
        detail: '15% shorter EMP cooldown per rank. Radius unchanged.',
        step: 0.15,
        maximum: 2
    },
    {
        id: 'velocity',
        name: 'MAGNETIC ACCELERATOR',
        detail: '+12% laser velocity per rank. Damage unchanged.',
        step: 0.12,
        maximum: 2
    }
] as const;
export const UPGRADE_MILESTONES = [2, 5, 8, 10, 13] as const;
export type UpgradeId = (typeof UPGRADES)[number]['id'];
const INDEX: Record<UpgradeId, number> = { laser: 0, missile: 1, shield: 2, boost: 3, emp: 4, velocity: 5 };
/** Run-local values only. No storage, economy or mutation of shared weapon constants. */
export class RunUpgrades {
    readonly ranks = new Uint8Array(UPGRADES.length);
    readonly offers: number[] = [];
    pending = false;
    milestone = 0;
    selections = 0;
    private granted = 0;
    reset() {
        this.ranks.fill(0);
        this.offers.length = 0;
        this.pending = false;
        this.milestone = this.selections = this.granted = 0;
    }
    get(id: UpgradeId) {
        const i = INDEX[id];
        return this.ranks[i] * UPGRADES[i].step;
    }
    offer(wave: number) {
        if (this.pending || wave <= this.granted || !UPGRADE_MILESTONES.some((w) => w === wave)) return false;
        this.granted = wave;
        this.milestone = wave;
        this.offers.length = 0;
        const start = (wave + this.selections * 2) % UPGRADES.length;
        for (let n = 0; n < UPGRADES.length && this.offers.length < 3; n++) {
            const i = (start + n) % UPGRADES.length;
            if (this.ranks[i] < UPGRADES[i].maximum) this.offers.push(i);
        }
        this.pending = this.offers.length > 0;
        return this.pending;
    }
    choose(index: number) {
        if (!this.pending || !this.offers.includes(index) || this.ranks[index] >= UPGRADES[index].maximum) return false;
        this.ranks[index]++;
        this.selections++;
        this.pending = false;
        this.offers.length = 0;
        return true;
    }
}
