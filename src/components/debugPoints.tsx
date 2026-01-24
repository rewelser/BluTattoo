/**
 * ---- IMPORT ---- 
 * import { useScreenDebugMarks, ScreenDebugOverlay } from "./debugPoints";
 * ...
 * 
 * ---- USAGE: ---- 
 * const DEBUG = true; // flip off when done
 * const dbg = useScreenDebugMarks(DEBUG);
 * ...
 * <ScreenDebugOverlay marks={dbg.marks} />
 * 
 * ---- USAGE (cont'd) ---- 
 * // DEBUG VARS
 * const viewportCenter = {
 *   x: viewportCenter.x,
 *   y: viewportCenter.y,
 * }
 * 
 * if (DEBUG) {
 *   dbg.ensure("viewportCenter", viewportCenter, { label: "viewportCenter", crosshair: true });
 * }
 * 
 * ...
 * 
 * // somewhere global-ish (or in the overlay component)
 * window.addEventListener("pointermove", (e) => {
 *   dbg.ensure("cursor", { x: e.clientX, y: e.clientY }, { label: "cursor(client)", crosshair: true });
 * });
 * 
 */

import * as React from "react";

type DebugMark = {
  id: string;
  x: number;
  y: number;
  label?: string;
  color?: string;
  // optional: show crosshair instead of dot
  crosshair?: boolean;
};

type MarkOpts = Partial<Pick<DebugMark, "label" | "color" | "crosshair">>;

const randomColor = () => {
  // readable-ish bright colors
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue} 90% 60%)`;
};

export function useScreenDebugMarks(enabled: boolean) {
  const [marks, setMarks] = React.useState<Record<string, DebugMark>>({});

  const ensure = React.useCallback(
    (id: string, xy: { x: number; y: number }, opts?: MarkOpts) => {
      if (!enabled) return;
      setMarks((prev) => {
        const existing = prev[id];
        const color = opts?.color ?? existing?.color ?? randomColor();
        return {
          ...prev,
          [id]: {
            id,
            x: xy.x,
            y: xy.y,
            label: opts?.label ?? existing?.label,
            color,
            crosshair: opts?.crosshair ?? existing?.crosshair,
          },
        };
      });
    },
    [enabled]
  );

  const move = React.useCallback(
    (id: string, xy: { x: number; y: number }) => {
      if (!enabled) return;
      setMarks((prev) => {
        const existing = prev[id];
        if (!existing) return prev;
        return { ...prev, [id]: { ...existing, x: xy.x, y: xy.y } };
      });
    },
    [enabled]
  );

  const remove = React.useCallback(
    (id: string) => {
      if (!enabled) return;
      setMarks((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [enabled]
  );

  const clear = React.useCallback(() => {
    if (!enabled) return;
    setMarks({});
  }, [enabled]);

  return { marks, ensure, move, remove, clear };
}

export function ScreenDebugOverlay({
  marks,
}: {
  marks: Record<string, DebugMark>;
}) {
  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {Object.values(marks).map((m) => (
        <div
          key={m.id}
          style={{
            position: "absolute",
            left: m.x,
            top: m.y,
            // transform: "translate(-50%, -50%)", // this was causing the overlay points to be off, smdh my darn head chatgpt
            color: m.color ?? "hotpink",
          }}
        >
          {/* dot */}
          {!m.crosshair ? (
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 9999,
                background: "currentColor",
                boxShadow: "0 0 0 2px rgba(0,0,0,0.6)",
              }}
            />
          ) : (
            <div style={{ position: "relative", width: 18, height: 18 }}>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: "50%",
                  width: "100%",
                  height: 2,
                  background: "currentColor",
                  transform: "translateY(-50%)",
                  boxShadow: "0 0 0 2px rgba(0,0,0,0.35)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  width: 2,
                  height: "100%",
                  background: "currentColor",
                  transform: "translateX(-50%)",
                  boxShadow: "0 0 0 2px rgba(0,0,0,0.35)",
                }}
              />
            </div>
          )}

          {/* label */}
          {(m.label || m.id) && (
            <div
              style={{
                marginTop: 6,
                padding: "2px 6px",
                fontSize: 11,
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                color: "white",
                background: "rgba(0,0,0,0.65)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 6,
              }}
            >
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 9999,
                    background: m.color ?? "hotpink",
                    display: "inline-block",
                  }}
                />
                <span>{m.label ?? m.id}</span>
                <span style={{ opacity: 0.75 }}>
                  ({Math.round(m.x)}, {Math.round(m.y)})
                </span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
