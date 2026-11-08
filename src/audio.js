// ==============================================================================
// AUDIO CONTROLLER & BACKGROUND MUSIC SINGLETON
// Strict Rules:
// - All music lives here in src/audio.js with startMusic, stopMusic, duckMusic.
// - Exactly ONE audio object stored on window.__ccMusic.
// - Audio loop is always false.
// - On ended event: pause, set window.__ccMusicDone = true, sessionStorage cc_music_done = 1,
//   remove all fallback listeners, disable navbar sound control, log exactly one "MUSIC DONE".
// - Every code path that can start music checks the done flag first and does nothing when set.
// - intro=1 query string resets the done flag for replay.
// - musictest=1 query string seeks to 3 seconds before the end.
// - Plain comment above every function.
// - No hash symbol anywhere in this file.
// ==============================================================================

import { siteContent } from './content.js';

const MUSIC_SRC = '/audio-web/drop.mp3';
const TARGET_VOLUME = 0.35;
let fadeIntervalId = null;

// Track AudioContext creation globally for audiodebug inspection
if (typeof window !== 'undefined' && !window.__ccAudioContextTracked) {
  window.__ccAudioContextTracked = true;
  window.__audioContextCount = 0;
  const OrigCtx = window.AudioContext || window.webkitAudioContext;
  if (OrigCtx) {
    const WrappedCtx = function (...args) {
      window.__audioContextCount = (window.__audioContextCount || 0) + 1;
      return new OrigCtx(...args);
    };
    WrappedCtx.prototype = OrigCtx.prototype;
    if (window.AudioContext) window.AudioContext = WrappedCtx;
    if (window.webkitAudioContext) window.webkitAudioContext = WrappedCtx;
  }
}

/**
 * Checks whether music has already finished playing for this session.
 * Query string intro=1 resets the flag for a replay.
 */
export function isMusicDone() {
  if (typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  if (params.get('intro') === '1') {
    window.__ccMusicDone = false;
    try {
      sessionStorage.removeItem('cc_music_done');
      sessionStorage.removeItem('campuscode_music_time');
    } catch (e) {}
    return false;
  }

  if (window.__ccMusicDone) return true;

  try {
    if (sessionStorage.getItem('cc_music_done') === '1') {
      window.__ccMusicDone = true;
      return true;
    }
  } catch (e) {}

  return false;
}

/**
 * Marks music as completed once the track ends and permanently disables playback.
 */
function markMusicDone() {
  window.__ccMusicDone = true;
  try {
    sessionStorage.setItem('cc_music_done', '1');
  } catch (e) {}

  const music = window.__ccMusic;
  if (music) {
    music.pause();
  }

  hideTapForSoundPrompt();
  removeOneTimeGestureListeners();
  disableNavbarSoundControl();

  if (!window.__ccMusicDoneLogged) {
    window.__ccMusicDoneLogged = true;
    console.log('MUSIC DONE');
  }
}

/**
 * Returns the sound-enabled state stored in sessionStorage, defaulting to true.
 */
function getStoredSoundPreference() {
  try {
    const val = sessionStorage.getItem('campuscode_sound_enabled');
    if (val === null) return true;
    return val === 'true';
  } catch (err) {
    return true;
  }
}

/**
 * Returns saved playback timestamp from sessionStorage.
 */
function getStoredPlaybackTime() {
  try {
    const val = sessionStorage.getItem('campuscode_music_time');
    return val ? parseFloat(val) : 0;
  } catch (err) {
    return 0;
  }
}

/**
 * Saves current playback timestamp to sessionStorage.
 */
function setStoredPlaybackTime(time) {
  try {
    sessionStorage.setItem('campuscode_music_time', String(time));
  } catch (err) {}
}

/**
 * Saves the sound-enabled preference to sessionStorage.
 */
function setStoredSoundPreference(enabled) {
  try {
    sessionStorage.setItem('campuscode_sound_enabled', enabled ? 'true' : 'false');
  } catch (err) {}
}

/**
 * Smoothly ramps audio volume between current level and target level over durationMs.
 */
function rampMusicVolume(targetVol, durationMs = 1500, onComplete) {
  const music = window.__ccMusic;
  if (!music) return;

  if (fadeIntervalId) {
    clearInterval(fadeIntervalId);
    fadeIntervalId = null;
  }

  const startVol = music.volume;
  const startTime = Date.now();
  const stepInterval = 25;

  fadeIntervalId = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(1, elapsed / durationMs);
    const newVol = startVol + (targetVol - startVol) * progress;
    music.volume = Math.max(0, Math.min(1, newVol));

    if (progress >= 1) {
      clearInterval(fadeIntervalId);
      fadeIntervalId = null;
      if (onComplete) onComplete();
    }
  }, stepInterval);
}

