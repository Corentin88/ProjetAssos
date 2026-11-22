export function createRequestLimit(limit: number, maxAddresses = 2000) {
  const windowMs = 60_000;
  const windows = new Map<string, { until: number; count: number }>();
  let nextSweepAt = 0;

  return (address: string, now = Date.now()) => {
    let window = windows.get(address);
    if (!window || window.until <= now) {
      if (windows.size >= maxAddresses && now >= nextSweepAt) {
        for (const [ip, entry] of windows) {
          if (entry.until <= now) windows.delete(ip);
        }
        nextSweepAt = now + 1000;
      }
      if (windows.size >= maxAddresses && !windows.has(address)) return windowMs / 1000;
      window = { until: now + windowMs, count: 0 };
      windows.set(address, window);
    }
    return ++window.count > limit ? Math.ceil((window.until - now) / 1000) : 0;
  };
}
