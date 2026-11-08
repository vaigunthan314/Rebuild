// ==============================================================================
// VERIFICATION SCRIPT FOR CHANGE REQUEST D9
// Tests:
// 1. Materials and colors in Three.js live background (MeshBasicMaterial, exact colors).
// 2. Experience video card (tap play/pause, big indicator pop, separate sound button, no text overlap).
// 3. Section 03 Quest (XP progression, level badge, terminal typing, badges and flying chips).
// 4. Section 04 Arena (3 boarding-pass tickets, 300vh sticky stage, horizontal slide, status word, stub tear).
// 5. Login & Register redesign (50/50 split layout, CC orbit, tips, stats, slide captcha, strength meter, wipe).
// 6. Production FPS measurement.
// Strict rule: ZERO hash symbols anywhere in this file.
// Plain comment above every function.
// ==============================================================================

import { spawn } from 'child_process';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const userDataDir = '/tmp/chrome_d9_test_' + Date.now();

const chromeProc = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9229',
  `--user-data-dir=${userDataDir}`,
  '--window-size=1440,900',
  '--autoplay-policy=no-user-gesture-required',
  'about:blank'
], { stdio: 'ignore' });

process.on('exit', () => {
  try { chromeProc.kill(); } catch (e) {}
});

/**
 * Utility helper to sleep for a given number of milliseconds.
 */
async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Obtains the Chrome DevTools WebSocket debugging URL for a new tab.
 */
