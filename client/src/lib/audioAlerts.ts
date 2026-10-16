/**
 * Web Audio API Industrial Telemetry Alert Synthesizer & Mobile Sentinel
 * Provides synthesized hardware alarms, siren chirps, resolution chimes,
 * mobile Service Worker push notifications, vibration API, and Screen Wake Lock.
 */

let audioCtx: AudioContext | null = null;
let continuousAlarmInterval: any = null;
let wakeLockSentinel: any = null;
let isAlarmLooping = false;

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

// Global user interaction listener to auto-unlock AudioContext on first tap/click
if (typeof window !== "undefined") {
  const unlockListener = () => {
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    window.removeEventListener("click", unlockListener);
    window.removeEventListener("keydown", unlockListener);
    window.removeEventListener("touchstart", unlockListener);
  };
  window.addEventListener("click", unlockListener, { passive: true });
  window.addEventListener("keydown", unlockListener, { passive: true });
  window.addEventListener("touchstart", unlockListener, { passive: true });

  // Listen for Service Worker messages (e.g. user tapped [SILENCE ALARM] on lock screen)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data && event.data.type === "SILENCE_AUDIO_ALARM") {
        stopContinuousAlarm();
      }
    });
  }
}

export function isAudioMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("crystal_alarm_muted") === "true";
}

export function setAudioMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("crystal_alarm_muted", muted ? "true" : "false");
  if (muted) {
    stopContinuousAlarm();
  }
}

export function isAlarmSounding(): boolean {
  return isAlarmLooping;
}

/**
 * Trigger mobile vibration pattern
 */
export function triggerMobileVibration(pattern: number[] = [600, 200, 600, 200, 1000, 300, 800]): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {}
  }
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
      // Sweep between 920Hz and 580Hz (industrial klaxon)
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
 * Starts continuous looping siren alarm until silenced or acknowledged.
 * Sets MediaSession state so mobile OS does not kill background audio when locked.
 */
export function startContinuousAlarm(reason = "Monitored target dropped offline"): void {
  if (isAudioMuted()) return;
  if (isAlarmLooping) return;
  isAlarmLooping = true;

  // Immediate first siren cycle
  playCriticalAlarm();
  triggerMobileVibration([800, 200, 800, 200, 1000]);

  // Keep mobile media session active
  if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "🚨 HEIMDALL SENTINEL ALARM",
        artist: reason,
        album: "Telemetry Outage Sentinel",
      });
      navigator.mediaSession.playbackState = "playing";
      navigator.mediaSession.setActionHandler("stop", () => stopContinuousAlarm());
    } catch {}
  }

  // Loop every 2.4 seconds
  continuousAlarmInterval = setInterval(() => {
    if (isAudioMuted() || !isAlarmLooping) {
      stopContinuousAlarm();
      return;
    }
    playCriticalAlarm();
    triggerMobileVibration([800, 200, 800, 200, 1000]);
  }, 2400);
}

/**
 * Stops ongoing continuous siren alarm and cancels vibration.
 */
export function stopContinuousAlarm(): void {
  isAlarmLooping = false;
  if (continuousAlarmInterval) {
    clearInterval(continuousAlarmInterval);
    continuousAlarmInterval = null;
  }
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(0);
    } catch {}
  }
  if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
    try {
      navigator.mediaSession.playbackState = "paused";
    } catch {}
  }
}

/**
 * Trigger native mobile system push notification in the status bar/notification area.
 * Uses ServiceWorkerRegistration.showNotification() for mobile lock screen & tray persistence.
 */
export async function triggerMobilePushNotification(
  title: string,
  body: string,
  options?: { tag?: string; url?: string; vibrate?: number[] }
): Promise<boolean> {
  const vibratePattern = options?.vibrate || [600, 200, 600, 200, 1000, 300, 800];
  const tag = options?.tag || "heimdall-outage-alert";
  const url = options?.url || "/dashboard";

  // Trigger tactile vibration immediately
  triggerMobileVibration(vibratePattern);

  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }

  // 1. Send postMessage to active Service Worker controller
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: "TRIGGER_OUTAGE_NOTIFICATION",
      title,
      body,
      vibrate: vibratePattern,
      tag,
      url,
    });
  }

  // 2. Trigger via ServiceWorkerRegistration.showNotification (Mobile Native OS Requirement)
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && "showNotification" in reg) {
        await reg.showNotification(title, {
          body,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          vibrate: vibratePattern,
          tag,
          renotify: true,
          requireInteraction: true,
          data: { url, timestamp: Date.now() },
          actions: [
            { action: "explore", title: "[VIEW SENTINEL]" },
            { action: "silence", title: "[SILENCE ALARM]" },
          ],
        });
        return true;
      }
    } catch (err) {
      console.warn("ServiceWorker showNotification failed, falling back:", err);
    }
  }

  // 3. Fallback to window Notification for desktop browsers
  if (Notification.permission === "granted") {
    try {
      new Notification(title, {
        body,
        icon: "/icon-192.png",
        tag,
      });
      return true;
    } catch (err) {
      console.warn("Window Notification constructor failed:", err);
    }
  }

  return false;
}

/**
 * Screen Wake Lock API: Prevent mobile screen from sleeping or locking during monitoring
 */
export async function requestScreenWakeLock(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
    return false;
  }
  try {
    wakeLockSentinel = await (navigator as any).wakeLock.request("screen");
    wakeLockSentinel.addEventListener("release", () => {
      wakeLockSentinel = null;
    });
    return true;
  } catch (err) {
    console.warn("WakeLock request failed:", err);
    return false;
  }
}

export async function releaseScreenWakeLock(): Promise<void> {
  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
    } catch {}
    wakeLockSentinel = null;
  }
}

export function isScreenWakeLockActive(): boolean {
  return !!wakeLockSentinel;
}

/**
 * Test siren alert demonstration with mobile push notification and vibration
 */
export async function testAlarmAndNotification(): Promise<{ notificationGranted: boolean }> {
  // 1. Unmute alarm
  setAudioMuted(false);

  // 2. Unlock AudioContext & play test siren
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    await ctx.resume().catch(() => {});
  }
  playCriticalAlarm();

  // 3. Trigger vibration
  triggerMobileVibration([500, 150, 500, 150, 800]);

  // 4. Request / check notification permission
  let granted = false;
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") {
      granted = true;
    } else if (Notification.permission !== "denied") {
      const perm = await Notification.requestPermission().catch(() => "denied");
      granted = perm === "granted";
    }
  }

  // 5. Fire test push notification in system tray
  if (granted) {
    await triggerMobilePushNotification(
      "CRYSTAL HEIMDALL // ALARM TEST",
      "Mobile sentinel alarm siren & system push notification active and verified nominal.",
      { tag: "heimdall-test-alarm" }
    );
  }

  return { notificationGranted: granted };
}

/**
 * Play a warning chirp (Dual high-pitch blips)
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
 * Legacy test sound export
 */
export function playTestSound(): void {
  playCriticalAlarm();
}
