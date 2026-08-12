"use strict";

/* ---------- clock ---------- */

const clockEl = document.getElementById("clock");
function updateClock() {
  clockEl.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
updateClock();
setInterval(updateClock, 15000);

/* ---------- category tabs + By Year dropdown ---------- */

const YEAR_PLAYLIST_IDS = new Set(
  Array.from(document.querySelectorAll(".year-option")).map((btn) => btn.dataset.playlist)
);

const tabsRow = document.getElementById("tabs");
const yearBtn = document.getElementById("yearBtn");
const yearPanel = document.getElementById("yearPanel");

let currentPlaylistId = "PLffCnobOvXsU"; // Old Song, the default tab

function setActiveTabStyles() {
  document.querySelectorAll(".tab[data-playlist]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.playlist === currentPlaylistId);
  });
  const isYearActive = YEAR_PLAYLIST_IDS.has(currentPlaylistId);
  yearBtn.classList.toggle("active", isYearActive);
  document.querySelectorAll(".year-option").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.playlist === currentPlaylistId);
  });
}

function selectPlaylist(playlistId) {
  if (playlistId === currentPlaylistId) return;
  currentPlaylistId = playlistId;
  setActiveTabStyles();
  startPlayer(playlistId);
}

document.querySelectorAll(".tab[data-playlist]").forEach((btn) => {
  btn.addEventListener("click", () => selectPlaylist(btn.dataset.playlist));
});

document.querySelectorAll(".year-option").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectPlaylist(btn.dataset.playlist);
    closeYearMenu();
  });
});

function openYearMenu() {
  const rect = yearBtn.getBoundingClientRect();
  // positioned in the body-level #yearPanel (outside the backdrop-blur tab
  // row) so a `position: fixed` panel isn't clipped/mispositioned by that
  // ancestor's containing-block-for-fixed-descendants behavior
  yearPanel.style.top = `${rect.top - 8}px`;
  yearPanel.style.left = `${rect.left + rect.width / 2}px`;
  yearPanel.style.transform = "translate(-50%, -100%)";
  yearPanel.hidden = false;
  yearBtn.setAttribute("aria-expanded", "true");
}

function closeYearMenu() {
  yearPanel.hidden = true;
  yearBtn.setAttribute("aria-expanded", "false");
}

yearBtn.addEventListener("click", () => {
  if (yearPanel.hidden) openYearMenu();
  else closeYearMenu();
});

document.addEventListener("pointerdown", (e) => {
  if (yearPanel.hidden) return;
  if (!yearBtn.contains(e.target) && !yearPanel.contains(e.target)) closeYearMenu();
});

tabsRow.addEventListener("scroll", closeYearMenu);

setActiveTabStyles();

/* ---------- YouTube IFrame player ---------- */

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

let apiLoadPromise = null;
function loadYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise((resolve) => {
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (previous) previous();
      resolve(window.YT);
    };
    const poll = setInterval(() => {
      if (window.YT && window.YT.Player) {
        clearInterval(poll);
        resolve(window.YT);
      }
    }, 100);
  });
  return apiLoadPromise;
}

const MAX_SKIP_RETRIES = 15;
// some playlists (e.g. a large, old, mixed-source one) have long runs of
// consecutive embedding-restricted videos, so retries jump to a random
// index within this generous bound rather than walking sequentially —
// safe even for shorter playlists since YouTube clamps an out-of-range
// index to the last video.
const RETRY_INDEX_POOL = 300;

const hostEl = document.getElementById("yt-host");
const thumbEl = document.getElementById("thumb");
const thumbFallbackEl = document.getElementById("thumbFallback");
const titleEl = document.getElementById("title");
const authorEl = document.getElementById("author");
const prevBtn = document.getElementById("prevBtn");
const playBtn = document.getElementById("playBtn");
const nextBtn = document.getElementById("nextBtn");
const playIcon = document.getElementById("playIcon");
const pauseIcon = document.getElementById("pauseIcon");
const seekEl = document.getElementById("seek");
const seekFillEl = document.getElementById("seekFill");
const timeEl = document.getElementById("time");

let ytPlayer = null;
let ready = false;
let playing = false;
let duration = 0;
let elapsed = 0;
let tickTimer = null;
let setupToken = 0; // bumped on every tab switch to invalidate in-flight retries from the previous playlist

