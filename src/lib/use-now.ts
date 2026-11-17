"use client";

import { useEffect, useState } from "react";

// The current time in milliseconds, refreshed every few seconds so clocks on screen keep moving.
// It is null until the page has loaded in the browser, which keeps the server and browser output identical.
export function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
