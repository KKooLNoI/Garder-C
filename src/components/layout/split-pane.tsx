"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const KEY = "cp:split";

/** Two-column layout with a draggable divider. Width persists per browser. */
export function SplitPane({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  const [pct, setPct] = useState(45);
  const container = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(KEY));
      if (saved >= 20 && saved <= 75) setPct(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const onMove = useCallback((e: PointerEvent) => {
    if (!dragging.current || !container.current) return;
    const rect = container.current.getBoundingClientRect();
    setPct(Math.min(75, Math.max(20, ((e.clientX - rect.left) / rect.width) * 100)));
  }, []);

  const stop = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    document.body.style.userSelect = "";
    setPct((p) => {
      try {
        localStorage.setItem(KEY, String(Math.round(p)));
      } catch {
        /* ignore */
      }
      return p;
    });
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
    };
  }, [onMove, stop]);

  return (
    <div ref={container} className="flex h-full min-h-0">
      <div className="min-w-0 overflow-y-auto" style={{ width: `${pct}%` }}>
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panels"
        className="w-1 shrink-0 cursor-col-resize bg-border hover:bg-muted"
        onPointerDown={() => {
          dragging.current = true;
          document.body.style.userSelect = "none";
        }}
      />
      <div className="min-w-0 flex-1">{right}</div>
    </div>
  );
}
