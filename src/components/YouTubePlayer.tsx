"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Minimal surface of the YouTube IFrame Player API actually used here.
 * The full API surface isn't typed upstream, so this is hand-trimmed
 * rather than pulled in via `any`.
 */
interface YTPlayerInstance {
  playVideo(): void;
  pauseVideo(): void;
  nextVideo(): void;
  previousVideo(): void;
  setShuffle(shufflePlaylist: boolean): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getVideoData(): { title: string; author: string; video_id: string };
  destroy(): void;
}

interface YTPlayerEvent {
  data: number;
  target: YTPlayerInstance;
}

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      height: string;
      width: string;
      playerVars: Record<string, number | string>;
      events: {
        onReady?: (e: YTPlayerEvent) => void;
        onStateChange?: (e: YTPlayerEvent) => void;
        onError?: (e: YTPlayerEvent) => void;
      };
    }
  ) => YTPlayerInstance;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

let apiLoadPromise: Promise<YTNamespace> | null = null;

// `window.onYouTubeIframeAPIReady` fires exactly once globally, but this
// loader can be called again after a remount (e.g. dev-mode fast refresh)
// once that callback has already fired — so a plain "wait for the callback"
// promise would hang forever the second time. Polling for `window.YT` is
// the robust fallback that resolves regardless of callback timing.
function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise((resolve) => {
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };

    const poll = setInterval(() => {
      if (window.YT?.Player) {
        clearInterval(poll);
        resolve(window.YT);
      }
    }, 100);
  });
  return apiLoadPromise;
}

const MAX_SKIP_RETRIES = 5;

export default function YouTubePlayer({ playlistId }: { playlistId: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [title, setTitle] = useState("Loading playlist…");
  const [author, setAuthor] = useState("");
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);

  const refreshTrackInfo = useCallback((player: YTPlayerInstance) => {
    const data = player.getVideoData();
    setTitle(data.title || "Untitled");
    setAuthor(data.author || "");
    setDuration(player.getDuration());
    if (data.video_id) {
      setThumbnailFailed(false);
      setThumbnail(`https://i.ytimg.com/vi/${data.video_id}/mqdefault.jpg`);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    retryCountRef.current = 0;

    loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return;

      const player = new YT.Player(hostRef.current, {
        height: "1",
        width: "1",
        playerVars: { listType: "playlist", list: playlistId, autoplay: 0 },
        events: {
          onReady: (e) => {
            // shuffle so the playlist doesn't always play in the same
            // serial order — re-rolled fresh on every page load
            e.target.setShuffle(true);
            setReady(true);
            refreshTrackInfo(e.target);
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING) {
              retryCountRef.current = 0;
              setPlaying(true);
              refreshTrackInfo(e.target);
            } else if (e.data === YT.PlayerState.PAUSED) {
              setPlaying(false);
            } else if (e.data === YT.PlayerState.ENDED) {
              setPlaying(false);
            }
          },
          // some playlist videos disallow embedded playback (removed,
          // private, or embedding disabled by the owner) — skip past them
          // automatically. Retries stay on the same player instance and are
          // spaced out with a delay: calling nextVideo() immediately inside
          // onError, or recreating the player in a tight loop, both proved
          // to cascade into every subsequent video failing too (almost
          // certainly YouTube rate-limiting rapid-fire embed churn). A
          // capped, delayed retry avoids that.
          onError: (e) => {
            if (retryCountRef.current >= MAX_SKIP_RETRIES) return;
            retryCountRef.current += 1;
            const target = e.target;
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            retryTimerRef.current = setTimeout(() => {
              target.nextVideo();
              target.playVideo();
            }, 800);
          },
        },
      });
      playerRef.current = player;
    });

    return () => {
      cancelled = true;
      if (tickRef.current) clearInterval(tickRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistId]);

  // poll playback position while playing — YT's API has no timeupdate event
  useEffect(() => {
    if (!playing) {
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }
    tickRef.current = setInterval(() => {
      const player = playerRef.current;
      if (player) setElapsed(player.getCurrentTime());
    }, 500);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [playing]);

  const togglePlay = () => {
    const player = playerRef.current;
    if (!player) return;
    if (playing) player.pauseVideo();
    else player.playVideo();
  };

  const next = () => playerRef.current?.nextVideo();
  const prev = () => playerRef.current?.previousVideo();

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const player = playerRef.current;
    if (!player || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const target = ratio * duration;
    player.seekTo(target, true);
    setElapsed(target);
  };

  const progressPct = duration ? (elapsed / duration) * 100 : 0;

  return (
    <div className="w-full max-w-2xl rounded-[2.25rem] border-2 border-rice/40 bg-charcoal/75 px-5 py-4 shadow-2xl shadow-black/60 backdrop-blur-md sm:px-7 sm:py-5">
      {/* the actual YouTube video lives here, shrunk to invisible — audio keeps playing */}
      <div className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0">
        <div ref={hostRef} />
      </div>

      <div className="flex items-center gap-4">
        <div
          aria-hidden
          className="relative flex aspect-video h-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-red-600 to-red-900 ring-1 ring-rice/15 sm:h-16"
        >
          {thumbnail && !thumbnailFailed ? (
            // eslint-disable-next-line @next/next/no-img-element -- external, per-track thumbnail; not a build-time-known asset next/image can optimize
            <img
              src={thumbnail}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setThumbnailFailed(true)}
            />
          ) : (
            <svg viewBox="0 0 24 24" className="h-6 w-6 opacity-90" fill="var(--rice)">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-body text-base font-semibold text-rice sm:text-lg">{title}</p>
          <p className="truncate font-mono text-xs text-rice/50 sm:text-sm">{author}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <button
            type="button"
            aria-label="Previous track"
            onClick={prev}
            disabled={!ready}
            className="rounded-full p-2 text-rice/60 transition-colors hover:text-rice disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
            </svg>
          </button>

          <button
            type="button"
            aria-label={playing ? "Pause" : "Play"}
            onClick={togglePlay}
            disabled={!ready}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-rice text-charcoal shadow-lg shadow-black/30 transition-transform hover:scale-105 disabled:opacity-40 sm:h-12 sm:w-12"
          >
            {playing ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M7 5h4v14H7zm6 0h4v14h-4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5 translate-x-0.5" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button
            type="button"
            aria-label="Next track"
            onClick={next}
            disabled={!ready}
            className="rounded-full p-2 text-rice/60 transition-colors hover:text-rice disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <path d="M16 6h2v12h-2zM4 6l8.5 6L4 18z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2.5">
        <div
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={Math.round(elapsed)}
          tabIndex={0}
          onClick={handleSeek}
          className="h-1.5 flex-1 cursor-pointer rounded-full bg-rice/15"
        >
          <div className="h-full rounded-full bg-rice" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="shrink-0 font-mono text-[11px] text-rice/40">
          {formatTime(elapsed)} / {formatTime(duration)}
        </p>
      </div>
    </div>
  );
}
