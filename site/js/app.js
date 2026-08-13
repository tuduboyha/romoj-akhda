"use strict";

/* ---------- clock ---------- */

const clockEl = document.getElementById("clock");
function updateClock() {
  clockEl.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
updateClock();
setInterval(updateClock, 15000);

/* ---------- PWA install ---------- */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}

const installBtn = document.getElementById("installBtn");
let deferredInstallPrompt = null;

// only Chromium browsers fire this; the button stays hidden everywhere
// else (Safari/iOS has no install-prompt API — users add to Home Screen
// via the share sheet instead)
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  installBtn.hidden = false;
});

installBtn.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  installBtn.hidden = true;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
});

window.addEventListener("appinstalled", () => {
  installBtn.hidden = true;
  deferredInstallPrompt = null;
});

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
  closeTracklist();
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
const shuffleBtn = document.getElementById("shuffleBtn");
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
// on by default (playlists re-roll their order on every page load) but
// the user can turn it off; the preference carries across tab switches
let shuffleEnabled = true;

shuffleBtn.addEventListener("click", () => {
  shuffleEnabled = !shuffleEnabled;
  shuffleBtn.setAttribute("aria-pressed", String(shuffleEnabled));
  if (ytPlayer && ytPlayer.setShuffle) ytPlayer.setShuffle(shuffleEnabled);
});
let setupToken = 0; // bumped on every tab switch to invalidate in-flight retries from the previous playlist

