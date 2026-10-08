"use client";

import { useSyncExternalStore } from "react";

// The studio's local time, ticking each minute. Rendered on the client only, so
// the server's clock never disagrees with the visitor's.
const subscribe = (cb: () => void) => {
  const t = window.setInterval(cb, 15_000);
  return () => window.clearInterval(t);
};

export default function LocalTime({ timeZone }: { timeZone: string }) {
  const time = useSyncExternalStore(
    subscribe,
    () => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date()),
    () => "--:--"
  );
  return <time suppressHydrationWarning>{time}</time>;
}
