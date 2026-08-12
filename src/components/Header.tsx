"use client";

import { useEffect, useState } from "react";

export default function Header() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const format = () =>
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const update = () => setTime(format());
    // deferred via setTimeout so the client-only first paint (avoiding a
    // server/client hydration mismatch) happens in a callback, not
    // synchronously in the effect body
    const initial = setTimeout(update, 0);
    const id = setInterval(update, 15_000);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, []);

  return (
    <header className="flex items-center px-4 py-3 sm:px-8 sm:py-6">
      <div className="flex items-center gap-2 whitespace-nowrap font-mono text-[10px] tracking-widest text-rice/70 sm:gap-3 sm:text-sm">
        <span suppressHydrationWarning>{time ?? " "}</span>
      </div>
    </header>
  );
}