function setThumbnail(videoId) {
  if (!videoId) {
    thumbEl.hidden = true;
    thumbFallbackEl.hidden = false;
    return;
  }
  thumbEl.hidden = false;
  thumbFallbackEl.hidden = true;
  thumbEl.onerror = () => {
    thumbEl.hidden = true;
    thumbFallbackEl.hidden = false;
  };
  thumbEl.src = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

function refreshTrackInfo(player) {
  const data = player.getVideoData();
  titleEl.textContent = data.title || "Untitled";
  authorEl.textContent = data.author || "";
  duration = player.getDuration();
  setThumbnail(data.video_id);
}

function setReady(value) {
  ready = value;
  prevBtn.disabled = !value;
  playBtn.disabled = !value;
  nextBtn.disabled = !value;
}

function setPlaying(value) {
  playing = value;
  playIcon.hidden = value;
  pauseIcon.hidden = !value;
  playBtn.setAttribute("aria-label", value ? "Pause" : "Play");
  if (value) {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(() => {
      if (ytPlayer) {
        elapsed = ytPlayer.getCurrentTime();
        renderProgress();
      }
    }, 500);
  } else if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

function renderProgress() {
  const pct = duration ? (elapsed / duration) * 100 : 0;
  seekFillEl.style.width = `${pct}%`;
  seekEl.setAttribute("aria-valuenow", String(Math.round(elapsed)));
  seekEl.setAttribute("aria-valuemax", String(duration));
  timeEl.textContent = `${formatTime(elapsed)} / ${formatTime(duration)}`;
}

function startPlayer(playlistId) {
  const token = ++setupToken;
  setReady(false);
  setPlaying(false);
  elapsed = 0;
  duration = 0;
  renderProgress();
  titleEl.textContent = "Loading playlist…";
  authorEl.textContent = "";
  setThumbnail(null);

  let retryCount = 0;
  let retryTimer = null;

  function setup(YT, index, autoplay) {
    if (token !== setupToken) return;
    if (ytPlayer) ytPlayer.destroy();

    ytPlayer = new YT.Player(hostEl, {
      height: "1",
      width: "1",
      playerVars: { listType: "playlist", list: playlistId, index, autoplay },
      events: {
        onReady: (e) => {
          if (token !== setupToken) return;
          // shuffle so the playlist doesn't always play in the same serial
          // order — re-rolled fresh on every page load
          e.target.setShuffle(true);
          setReady(true);
          refreshTrackInfo(e.target);
        },
        onStateChange: (e) => {
          if (token !== setupToken) return;
          if (e.data === YT.PlayerState.PLAYING) {
            retryCount = 0;
            setPlaying(true);
            refreshTrackInfo(e.target);
          } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
            setPlaying(false);
          }
        },
        onError: () => {
          if (token !== setupToken) return;
          if (retryCount >= MAX_SKIP_RETRIES) {
            // every retry hit a video the owner blocked from embedding —
            // stop spinning forever and say so instead
            titleEl.textContent = "Playback unavailable for this playlist";
            authorEl.textContent = "";
            setPlaying(false);
            return;
          }
          retryCount += 1;
          const nextIndex = Math.floor(Math.random() * RETRY_INDEX_POOL);
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = setTimeout(() => {
            if (token === setupToken) setup(YT, nextIndex, 1);
          }, 1200);
        },
      },
    });
  }

  loadYouTubeApi().then((YT) => {
    if (token === setupToken) setup(YT, 0, 0);
  });
}

playBtn.addEventListener("click", () => {
  if (!ytPlayer) return;
  if (playing) ytPlayer.pauseVideo();
  else ytPlayer.playVideo();
});
nextBtn.addEventListener("click", () => ytPlayer && ytPlayer.nextVideo());
prevBtn.addEventListener("click", () => ytPlayer && ytPlayer.previousVideo());

seekEl.addEventListener("click", (e) => {
  if (!ytPlayer || !duration) return;
  const rect = seekEl.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  const target = ratio * duration;
  ytPlayer.seekTo(target, true);
  elapsed = target;
  renderProgress();
});

startPlayer(currentPlaylistId);