/**
 * Displays the TAP ANYWHERE FOR SOUND label in the bottom-left corner of the opening stage.
 */
function showTapForSoundPrompt() {
  if (isMusicDone()) return;
  const music = window.__ccMusic;
  if (music && !music.paused) return;

  const existing = document.querySelector('.tap-for-sound-prompt');
  if (existing) return;

  const prompt = document.createElement('div');
  prompt.className = 'tap-for-sound-prompt';
  prompt.textContent = siteContent?.landing?.audio?.tapAnywhereSound || 'TAP ANYWHERE FOR SOUND';

  const overlay = document.querySelector('.opening-stage-overlay');
  if (overlay && overlay.style.display !== 'none') {
    overlay.appendChild(prompt);
  } else {
    document.body.appendChild(prompt);
  }
}

/**
 * Removes the TAP ANYWHERE FOR SOUND label from the DOM.
 */
function hideTapForSoundPrompt() {
  const prompt = document.querySelector('.tap-for-sound-prompt');
  if (prompt) {
    prompt.remove();
  }
}

/**
 * Active fallback resume handler for one-time gestures.
 */
function onGestureResume() {
  if (isMusicDone()) {
    removeOneTimeGestureListeners();
    hideTapForSoundPrompt();
    return;
  }
  const music = window.__ccMusic;
  if (music && music.paused && getStoredSoundPreference()) {
    music.play().then(() => {
      rampMusicVolume(TARGET_VOLUME, 800);
      hideTapForSoundPrompt();
    }).catch(() => {});
  }
  removeOneTimeGestureListeners();
}

/**
 * Removes all fallback gesture listeners.
 */
function removeOneTimeGestureListeners() {
  window.removeEventListener('pointerdown', onGestureResume);
  window.removeEventListener('keydown', onGestureResume);
  window.removeEventListener('touchstart', onGestureResume);
  window.__ccGestureRegistered = false;
}

/**
 * Attaches a one-time user gesture listener (pointerdown, keydown, touchstart)
 * to unblock playback if browser policy prevented autoplay.
 */
function registerOneTimeGestureListener() {
  if (isMusicDone() || window.__ccGestureRegistered) return;
  window.__ccGestureRegistered = true;

  window.addEventListener('pointerdown', onGestureResume, { once: true });
  window.addEventListener('keydown', onGestureResume, { once: true });
  window.addEventListener('touchstart', onGestureResume, { once: true, passive: true });
}

/**
 * Starts background music playback smoothly fading in to 35% volume.
 * Guarantees that only ONE audio instance ever exists on window.__ccMusic.
 * If music has already ended in this session, does nothing.
 */
export function startMusic(fadeDurationMs = 1500) {
  if (isMusicDone()) {
    disableNavbarSoundControl();
    return null;
  }

  window.__musicStartCount = (window.__musicStartCount || 0) + 1;
  console.log('MUSIC START', window.__musicStartCount);
  if (window.__musicStartCount > 1) {
    console.warn('WARNING: MUSIC START called more than once!', window.__musicStartCount);
  }

  // Strictly return immediately if audio object already exists on window.__ccMusic
  if (window.__ccMusic) {
    const music = window.__ccMusic;
    if (music.paused && getStoredSoundPreference()) {
      music.play().then(() => {
        rampMusicVolume(TARGET_VOLUME, 600);
        hideTapForSoundPrompt();
      }).catch(() => {
        showTapForSoundPrompt();
        registerOneTimeGestureListener();
      });
    }
    updateSoundToggleButtons();
    return window.__ccMusic;
  }

  const music = new Audio(MUSIC_SRC);
  window.__ccMusic = music;
  // Audio loop is strictly and always false
  music.loop = false;
  music.preload = 'auto';
  music.volume = 0;

  // musictest=1 query string seeks to 3 seconds before the end for testing
  const params = new URLSearchParams(window.location.search);
  const isMusicTest = params.get('musictest') === '1';

  const applySeekPosition = () => {
    if (isMusicTest && music.duration && Number.isFinite(music.duration)) {
      music.currentTime = Math.max(0, music.duration - 3);
      return;
    }
    const savedTime = getStoredPlaybackTime();
    if (savedTime && Number.isFinite(savedTime) && music.duration && savedTime < music.duration) {
      try {
        music.currentTime = savedTime;
      } catch (err) {}
    }
  };

  if (music.readyState >= 1) {
    applySeekPosition();
  } else {
    music.addEventListener('loadedmetadata', applySeekPosition, { once: true });
  }

  // Continuously record playback timestamp while active
  music.addEventListener('timeupdate', () => {
    if (music && !music.paused) {
      setStoredPlaybackTime(music.currentTime);
    }
  });

  window.addEventListener('beforeunload', () => {
    if (music) {
      setStoredPlaybackTime(music.currentTime);
    }
  });

  // On ended event: pause, set done flags, remove listeners, disable navbar sound, log MUSIC DONE
  music.addEventListener('ended', () => {
    markMusicDone();
  });

  if (!getStoredSoundPreference()) {
    music.volume = 0;
    music.pause();
    updateSoundToggleButtons();
    return music;
  }

  const playPromise = music.play();
  if (playPromise !== undefined) {
    playPromise
      .then(() => {
        rampMusicVolume(TARGET_VOLUME, fadeDurationMs);
        hideTapForSoundPrompt();
        updateSoundToggleButtons();
      })
      .catch(() => {
        showTapForSoundPrompt();
        registerOneTimeGestureListener();
      });
  }

  updateSoundToggleButtons();
  return music;
}

