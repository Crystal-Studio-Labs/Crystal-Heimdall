const recentAlerts = new Map<string, { timestamp: number; count: number }>();
const SUPPRESSION_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export interface DeduplicationResult {
  isSuppressed: boolean;
  fingerprint: string;
  occurrenceCount: number;
}

export function checkAndRegisterAlert(serviceId: string, title: string): DeduplicationResult {
  const fingerprint = `${serviceId}:${title.trim().toLowerCase().slice(0, 80)}`;
  const now = Date.now();
  const existing = recentAlerts.get(fingerprint);

  if (existing && now - existing.timestamp < SUPPRESSION_WINDOW_MS) {
    existing.count += 1;
    return {
      isSuppressed: true,
      fingerprint,
      occurrenceCount: existing.count,
    };
  }

  recentAlerts.set(fingerprint, {
    timestamp: now,
    count: 1,
  });

  return {
    isSuppressed: false,
    fingerprint,
    occurrenceCount: 1,
  };
}

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of recentAlerts.entries()) {
      if (now - val.timestamp > SUPPRESSION_WINDOW_MS * 2) {
        recentAlerts.delete(key);
      }
    }
  }, 60 * 1000);
}
