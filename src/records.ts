export interface RunSummary {
    guardianTime?: number | null;
    guardianBosses?: number;
    discoveries?: number;
    upgrades?: number;
    phantomTime?: number | null;
    phantomBosses?: number;
    score: number;
    wave: number;
    cleared: number;
    kills: number;
    shots: number;
    hits: number;
    combo: number;
    bossTime: number | null;
    bosses: number;
    duration: number;
    challenges: number;
    ended: 'lost' | 'retired';
}
export interface RecordsData {
    bestGuardianTime?: number | null;
    bestPhantomTime?: number | null;
    version: 1;
    highScore: number;
    highWave: number;
    longestCombo: number;
    bestBossTime: number | null;
    bestRun: RunSummary | null;
    runs: number;
}
const KEY = 'aether-drift-2-records';
const empty = (): RecordsData => ({
    version: 1,
    highScore: 0,
    highWave: 0,
    longestCombo: 0,
    bestBossTime: null,
    bestRun: null,
    runs: 0
});
const number = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
export type RecordName = 'score' | 'wave' | 'combo' | 'boss' | 'phantom' | 'guardian';
export class Records {
    data = empty();
    available = true;
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | undefined;
    constructor(storage?: Pick<Storage, 'getItem' | 'setItem'>) {
        try {
            this.storage = storage ?? globalThis.localStorage;
            const v = JSON.parse(this.storage?.getItem(KEY) || '{}');
            // Versioned additive schema. Accept earlier flat score/wave fields without touching settings.
            this.data = {
                version: 1,
                highScore: number(v.highScore ?? v.score),
                highWave: number(v.highWave ?? v.wave),
                longestCombo: number(v.longestCombo),
                bestPhantomTime: number(v.bestPhantomTime) > 0 ? v.bestPhantomTime : null,
                bestGuardianTime: number(v.bestGuardianTime) > 0 ? v.bestGuardianTime : null,
                bestBossTime: number(v.bestBossTime) > 0 ? v.bestBossTime : null,
                bestRun: this.validRun(v.bestRun),
                runs: number(v.runs)
            };
        } catch {
            this.available = false;
        }
    }
    private validRun(value: unknown): RunSummary | null {
        if (!value || typeof value !== 'object') return null;
        const v = value as Partial<RunSummary>;
        if (typeof v.score !== 'number' || !Number.isFinite(v.score) || v.score < 0) return null;
        return {
            ...(v.guardianTime !== undefined
                ? { guardianTime: number(v.guardianTime) > 0 ? v.guardianTime : null }
                : {}),
            ...(v.guardianBosses !== undefined ? { guardianBosses: number(v.guardianBosses) } : {}),
            ...(v.discoveries !== undefined ? { discoveries: number(v.discoveries) } : {}),
            ...(v.upgrades !== undefined ? { upgrades: number(v.upgrades) } : {}),
            ...(v.phantomTime !== undefined ? { phantomTime: number(v.phantomTime) > 0 ? v.phantomTime : null } : {}),
            ...(v.phantomBosses !== undefined ? { phantomBosses: number(v.phantomBosses) } : {}),
            score: number(v.score),
            wave: number(v.wave),
            cleared: number(v.cleared),
            kills: number(v.kills),
            shots: number(v.shots),
            hits: number(v.hits),
            combo: number(v.combo),
            bossTime: number(v.bossTime) > 0 ? v.bossTime! : null,
            bosses: number(v.bosses),
            duration: number(v.duration),
            challenges: number(v.challenges),
            ended: v.ended === 'retired' ? 'retired' : 'lost'
        };
    }
    save(run: RunSummary): RecordName[] {
        const news: RecordName[] = [],
            d = this.data;
        if (run.score > d.highScore) {
            d.highScore = run.score;
            d.bestRun = { ...run };
            news.push('score');
        }
        if (run.wave > d.highWave) {
            d.highWave = run.wave;
            news.push('wave');
        }
        if (run.combo > d.longestCombo) {
            d.longestCombo = run.combo;
            news.push('combo');
        }
        if (run.bossTime !== null && (d.bestBossTime === null || run.bossTime < d.bestBossTime)) {
            d.bestBossTime = run.bossTime;
            news.push('boss');
        }
        if (run.phantomTime != null && (d.bestPhantomTime == null || run.phantomTime < d.bestPhantomTime)) {
            d.bestPhantomTime = run.phantomTime;
            news.push('phantom');
        }
        if (run.guardianTime != null && (d.bestGuardianTime == null || run.guardianTime < d.bestGuardianTime)) {
            d.bestGuardianTime = run.guardianTime;
            news.push('guardian');
        }
        if (!d.bestRun || run.score > d.bestRun.score) d.bestRun = { ...run };
        d.runs++;
        try {
            this.storage?.setItem(KEY, JSON.stringify(d));
        } catch {
            this.available = false;
        }
        return news;
    }
}