/**
 * Stops background music playback and smoothly fades out volume.
 */
export function stopMusic(fadeDurationMs = 400) {
  const music = window.__ccMusic;
  if (!music) return;

  rampMusicVolume(0, fadeDurationMs, () => {
    music.pause();
  });
}

/**
 * Ducks background music when video plays with sound, and restores it when video stops/mutes.
 */
export function duckMusic(isDucked) {
  if (isMusicDone()) return;
  const music = window.__ccMusic;
  if (!music || !getStoredSoundPreference()) return;

  if (isDucked) {
    rampMusicVolume(0, 500);
  } else {
    if (music.paused) {
      music.play().then(() => {
        rampMusicVolume(TARGET_VOLUME, 800);
      }).catch(() => {});
    } else {
      rampMusicVolume(TARGET_VOLUME, 800);
    }
  }
}

/**
 * Toggles global sound on or off via navbar buttons.
 * While playing it pauses and resumes without ever restarting from zero.
 * When music is done, it performs no action.
 */
export function toggleGlobalSound() {
  if (isMusicDone()) {
    disableNavbarSoundControl();
    return;
  }

  const isEnabled = getStoredSoundPreference();
  const nextState = !isEnabled;
  setStoredSoundPreference(nextState);

  const music = window.__ccMusic;
  if (nextState) {
    if (!music) {
      startMusic(800);
    } else {
      const playPromise = music.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          rampMusicVolume(TARGET_VOLUME, 800);
        }).catch(() => {
          registerOneTimeGestureListener();
        });
      }
    }
  } else {
    if (music) {
      rampMusicVolume(0, 300, () => {
        music.pause();
      });
    }
  }

  updateSoundToggleButtons();
}

/**
 * Disables the navbar sound control once the single playback has finished.
 */
function disableNavbarSoundControl() {
  const buttons = document.querySelectorAll('.sound-toggle-btn');
  buttons.forEach((btn) => {
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('disabled', 'true');
    btn.classList.remove('is-sound-active');
    btn.classList.add('is-sound-muted', 'is-sound-disabled');
    btn.style.pointerEvents = 'none';
    btn.style.opacity = '0.5';
    const textEl = btn.querySelector('.sound-text');
    if (textEl) {
      textEl.textContent = siteContent.landing.audio.soundOff;
    }
  });
}

/**
 * Updates UI labels and active state on all sound toggle buttons across the page.
 */
export function updateSoundToggleButtons() {
  if (isMusicDone()) {
    disableNavbarSoundControl();
    return;
  }

  const isEnabled = getStoredSoundPreference();
  const buttons = document.querySelectorAll('.sound-toggle-btn');
  buttons.forEach((btn) => {
    btn.removeAttribute('disabled');
    btn.style.pointerEvents = 'auto';
    btn.style.opacity = '1';
    btn.setAttribute('aria-pressed', isEnabled ? 'true' : 'false');
    const textEl = btn.querySelector('.sound-text');
    if (textEl) {
      textEl.textContent = isEnabled
        ? siteContent.landing.audio.soundOn
        : siteContent.landing.audio.soundOff;
    }
    if (isEnabled) {
      btn.classList.add('is-sound-active');
      btn.classList.remove('is-sound-muted', 'is-sound-disabled');
    } else {
      btn.classList.remove('is-sound-active');
      btn.classList.add('is-sound-muted');
    }
  });
}

/**
 * Mounts a flat black audiodebug HUD box when ?audiodebug=1 query string is present.
 */
