export class SoundEngine {
  enabled = true;
  private ctx: AudioContext | null = null;
  private lastBuzzTime = 0;

  ensureCtx(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playClick(high = true): void {
    try {
      const ctx = this.ensureCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(high ? 680 : 420, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(high ? 960 : 280, ctx.currentTime + 0.045);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.055);
    } catch {
      // Ignore audio errors
    }
  }

  playPop(freq = 760): void {
    try {
      const ctx = this.ensureCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.35, ctx.currentTime + 0.07);
      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.075);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // Ignore audio errors
    }
  }

  playBuzzer(freqHz = 440, wave: OscillatorType = 'sawtooth'): void {
    try {
      const ctx = this.ensureCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      if (now - this.lastBuzzTime < 0.12) return;
      this.lastBuzzTime = now;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(Math.max(40, Math.min(4000, freqHz)), now);
      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } catch {
      // Ignore audio errors
    }
  }
}

export const soundFX = new SoundEngine();
