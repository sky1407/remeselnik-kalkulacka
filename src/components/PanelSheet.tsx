"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";

/** Výška zbalenej lišty v px – vidno len úchyt a nadpis. */
const COLLAPSED_PX = 64;
/** Pomery výšky obrazovky, na ktoré lišta „docvakne“: zbalená, polovica, takmer celá. */
const SNAPS = [0, 0.45, 0.85] as const;
/** Posun prsta, pod ktorým sa gesto berie ako ťuknutie (prepne na ďalšiu polohu). */
const TAP_PX = 6;

function snapHeights(): number[] {
  const vh = window.innerHeight;
  return SNAPS.map((r) => (r === 0 ? COLLAPSED_PX : Math.round(vh * r)));
}

interface PanelSheetProps {
  title: ReactNode;
  /** Na počítači: panel skrytý, 3D model má celú šírku. */
  hiddenOnDesktop: boolean;
  children: ReactNode;
}

/**
 * Mobil: spodná lišta s vlastným posúvaním, ktorú stačí potiahnuť za úchyt.
 * Počítač (md+): bočný panel s vlastným posúvaním. 3D model sa s obsahom panela nikdy nehýbe.
 */
export function PanelSheet({ title, hiddenOnDesktop, children }: PanelSheetProps) {
  // `null` = predvolená výška z CSS (bez prístupu k `window` počas renderu na serveri).
  const [height, setHeight] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startY: number; startH: number; moved: boolean } | null>(null);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const sheet = e.currentTarget.parentElement;
    if (!sheet) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startH: sheet.getBoundingClientRect().height, moved: false };
    setDragging(true);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    if (Math.abs(dy) > TAP_PX) d.moved = true;
    if (!d.moved) return;
    const max = Math.round(window.innerHeight * SNAPS[SNAPS.length - 1]);
    setHeight(Math.min(max, Math.max(COLLAPSED_PX, d.startH - dy)));
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    const snaps = snapHeights();
    if (!d.moved) {
      // Ťuknutie na úchyt: zbalená → polovica → celá → zbalená.
      const current = snaps.reduce((best, s, i) => (Math.abs(s - d.startH) < Math.abs(snaps[best] - d.startH) ? i : best), 0);
      setHeight(snaps[(current + 1) % snaps.length]);
      return;
    }
    const h = d.startH - (e.clientY - d.startY);
    setHeight(snaps.reduce((best, s) => (Math.abs(s - h) < Math.abs(best - h) ? s : best)));
  };

  return (
    <aside
      style={height === null ? undefined : { height }}
      className={`relative z-10 flex h-[45dvh] shrink-0 flex-col rounded-t-2xl bg-stone-100 shadow-[0_-4px_20px_rgba(0,0,0,0.12)] md:h-auto! md:rounded-none md:border-l md:border-stone-200 md:shadow-none ${
        dragging ? "" : "transition-[height] duration-200"
      } ${hiddenOnDesktop ? "md:hidden" : "md:w-[420px]"}`}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label="Potiahni alebo ťukni pre zmenu veľkosti panela"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          const snaps = snapHeights();
          const h = height ?? snaps[1];
          setHeight(snaps[(snaps.findIndex((s) => s >= h) + 1) % snaps.length]);
        }}
        className="flex shrink-0 cursor-grab touch-none flex-col items-center gap-2 px-4 pb-2 pt-2 md:cursor-default md:pt-4"
      >
        <span className="h-1.5 w-12 rounded-full bg-stone-300 md:hidden" aria-hidden />
        <div className="w-full">{title}</div>
      </div>
      {/* Vlastné posúvanie panela – `overscroll-contain` zabráni, aby sa posun preniesol na stránku. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8">{children}</div>
    </aside>
  );
}