async function getWsUrl(url) {
  for (let i = 0; i < 25; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:9229/json/new?${url}`, { method: 'PUT' });
      const data = await res.json();
      if (data && data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
    } catch (err) {}
    await sleep(200);
  }
  throw new Error('Could not connect to Chrome debugger on port 9229');
}

/**
 * Creates an evaluation helper using the open WebSocket connection.
 */
function createCdpClient(ws) {
  let msgId = 1;
  const callbacks = new Map();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && callbacks.has(data.id)) {
      const cb = callbacks.get(data.id);
      callbacks.delete(data.id);
      cb(data);
    }
  };

  const send = (method, params = {}) => {
    const id = msgId++;
    return new Promise((resolve) => {
      callbacks.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  const evaluate = async (expression) => {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.result && res.result.exceptionDetails) {
      throw new Error(JSON.stringify(res.result.exceptionDetails));
    }
    return res.result && res.result.result ? res.result.result.value : undefined;
  };

  return { send, evaluate };
}

/**
 * Main verification routine.
 */
async function run() {
  console.log('--- STARTING CHANGE REQUEST D9 VERIFICATION ---');
  await sleep(1000);

  const wsUrl = await getWsUrl('http://localhost:4173/?intro=1');
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => { ws.onopen = r; });

  const cdp = createCdpClient(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await sleep(1500);

  // 1. Verify Three.js live background materials and colors
  console.log('\n[1] Verifying Three.js live 3D background materials and colors...');
  const threeResult = await cdp.evaluate(`
    (() => {
      const bg = window.__ccThreeBg;
      if (!bg || !bg.materials) {
        return { ok: false, reason: 'window.__ccThreeBg or materials not exposed' };
      }
      const mats = bg.materials;
      const cubeFaceTypes = mats.cubeFaces.map((m) => m.type);
      const cubeFaceColors = mats.cubeFaces.map((m) => m.color.getHexString().toUpperCase());
      const barColors = mats.bars.map((m) => m.color.getHexString().toUpperCase());
      const ringColor = mats.rings.color.getHexString().toUpperCase();
      const sphereColor = mats.sphere.color.getHexString().toUpperCase();
      const discColor = mats.sphereHighlight.color.getHexString().toUpperCase();

      return {
        ok: true,
        cubeFaceTypes,
        cubeFaceColors,
        barColors,
        ringColor,
        sphereColor,
        discColor
      };
    })()
  `);
  console.log('Three.js Materials & Colors:', JSON.stringify(threeResult, null, 2));

  // 2. Verify Experience Video Card: tap play/pause, big indicator pop, separate sound button, no text overlap
  console.log('\n[2] Verifying Experience Video Card interactions & text layout...');
  await cdp.evaluate(`window.scrollTo({ top: window.innerHeight * 5.5, behavior: 'instant' })`);
  await sleep(500);

  const expVideoResult = await cdp.evaluate(`
    (() => {
      const pane = document.querySelector('.exp-video-pane');
      const video = document.querySelector('.experience-native-video');
      const indicator = document.querySelector('.video-toggle-indicator');
      const toggleIcon = document.querySelector('.toggle-indicator-icon');
      const soundBtn = document.querySelector('.exp-sound-btn');
      const soundLabel = document.querySelector('.sound-btn-label');
      const brandLabel = document.querySelector('.exp-video-brand-label');
      const recLabel = document.querySelector('.exp-video-rec');

      if (!pane || !video) return { ok: false, reason: 'Video pane or video element not found' };

      // Overlap check
      const bRect = brandLabel.getBoundingClientRect();
      const rRect = recLabel.getBoundingClientRect();
      const hasOverlap = !(bRect.right < rRect.left || bRect.left > rRect.right || bRect.bottom < rRect.top || bRect.top > rRect.bottom);

      // Sound button initial state
      const initialMuted = video.muted;
      const initialPressed = soundBtn.getAttribute('aria-pressed');

      // Click sound button
      soundBtn.click();
      const soundToggledMuted = video.muted;
      const soundToggledPressed = soundBtn.getAttribute('aria-pressed');

      // Tap pane to toggle play/pause
      const initialPaused = video.paused;
      pane.click();
      const afterTapPaused = video.paused;
      const poppingActive = indicator.classList.contains('is-popping');
      const poppingIcon = toggleIcon.textContent;

      return {
        ok: true,
        hasOverlap,
        brandPos: { top: bRect.top, left: bRect.left },
        recPos: { top: rRect.top, right: window.innerWidth - rRect.right },
        soundInitial: { muted: initialMuted, pressed: initialPressed },
        soundAfterClick: { muted: soundToggledMuted, pressed: soundToggledPressed },
        playPause: { initialPaused, afterTapPaused, poppingActive, poppingIcon }
      };
    })()
  `);
  console.log('Experience Video Card Check:', JSON.stringify(expVideoResult, null, 2));

  // 3. Verify Section 03 Quest
  console.log('\n[3] Verifying Section 03 Quest HUD, progression, badges, mini-demos...');
  await cdp.evaluate(`
    (() => {
      const howSec = document.querySelector('.section-how');
      if (howSec) {
        window.scrollTo({ top: howSec.offsetTop + howSec.offsetHeight * 0.35, behavior: 'instant' });
      }
      if (window.ScrollTrigger) ScrollTrigger.update();
    })()
  `);
  await sleep(600);

  const questResult = await cdp.evaluate(`
    (() => {
      const hud = document.querySelector('.how-quest-hud');
      const xpCurrent = document.querySelector('.how-xp-current');
      const xpFill = document.querySelector('.how-xp-bar-fill');
      const levelBadge = document.querySelector('.how-level-badge');
      const termCmd = document.querySelector('.terminal-cmd-text');
      const cards = document.querySelectorAll('.how-step-card');
      const badges = document.querySelectorAll('.quest-badge-hex');
      const chips = document.querySelectorAll('.flying-xp-chip');

      const cardStates = Array.from(cards).map((c, idx) => ({
        step: idx + 1,
        active: c.classList.contains('is-step-active'),
        opacity: window.getComputedStyle(c).opacity,
        badgeSlammed: badges[idx] ? badges[idx].classList.contains('is-slammed') : false,
        chipFlown: chips[idx] ? chips[idx].classList.contains('is-flown') : false
      }));

      return {
        ok: !!hud,
        levelBadgeText: levelBadge ? levelBadge.textContent : '',
        xpValue: xpCurrent ? xpCurrent.textContent : '',
        xpFillWidth: xpFill ? xpFill.style.width : '',
        terminalText: termCmd ? termCmd.textContent : '',
        cardStates
      };
    })()
  `);
  console.log('Section 03 Quest Check:', JSON.stringify(questResult, null, 2));

  // 4. Verify Section 04 Enter the Arena
  console.log('\n[4] Verifying Section 04 Enter the Arena passes carousel...');
  await cdp.evaluate(`
    (() => {
      const arenaSec = document.querySelector('.section-hackathons');
      if (arenaSec) {
        window.scrollTo({ top: arenaSec.offsetTop + arenaSec.offsetHeight * 0.45, behavior: 'instant' });
      }
      if (window.ScrollTrigger) ScrollTrigger.update();
    })()
  `);
  await sleep(600);

  const arenaResult = await cdp.evaluate(`
    (() => {
      const stage = document.querySelector('.arena-sticky-stage');
      const bgWord = document.querySelector('.arena-bg-status-word');
      const counter = document.querySelector('.arena-ticket-counter');
      const cards = document.querySelectorAll('.arena-pass-card');
      const viewAllBtn = document.querySelector('.btn-arena-viewall');
      const modal = document.querySelector('.arena-all-modal-backdrop');

      const ticketStates = Array.from(cards).map((c, idx) => ({
        ticket: idx + 1,
        isActive: c.classList.contains('is-active'),
        isPrev: c.classList.contains('is-prev'),
        isNext: c.classList.contains('is-next'),
        title: c.querySelector('.ticket-title') ? c.querySelector('.ticket-title').textContent : '',
        status: c.querySelector('.stub-status-pill') ? c.querySelector('.stub-status-pill').textContent.trim() : ''
      }));

      // Test modal toggle
      if (viewAllBtn) viewAllBtn.click();
      const modalOpenAfterClick = modal ? modal.classList.contains('is-open') : false;
      const closeBtn = document.querySelector('.arena-modal-close-btn');
      if (closeBtn) closeBtn.click();
      const modalClosedAfterBtn = modal ? modal.classList.contains('is-open') : true;

      return {
        ok: !!stage,
        bgStatusWord: bgWord ? bgWord.textContent : '',
        ticketCounterText: counter ? counter.textContent : '',
        modalTest: { modalOpenAfterClick, modalClosedAfterBtn },
        ticketStates
      };
    })()
  `);
  console.log('Section 04 Arena Passes Check:', JSON.stringify(arenaResult, null, 2));

  // 5. Verify Login & Register Redesign
  console.log('\n[5] Verifying Login & Register redesign pages...');
  const loginWsUrl = await getWsUrl('http://localhost:4173/login.html');
  const loginWs = new WebSocket(loginWsUrl);
  await new Promise((r) => { loginWs.onopen = r; });
  const loginCdp = createCdpClient(loginWs);
  await loginCdp.send('Page.enable');
  await loginCdp.send('Runtime.enable');
  await sleep(1000);

  const loginCheck = await loginCdp.evaluate(`
    (() => {
      const leftCol = document.querySelector('.auth-left-col');
      const rightCol = document.querySelector('.auth-right-col');
      const orbit = document.querySelector('.auth-orbit-anim');
      const giantTitle = document.querySelector('.auth-giant-title');
      const tip = document.querySelector('.auth-rotating-tip');
      const stats = document.querySelectorAll('.auth-stat-box');
      const segBtns = document.querySelectorAll('.seg-btn');
      const slideTrack = document.querySelector('.slide-verify-track');
      const btnSubmit = document.querySelector('.btn-submit-login');
      const wipeCurtain = document.querySelector('.auth-wipe-curtain');

      // Test segmented click
      if (segBtns[1]) segBtns[1].click();
      const activeSegText = document.querySelector('.seg-btn.is-active') ? document.querySelector('.seg-btn.is-active').textContent : '';

      // Test slide verify click
      if (slideTrack) slideTrack.click();
      const isVerified = slideTrack ? slideTrack.classList.contains('is-verified') : false;

      return {
        ok: !!leftCol && !!rightCol,
        hasOrbit: !!orbit,
        titleText: giantTitle ? giantTitle.textContent : '',
        hasTip: !!tip,
        statsCount: stats.length,
        segActiveText: activeSegText,
        slideVerified: isVerified,
        hasWipeCurtain: !!wipeCurtain
      };
    })()
  `);
  console.log('Login Page Check:', JSON.stringify(loginCheck, null, 2));
  loginWs.close();

  // 6. Measure Production FPS across scroll
  console.log('\n[6] Measuring production scroll FPS...');
  const fpsResult = await cdp.evaluate(`
    new Promise((resolve) => {
      let frameCount = 0;
      let start = performance.now();
      let scrollY = 0;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

      function tick() {
        frameCount++;
        scrollY += 120;
        if (scrollY > maxScroll) scrollY = 0;
        window.scrollTo(0, scrollY);

        if (performance.now() - start < 1500) {
          setTimeout(tick, 16);
        } else {
          const elapsed = (performance.now() - start) / 1000;
          const fps = Math.round(frameCount / elapsed);
          resolve({ fps, frameCount, elapsedSec: elapsed.toFixed(2) });
        }
      }
      tick();
    })
  `);
  console.log('Production FPS Result:', JSON.stringify(fpsResult, null, 2));

  ws.close();
  console.log('\n--- VERIFICATION COMPLETED ---');
  process.exit(0);
}

run().catch((err) => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});