function initAudioDebugHud() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('audiodebug') !== '1') return;

  const existingBox = document.querySelector('.audio-debug-hud-box');
  if (existingBox) return;

  const box = document.createElement('div');
  box.className = 'audio-debug-hud-box';
  box.style.position = 'fixed';
  box.style.bottom = '12px';
  box.style.left = '12px';
  box.style.zIndex = '999999';
  box.style.background = 'rgb(8, 8, 12)';
  box.style.color = 'rgb(255, 255, 255)';
  box.style.border = '1px solid rgb(168, 230, 46)';
  box.style.padding = '10px 14px';
  box.style.fontFamily = 'monospace';
  box.style.fontSize = '11px';
  box.style.lineHeight = '1.45';
  box.style.pointerEvents = 'none';
  box.style.borderRadius = '0px';
  box.style.boxShadow = '4px 4px 0px rgb(168, 230, 46)';

  document.body.appendChild(box);

  const updateHud = () => {
    const audioElements = Array.from(document.querySelectorAll('audio'));
    const videoElements = Array.from(document.querySelectorAll('video'));
    const windowAudio = window.__ccMusic ? [window.__ccMusic] : [];
    const allAudios = Array.from(new Set([...audioElements, ...windowAudio]));

    let html = `<strong style="color:rgb(168,230,46);">AUDIO DEBUG (audiodebug=1)</strong><br/>`;
    html += `Music Done Flag: ${isMusicDone()}<br/>`;
    html += `Music Starts Logged: ${window.__musicStartCount || 0}<br/>`;
    html += `AudioContext Objects: ${window.__audioContextCount || 0}<br/>`;
    html += `Audio Elements (${allAudios.length}):<br/>`;

    if (allAudios.length === 0) {
      html += `  (none instantiated)<br/>`;
    } else {
      allAudios.forEach((a, i) => {
        const isSingleton = a === window.__ccMusic ? ' [window.__ccMusic]' : '';
        html += `  [Audio ${i + 1}${isSingleton}] paused: <span style="color:${a.paused ? 'rgb(255,100,100)' : 'rgb(168,230,46)'}">${a.paused}</span> | vol: ${(a.volume).toFixed(2)} | time: ${(a.currentTime).toFixed(2)}s<br/>`;
      });
    }

    html += `Video Elements (${videoElements.length}):<br/>`;
    if (videoElements.length === 0) {
      html += `  (none)<br/>`;
    } else {
      videoElements.forEach((v, i) => {
        html += `  [Video ${i + 1}] paused: <span style="color:${v.paused ? 'rgb(255,100,100)' : 'rgb(168,230,46)'}">${v.paused}</span> | muted: ${v.muted}<br/>`;
      });
    }

    const nonPausedMediaCount = [...allAudios, ...videoElements].filter((m) => !m.paused).length;
    html += `Active Non-Paused Media: <strong style="color:${nonPausedMediaCount === 1 ? 'rgb(168,230,46)' : 'rgb(255,200,80)'}">${nonPausedMediaCount}</strong>`;

    box.innerHTML = html;
  };

  updateHud();
  setInterval(updateHud, 250);
}

/**
 * Initializes audio system on page load and sets up global handlers once.
 */
export function initAudioSystem() {
  initAudioDebugHud();

  if (isMusicDone()) {
    disableNavbarSoundControl();
    return;
  }

  let hasPassedIntro = false;
  try {
    hasPassedIntro = sessionStorage.getItem('campuscode_intro_done') === 'true';
  } catch (e) {}

  // If visitor already completed intro in this tab, continue playback seamlessly
  if (hasPassedIntro && getStoredSoundPreference() && !isMusicDone()) {
    startMusic(1000);
  }

  // Register document visibility handler once
  if (!window.__ccVisibilityHandlerRegistered) {
    window.__ccVisibilityHandlerRegistered = true;
    document.addEventListener('visibilitychange', () => {
      if (isMusicDone()) return;
      const music = window.__ccMusic;
      if (!music) return;
      if (document.hidden) {
        music.pause();
      } else {
        if (getStoredSoundPreference() && !isMusicDone()) {
          music.play().catch(() => {});
        }
      }
    });
  }

  // Register navbar button clicks once
  if (!window.__ccNavbarSoundClickRegistered) {
    window.__ccNavbarSoundClickRegistered = true;
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.sound-toggle-btn');
      if (btn) {
        e.preventDefault();
        if (isMusicDone()) return;
        toggleGlobalSound();
      }
    });
  }

  updateSoundToggleButtons();
}

// Vite Hot Module Reload: pause and delete old audio instance to prevent multiple tracks on edit
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (window.__ccMusic) {
      window.__ccMusic.pause();
      delete window.__ccMusic;
    }
  });
}