function setThumbnail(videoId) {
  // the base `img { display: block }` rule beats the `hidden` attribute's
  // UA-stylesheet rule (author styles always win), so visibility is set
  // directly instead — same fix as the play/pause icons needed
  if (!videoId) {
    thumbEl.style.display = "none";
    thumbFallbackEl.style.display = "";
    return;
  }
  thumbEl.style.display = "";
  thumbFallbackEl.style.display = "none";
  thumbEl.onerror = () => {
    thumbEl.style.display = "none";
    thumbFallbackEl.style.display = "";
  };
  thumbEl.src = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

let currentVideoId = null;

function refreshTrackInfo(player) {
  const data = player.getVideoData();
  titleEl.textContent = data.title || "Untitled";
  authorEl.textContent = data.author || "";
  duration = player.getDuration();
  setThumbnail(data.video_id);
  currentVideoId = data.video_id || null;
  highlightActiveTrack();
}

function setReady(value) {
  ready = value;
  prevBtn.disabled = !value;
  playBtn.disabled = !value;
  nextBtn.disabled = !value;
  shuffleBtn.disabled = !value;
}

function setPlaying(value) {
  playing = value;
  // `.hidden` isn't reliably attribute-reflected on <svg> elements in
  // every browser, so visibility is toggled directly instead
  playIcon.style.display = value ? "none" : "block";
  pauseIcon.style.display = value ? "block" : "none";
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
          e.target.setShuffle(shuffleEnabled);
          setReady(true);
          refreshTrackInfo(e.target);
        },
        onStateChange: (e) => {
          if (token !== setupToken) return;
          if (e.data === YT.PlayerState.PLAYING) {
            retryCount = 0;
            setPlaying(true);
            refreshTrackInfo(e.target);
            // getVideoData().title can briefly lag behind video_id right
            // after a programmatic jump (e.g. clicking a tracklist item),
            // so re-check once the metadata has had a moment to settle
            const jumpedVideoId = e.target.getVideoData().video_id;
            setTimeout(() => {
              if (token === setupToken && e.target.getVideoData().video_id === jumpedVideoId) {
                refreshTrackInfo(e.target);
              }
            }, 500);
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

// YouTube's playlist `index` playerVar isn't reliably addressable — it
// doesn't consistently map to the same position `getPlaylist()` reports,
// so it's only good enough for "land on *some* playable video" (the
// error-retry path above). Jumping to one specific track chosen from the
// tracklist instead loads that exact video ID directly, which is
// unambiguous. Playlist-relative next/prev is lost for that one track,
// which is an acceptable trade-off for picking an exact song.
function playTrack(videoId, knownTitle) {
  const token = ++setupToken;
  setReady(false);
  setPlaying(false);
  elapsed = 0;
  duration = 0;
  renderProgress();
  titleEl.textContent = knownTitle || "Loading…";
  authorEl.textContent = "";
  setThumbnail(videoId);

  loadYouTubeApi().then((YT) => {
    if (token !== setupToken) return;
    if (ytPlayer) ytPlayer.destroy();

    ytPlayer = new YT.Player(hostEl, {
      height: "1",
      width: "1",
      videoId,
      playerVars: { autoplay: 1 },
      events: {
        onReady: (e) => {
          if (token !== setupToken) return;
          setReady(true);
          refreshTrackInfo(e.target);
          // getVideoData().title is unreliable right at onReady — the
          // title we already fetched for the tracklist is trustworthy
          if (knownTitle) titleEl.textContent = knownTitle;
        },
        onStateChange: (e) => {
          if (token !== setupToken) return;
          if (e.data === YT.PlayerState.PLAYING) {
            setPlaying(true);
          } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
            setPlaying(false);
          }
        },
      },
    });
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

/* ---------- in-page tracklist (no redirect to youtube.com) ---------- */

const tracklistToggle = document.getElementById("tracklistToggle");
const tracklistModal = document.getElementById("tracklistModal");
const tracklistBackdrop = document.getElementById("tracklistBackdrop");
const tracklistClose = document.getElementById("tracklistClose");
const tracklistStatusEl = document.getElementById("tracklistStatus");
const tracklistItemsEl = document.getElementById("tracklistItems");

const TITLE_FETCH_CONCURRENCY = 6;
const tracklistCache = {}; // playlistId -> { items: [{videoId, title}], loaded }
let tracklistOpen = false;

function closeTracklist() {
  tracklistOpen = false;
  tracklistModal.hidden = true;
  tracklistToggle.setAttribute("aria-expanded", "false");
}

function openTracklist() {
  tracklistOpen = true;
  tracklistModal.hidden = false;
  tracklistToggle.setAttribute("aria-expanded", "true");
  loadTracklist(currentPlaylistId);
}

function highlightActiveTrack() {
  tracklistItemsEl.querySelectorAll(".track-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.videoId === currentVideoId);
  });
}

function renderTracklist(items) {
  tracklistItemsEl.innerHTML = "";
  const frag = document.createDocumentFragment();
  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "track-item";
    li.dataset.videoId = item.videoId;
    if (item.videoId === currentVideoId) li.classList.add("active");
    li.innerHTML = `<img src="https://i.ytimg.com/vi/${item.videoId}/default.jpg" alt="" loading="lazy" /><span>${item.title || "Loading…"}</span>`;
    li.addEventListener("click", () => {
      currentVideoId = item.videoId;
      highlightActiveTrack();
      playTrack(item.videoId, item.title);
    });
    frag.appendChild(li);
  });
  tracklistItemsEl.appendChild(frag);
}

function updateTrackTitle(items, index, title) {
  items[index].title = title;
  const span = tracklistItemsEl.children[index]?.querySelector("span");
  if (span) span.textContent = title;
}

async function fetchTitles(playlistId, items) {
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      const videoId = items[index].videoId;
      let title = "Untitled";
      try {
        const res = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`
        );
        if (res.ok) title = (await res.json()).title || title;
      } catch {
        // keep the "Untitled" fallback — a network hiccup on one track
        // shouldn't stop the rest of the list from filling in
      }
      // the playlist tab may have changed while this was in flight
      if (currentPlaylistId !== playlistId) return;
      updateTrackTitle(items, index, title);
    }
  }
  await Promise.all(Array.from({ length: TITLE_FETCH_CONCURRENCY }, worker));
  if (tracklistCache[playlistId]) tracklistCache[playlistId].loaded = true;
}

function loadTracklist(playlistId) {
  const cached = tracklistCache[playlistId];
  if (cached) {
    renderTracklist(cached.items);
    tracklistStatusEl.textContent = `${cached.items.length} tracks`;
    return;
  }

  if (!ytPlayer || !ready) {
    tracklistStatusEl.textContent = "Playlist is still loading — try again in a moment.";
    tracklistItemsEl.innerHTML = "";
    return;
  }

  const videoIds = ytPlayer.getPlaylist();
  if (!videoIds || !videoIds.length) {
    tracklistStatusEl.textContent = "Couldn't load this playlist's tracklist.";
    tracklistItemsEl.innerHTML = "";
    return;
  }

  const items = videoIds.map((videoId) => ({ videoId, title: null }));
  tracklistCache[playlistId] = { items, loaded: false };
  tracklistStatusEl.textContent = `${items.length} tracks`;
  renderTracklist(items);
  fetchTitles(playlistId, items);
}

tracklistToggle.addEventListener("click", () => {
  if (tracklistOpen) closeTracklist();
  else openTracklist();
});

tracklistClose.addEventListener("click", closeTracklist);
tracklistBackdrop.addEventListener("click", closeTracklist);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && tracklistOpen) closeTracklist();
});

startPlayer(currentPlaylistId);
