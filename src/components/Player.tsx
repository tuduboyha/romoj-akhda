"use client";

import { useEffect, useRef, useState } from "react";
import YouTubePlayer from "@/components/YouTubePlayer";

const OLD_SONG = { label: "Old Song", playlistId: "PLhXvuO8eMB222gHBObv2wZoyxGs3Ubu2O" };
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
  const menuRef = useRef<HTMLDivElement>(null);

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

  const tabClass = (active: boolean) =>
    `whitespace-nowrap rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors sm:px-3.5 sm:text-[11px] ${
      active ? "bg-ochre text-charcoal" : "text-rice/60 hover:text-rice"
    }`;

  return (
    <div className="flex flex-col items-center gap-3 px-4 pb-6 sm:pb-8">
      <div className="flex flex-nowrap justify-center gap-1 overflow-x-auto rounded-full border border-ochre/25 bg-charcoal/70 p-1.5 backdrop-blur-md sm:gap-1.5">
        <button
          type="button"
          onClick={() => setPlaylistId(OLD_SONG.playlistId)}
          aria-pressed={playlistId === OLD_SONG.playlistId}
          className={tabClass(playlistId === OLD_SONG.playlistId)}
        >
          {OLD_SONG.label}
        </button>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setYearMenuOpen((open) => !open)}
            aria-pressed={isYearActive}
            aria-expanded={yearMenuOpen}
            className={tabClass(isYearActive)}
          >
            By Year ▾
          </button>

          {yearMenuOpen && (
            <div className="absolute left-1/2 top-full z-20 mt-2 w-28 -translate-x-1/2 overflow-hidden rounded-2xl border border-ochre/25 bg-charcoal/95 shadow-xl backdrop-blur-md">
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
