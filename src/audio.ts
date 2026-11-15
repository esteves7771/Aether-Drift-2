import type { CombatEvent } from './combat-config';
export class EngineAudio {
    private context?: AudioContext;
    private oscillator?: OscillatorNode;
    private gain?: GainNode;
    private output?: GainNode;
    private volume = 1;
    private readonly voices: { oscillator: OscillatorNode; gain: GainNode }[] = [];
    private voiceIndex = 0;
    start() {
        if (!this.context) {
            this.context = new AudioContext();
            this.output = this.context.createGain();
            this.output.gain.value = this.volume;
            this.output.connect(this.context.destination);
            this.oscillator = this.context.createOscillator();
            this.oscillator.type = 'sawtooth';
            const filter = this.context.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 260;
            this.gain = this.context.createGain();
            this.gain.gain.value = 0;
            this.oscillator.connect(filter).connect(this.gain).connect(this.output);
            this.oscillator.start();
            for (let i = 0; i < 16; i++) {
                const oscillator = this.context.createOscillator(),
                    gain = this.context.createGain();
                oscillator.type = i % 2 ? 'triangle' : 'sawtooth';
                gain.gain.value = 0;
                oscillator.connect(gain).connect(this.output);
                oscillator.start();
                this.voices.push({ oscillator, gain });
            }
        }
        void this.context.resume().catch(() => {
            /* Audio may remain suspended until the next gesture. */
        });
    }
    setVolume(value: number) {
        value = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
        if (value === this.volume) return;
        this.volume = value;
        this.output?.gain.setTargetAtTime(value, this.context!.currentTime, 0.015);
    }
    combat(event: CombatEvent, volume: number, distance: number) {
        if (!this.context || this.voices.length === 0 || distance > 650) return;
        const voice = this.voices[this.voiceIndex++ % this.voices.length],
            now = this.context.currentTime;
        const explosion =
                event === 'explosion' ||
                event === 'elite-explosion' ||
                event === 'capital-burst' ||
                event === 'capital-final' ||
                event === 'missile-impact',
            hit = event === 'shield' || event === 'hull';
        const duration = event === 'capital-final' ? 1 : explosion ? 0.55 : hit ? 0.2 : 0.1,
            frequency = explosion
                ? 85
                : event === 'laser'
                  ? 1000
                  : event === 'drone'
                    ? 680
                    : event === 'salvo'
                      ? 130
                      : event === 'deploy'
                        ? 180
                        : event === 'hostile'
                          ? 430
                          : 220;
        voice.oscillator.frequency.cancelScheduledValues(now);
        voice.oscillator.frequency.setValueAtTime(frequency, now);
        voice.oscillator.frequency.exponentialRampToValueAtTime(explosion ? 22 : frequency * 0.35, now + duration);
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(0, now);
        voice.gain.gain.linearRampToValueAtTime(
            (volume * (explosion ? 0.13 : hit ? 0.09 : 0.035)) / (1 + distance / 100),
            now + 0.005
        );
        voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        voice.gain.gain.setValueAtTime(0, now + duration + 0.01);
    }
    silence() {
        if (!this.context) return;
        for (const v of this.voices) {
            v.gain.gain.cancelScheduledValues(this.context.currentTime);
            v.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.015);
        }
    }
    update(speed: number, boost: boolean, active: boolean, volume: number, acceleration = 0) {
        if (!this.context || !this.gain || !this.oscillator) return;
        this.oscillator.frequency.setTargetAtTime(
            35 + speed * 0.5 + (boost ? 35 : 0) + Math.max(0, acceleration) * 0.3,
            this.context.currentTime,
            0.12
        );
        this.gain.gain.setTargetAtTime(
            active ? volume * (0.025 + speed / 1500 + Math.min(0.02, Math.abs(acceleration) / 2500)) : 0,
            this.context.currentTime,
            0.08
        );
    }
    destroy() {
        void this.context?.close();
    }
}
