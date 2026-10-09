/**
 * Web Audio API Industrial Telemetry Alert Synthesizer
 * Provides synthesized hardware alarms, siren chirps, and resolution chimes
 * without external audio asset dependencies.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Global user interaction listener to auto-unlock AudioContext
if (typeof window !== "undefined") {
  const unlockListener = () => {
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    window.removeEventListener("click", unlockListener);
    window.removeEventListener("keydown", unlockListener);
    window.removeEventListener("touchstart", unlockListener);
  };
  window.addEventListener("click", unlockListener);
  window.addEventListener("keydown", unlockListener);
  window.addEventListener("touchstart", unlockListener);
}

export function isAudioMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("crystal_alarm_muted") === "true";
}

export function setAudioMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("crystal_alarm_muted", muted ? "true" : "false");
}

/**
 * Play a high-urgency industrial datacenter siren alarm (Pulsed two-tone klaxon)
 * Used when a monitored service transitions to CRITICAL or DOWN.
 */
export function playCriticalAlarm(): void {
  if (isAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.7, now);
    masterGain.connect(ctx.destination);

    // 3 pulses of dual-tone alternating siren
    for (let i = 0; i < 3; i++) {
      const pulseStart = now + i * 0.45;

      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      // Sweep between 900Hz and 600Hz
      osc.frequency.setValueAtTime(920, pulseStart);
      osc.frequency.exponentialRampToValueAtTime(580, pulseStart + 0.2);
      osc.frequency.setValueAtTime(920, pulseStart + 0.22);
      osc.frequency.exponentialRampToValueAtTime(580, pulseStart + 0.4);

      const pulseGain = ctx.createGain();
      pulseGain.gain.setValueAtTime(0.001, pulseStart);
      pulseGain.gain.linearRampToValueAtTime(0.6, pulseStart + 0.05);
      pulseGain.gain.linearRampToValueAtTime(0.6, pulseStart + 0.35);
      pulseGain.gain.linearRampToValueAtTime(0.001, pulseStart + 0.42);

      osc.connect(pulseGain);
      pulseGain.connect(masterGain);

      osc.start(pulseStart);
      osc.stop(pulseStart + 0.43);
    }
  } catch (err) {
    console.warn("AudioContext playback failed:", err);
  }
}

/**
 * Play a warning chirp (Dual high-pitch blips)
 * Used for degraded latency or warning events.
 */
export function playWarningChirp(): void {
  if (isAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    [0, 0.14].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(idx === 0 ? 780 : 940, now + offset);

      gain.gain.setValueAtTime(0.01, now + offset);
      gain.gain.linearRampToValueAtTime(0.35, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.11);
    });
  } catch (err) {
    console.warn("AudioContext warning chirp failed:", err);
  }
}

/**
 * Play a resolution chime (Ascending C5 -> E5 -> G5 harmonic chime)
 * Used when an incident is resolved or service recovers to healthy.
 */
export function playResolvedChime(): void {
  if (isAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5

    frequencies.forEach((freq, idx) => {
      const startTime = now + idx * 0.12;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.01, startTime);
      gain.gain.linearRampToValueAtTime(0.4, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.46);
    });
  } catch (err) {
    console.warn("AudioContext resolved chime failed:", err);
  }
}

/**
 * Play a crash buzz (Sawtooth drop)
 * Used for Sentry crash ingestion events.
 */
export function playCrashSound(): void {
  if (isAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.25);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.29);
  } catch (err) {
    console.warn("AudioContext crash sound failed:", err);
  }
}

/**
 * Test siren alert demonstration
 */
export function playTestSound(): void {
  playCriticalAlarm();
}
