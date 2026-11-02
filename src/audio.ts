/** Tiny WebAudio synth for retro beeps. */

type Wave = OscillatorType;

export class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;

  /** Must be called from a user gesture (browsers block audio before that). */
  unlock(): void {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private tone(f0: number, f1: number, dur: number, wave: Wave = 'square', vol = 0.08, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  jump(): void {
    this.tone(300, 720, 0.14);
  }
  score(): void {
    this.tone(880, 1320, 0.08, 'square', 0.06);
    this.tone(1320, 1760, 0.08, 'square', 0.06, 0.07);
  }
  smash(): void {
    this.tone(160, 60, 0.12, 'sawtooth', 0.1);
  }
  pickup(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.07, 'square', 0.06, i * 0.06));
  }
  step(): void {
    this.tone(120, 90, 0.03, 'triangle', 0.05);
  }
  throw(): void {
    this.tone(90, 60, 0.2, 'triangle', 0.12);
  }
  death(): void {
    [660, 590, 520, 440, 370, 300, 220].forEach((f, i) => this.tone(f, f * 0.94, 0.12, 'square', 0.08, i * 0.11));
  }
  win(): void {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, f, 0.14, 'square', 0.07, i * 0.12));
  }
}
