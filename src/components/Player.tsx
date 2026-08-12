"use client";

import { useEffect, useRef, useState } from "react";
import YouTubePlayer from "@/components/YouTubePlayer";

const OLD_SONG = { label: "Old Song", playlistId: "PLffCnobOvXsU" };
const COVER_SONG = { label: "Cover Song", playlistId: "PLaeR-8k9b6oo" };
const INSTRUMENTAL = { label: "Instrumental", playlistId: "PLcQTTKWwcHx0" };

const YEARS = [
  { label: "2021", playlistId: "PLhXvuO8eMB22qUgrmpe9RYZKtLnArINNo" },
  { label: "2023", playlistId: "PLhXvuO8eMB20eT0WGqrJURQPfu5hrhXMt" },
] as const;

const YEAR_PLAYLIST_IDS = new Set<string>(YEARS.map((y) => y.playlistId));

export default function Player() {
  const [playlistId, setPlaylistId] = useState(OLD_SONG.playlistId);
  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  const [yearMenuPos, setYearMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const yearButtonRef = useRef<HTMLButtonElement>(null);

  const isYearActive = YEAR_PLAYLIST_IDS.has(playlistId);

  useEffect(() => {
    if (!yearMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setYearMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [yearMenuOpen]);

  const toggleYearMenu = () => {
    if (!yearMenuOpen && yearButtonRef.current) {
      const rect = yearButtonRef.current.getBoundingClientRect();
      // fixed-positioned (not nested inside the scrollable tab row) so the
      // swipeable row's overflow-x-auto doesn't clip it — CSS forces
      // overflow-y to clip too whenever overflow-x isn't visible
      setYearMenuPos({ top: rect.top - 8, left: rect.left + rect.width / 2 });
    }
    setYearMenuOpen((open) => !open);
  };

  const tabClass = (active: boolean) =>
    `shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors sm:px-3.5 sm:text-[11px] ${
      active ? "bg-ochre text-charcoal" : "text-rice/60 hover:text-rice"
    }`;

  return (
    <div className="flex w-full flex-col items-center gap-3 px-4 pb-6 sm:pb-8">
      <div
        onScroll={() => setYearMenuOpen(false)}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        className="flex w-full max-w-2xl flex-nowrap items-center justify-start gap-1 overflow-x-auto rounded-full border border-ochre/25 bg-charcoal/70 p-1.5 backdrop-blur-md [&::-webkit-scrollbar]:hidden sm:w-auto sm:max-w-none sm:justify-center sm:overflow-visible sm:gap-1.5"
      >
        <button
          type="button"
          onClick={() => setPlaylistId(OLD_SONG.playlistId)}
          aria-pressed={playlistId === OLD_SONG.playlistId}
          className={tabClass(playlistId === OLD_SONG.playlistId)}
        >
          {OLD_SONG.label}
        </button>

        <div ref={menuRef} className="relative shrink-0">
          <button
            ref={yearButtonRef}
            type="button"
            onClick={toggleYearMenu}
            aria-pressed={isYearActive}
            aria-expanded={yearMenuOpen}
            className={tabClass(isYearActive)}
          >
            By Year ▾
          </button>

          {yearMenuOpen && yearMenuPos && (
            <div
              style={{ position: "fixed", top: yearMenuPos.top, left: yearMenuPos.left, transform: "translate(-50%, -100%)" }}
              className="z-20 w-28 overflow-hidden rounded-2xl border border-ochre/25 bg-charcoal/95 shadow-xl backdrop-blur-md"
            >
              {YEARS.map((year) => (
                <button
                  key={year.playlistId}
                  type="button"
                  onClick={() => {
                    setPlaylistId(year.playlistId);
                    setYearMenuOpen(false);
                  }}
                  className={`block w-full px-4 py-2 text-center font-mono text-[11px] uppercase tracking-widest transition-colors ${
                    playlistId === year.playlistId
                      ? "bg-ochre text-charcoal"
                      : "text-rice/70 hover:bg-ochre/15 hover:text-rice"
                  }`}
                >
                  {year.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setPlaylistId(COVER_SONG.playlistId)}
          aria-pressed={playlistId === COVER_SONG.playlistId}
          className={tabClass(playlistId === COVER_SONG.playlistId)}
        >
          {COVER_SONG.label}
        </button>

        <button
          type="button"
          onClick={() => setPlaylistId(INSTRUMENTAL.playlistId)}
          aria-pressed={playlistId === INSTRUMENTAL.playlistId}
          className={tabClass(playlistId === INSTRUMENTAL.playlistId)}
        >
          {INSTRUMENTAL.label}
        </button>
      </div>

      <YouTubePlayer key={playlistId} playlistId={playlistId} />
    </div>
  );
}
