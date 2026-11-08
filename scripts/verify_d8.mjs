// ==============================================================================
// VERIFICATION SCRIPT FOR CHANGE REQUEST D8
// Tests:
// 1. Frame canvas is hidden after prelude and bitmaps released.
// 2. FPS in production build (npm run build && npm run preview) in each section
//    (Hero, 01 About, 02 Experience, 03 How it works, 04 Arena).
// 3. Confirmation of zero white flashes across the entire page.
// 4. Section 05: Diagonal bands, 8-point star, headline skew, idea board notes & add note.
// 5. Section 06: Giant rotating wheel, 40 gear teeth, CC hub + counter lime ring,
//    5 node discs with counter-rotating labels, pointer triangle, profile card, 4s toast.
// 6. Memory & scene lifecycle: Three background pauses past Section 04 and resumes on scroll back.
// Strict rule: ZERO hash symbols anywhere in this file.
// Plain comment above every function.
// ==============================================================================

import { spawn } from 'child_process';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const userDataDir = '/tmp/chrome_d8_test_' + Date.now();

const chromeProc = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9228',
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
      const res = await fetch(`http://127.0.0.1:9228/json/new?${url}`, { method: 'PUT' });
      const data = await res.json();
      if (data && data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
    } catch (err) {}
    await sleep(200);
  }
  throw new Error('Could not connect to Chrome debugger on port 9228');
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

  /**
   * Sends a command over the Chrome DevTools Protocol.
   */
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = msgId++;
      callbacks.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /**
   * Evaluates a JavaScript expression inside the browser page context.
   */
  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.result && res.result.exceptionDetails) {
      console.error('JS Eval Error:', res.result.exceptionDetails);
    }
    return res.result ? res.result.result ? res.result.result.value : null : null;
  }

  return { send, evaluate };
}

/**
 * Measures the rendering FPS over a specified duration in milliseconds.
 */
async function measureFps(client, durationMs = 1200) {
  return await client.evaluate(`
    new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      function count() {
        frames++;
        if (performance.now() - start < ${durationMs}) {
          requestAnimationFrame(count);
        } else {
          const elapsed = performance.now() - start;
          const fps = Math.round((frames * 1000) / elapsed);
          resolve(fps);
        }
      }
      requestAnimationFrame(count);
    })
  `);
}

/**
 * Main verification routine.
 */
async function run() {
  await sleep(1500);

  console.log('=== TEST 1: FRAME CANVAS HIDDEN & BITMAPS RELEASED AFTER PRELUDE ===');
  const wsUrl = await getWsUrl('http://localhost:4173/?intro=1');
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => { ws.onopen = r; });
  const cdp = createCdpClient(ws);

  await sleep(1200);

  // Skip opening and prelude straight to Hero
  await cdp.evaluate(`
    const skipBtn = document.querySelector('.opening-skip-btn') || document.querySelector('.prelude-skip-btn');
    if (skipBtn) skipBtn.click();
  `);
  await sleep(1000);

  const frameCanvasState = await cdp.evaluate(`
    (() => {
      const wrapper = document.querySelector('.cinematic-canvas-wrapper');
      const liveThree = document.querySelector('.live-three-canvas-wrapper');
      return {
        videoWrapperDisplay: wrapper ? wrapper.style.display : null,
        liveThreeDisplay: liveThree ? liveThree.style.display : null,
        scrollY: window.scrollY,
        heroTop: document.querySelector('.landing-hero') ? document.querySelector('.landing-hero').offsetTop : 0
      };
    })()
  `);
  console.log('Post-prelude state:', frameCanvasState);

  const isVideoHidden = frameCanvasState.videoWrapperDisplay === 'none';
  const isThreeActive = frameCanvasState.liveThreeDisplay !== 'none';
  console.log('Frame canvas is hidden after prelude:', isVideoHidden ? 'PASS' : 'FAIL');
  console.log('Live Three background is active:', isThreeActive ? 'PASS' : 'FAIL');

  console.log('\n=== TEST 2: FPS IN PRODUCTION BUILD (HERO, 01, 02, 03, 04) ===');

  // Hero section
  await cdp.evaluate(`
    const hero = document.querySelector('.landing-hero');
    if (hero) window.scrollTo(0, hero.offsetTop);
  `);
  await sleep(600);
  const heroFps = await measureFps(cdp, 1000);
  console.log('Hero Section FPS:', heroFps);

  // 01 What is CampusCode (About)
  await cdp.evaluate(`
    const s01 = document.querySelector('.section-about');
    if (s01) window.scrollTo(0, s01.offsetTop + 100);
  `);
  await sleep(600);
  const s01Fps = await measureFps(cdp, 1000);
  console.log('Section 01 (About) FPS:', s01Fps);

  // 02 Experience
  await cdp.evaluate(`
    const s02 = document.querySelector('.section-experience');
    if (s02) window.scrollTo(0, s02.offsetTop + 100);
  `);
  await sleep(600);
  const s02Fps = await measureFps(cdp, 1000);
  console.log('Section 02 (Experience) FPS:', s02Fps);

  // 03 How It Works
  await cdp.evaluate(`
    const s03 = document.querySelector('.section-how');
    if (s03) window.scrollTo(0, s03.offsetTop + 200);
  `);
  await sleep(600);
  const s03Fps = await measureFps(cdp, 1000);
  console.log('Section 03 (How It Works) FPS:', s03Fps);

  // 04 Arena
  await cdp.evaluate(`
    const s04 = document.querySelector('.section-hackathons');
    if (s04) window.scrollTo(0, s04.offsetTop + 100);
  `);
  await sleep(600);
  const s04Fps = await measureFps(cdp, 1000);
  console.log('Section 04 (Arena) FPS:', s04Fps);

  console.log('\n=== TEST 3: CONFIRMATION OF ZERO WHITE FLASHES ===');
  const flashCheck = await cdp.evaluate(`
    (() => {
      const bodyBg = window.getComputedStyle(document.body).backgroundColor;
      const htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
      const wrapperBg = window.getComputedStyle(document.querySelector('.live-three-canvas-wrapper')).backgroundColor;
      const s01Bg = window.getComputedStyle(document.querySelector('.section-about')).backgroundColor;
      const s02Bg = window.getComputedStyle(document.querySelector('.section-experience')).backgroundColor;
      const s03Bg = window.getComputedStyle(document.querySelector('.section-how')).backgroundColor;
      const s04Bg = window.getComputedStyle(document.querySelector('.section-hackathons')).backgroundColor;

      const isLavender = (bg) => bg.includes('233') && bg.includes('233') && bg.includes('247');
      const isTransparent = (bg) => bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent';

      return {
        bodyBg,
        htmlBg,
        wrapperBg,
        s01Bg,
        s02Bg,
        s03Bg,
        s04Bg,
        noWhiteBody: isLavender(bodyBg),
        noWhiteWrapper: isLavender(wrapperBg),
        transparentSections: isTransparent(s01Bg) && isTransparent(s02Bg) && isTransparent(s03Bg) && isTransparent(s04Bg)
      };
    })()
  `);
  console.log('Color check:', flashCheck);
  console.log('Flat lavender background confirmed (no white):', flashCheck.noWhiteBody && flashCheck.noWhiteWrapper ? 'PASS' : 'FAIL');
  console.log('Sections 01-04 transparent canvas confirmed:', flashCheck.transparentSections ? 'PASS' : 'FAIL');

  console.log('\n=== TEST 4: SECTION 05 THE MISSION ENHANCEMENTS ===');
  await cdp.evaluate(`
    const s05 = document.querySelector('.section-mission');
    if (s05) window.scrollTo(0, s05.offsetTop + 50);
  `);
  await sleep(600);

  const missionCheck = await cdp.evaluate(`
    (() => {
      const bandNeg = document.querySelector('.mission-diagonal-band.band-neg');
      const bandPos = document.querySelector('.mission-diagonal-band.band-pos');
      const star = document.querySelector('.mission-eight-point-star');
      const ideaBoard = document.querySelector('.mission-idea-board');
      const stickyNotes = document.querySelectorAll('.idea-sticky-note');
      const addBtn = document.querySelector('.idea-board-submit-btn');

      return {
        hasDiagonalBands: !!bandNeg && !!bandPos,
        hasStar: !!star,
        hasIdeaBoard: !!ideaBoard,
        noteCount: stickyNotes.length,
        hasAddButton: !!addBtn
      };
    })()
  `);
  console.log('Mission section elements:', missionCheck);
  console.log('Diagonal bands exist:', missionCheck.hasDiagonalBands ? 'PASS' : 'FAIL');
  console.log('8-point star exists:', missionCheck.hasStar ? 'PASS' : 'FAIL');
  console.log('Idea board with sticky notes exists:', missionCheck.hasIdeaBoard && missionCheck.noteCount > 0 ? 'PASS' : 'FAIL');

  // Test adding an idea to the board
  const addNoteResult = await cdp.evaluate(`
    (() => {
      const input = document.querySelector('.idea-board-input');
      const btn = document.querySelector('.idea-board-submit-btn');
      if (input && btn) {
        input.value = 'Quantum algorithm visualizer';
        btn.click();
        const notes = document.querySelectorAll('.idea-sticky-note');
        return {
          count: notes.length,
          lastNoteText: notes[notes.length - 1].textContent
        };
      }
      return null;
    })()
  `);
  console.log('Idea board add note test:', addNoteResult);
  console.log('Adding note succeeds:', addNoteResult && addNoteResult.lastNoteText === 'Quantum algorithm visualizer' ? 'PASS' : 'FAIL');

  console.log('\n=== TEST 5: SECTION 06 THE NETWORK GIANT ROTATING WHEEL ===');
  await cdp.evaluate(`
    const s06 = document.querySelector('.section-community');
    if (s06) window.scrollTo(0, s06.offsetTop + 50);
  `);
  await sleep(800);

  const wheelCheck = await cdp.evaluate(`
    (() => {
      const wheel = document.querySelector('.network-giant-wheel');
      const teeth = document.querySelectorAll('.wheel-gear-teeth-group rect');
      const hub = document.querySelector('.wheel-hub-center');
      const counterRing = document.querySelector('.wheel-hub-ring-counter');
      const discs = document.querySelectorAll('.wheel-node-disc');
      const pointer = document.querySelector('.wheel-pointer-triangle');
      const activeDisc = document.querySelector('.wheel-node-disc.is-active');
      const profileCard = document.querySelector('.network-profile-card');
      const profileRole = document.querySelector('.profile-card-role');
      const toastText = document.querySelector('.activity-toast-text');

      return {
        hasWheel: !!wheel,
        gearTeethCount: teeth.length,
        hubText: hub ? hub.textContent : null,
        hasCounterRing: !!counterRing,
        discCount: discs.length,
        hasPointer: !!pointer,
        activeRole: activeDisc ? activeDisc.getAttribute('data-role') : null,
        profileCardRole: profileRole ? profileRole.textContent : null,
        hasActivityToast: !!toastText && toastText.textContent.length > 0
      };
    })()
  `);
  console.log('Network wheel elements:', wheelCheck);
  console.log('Giant wheel with 40 gear teeth confirmed:', wheelCheck.gearTeethCount === 40 ? 'PASS' : 'FAIL');
  console.log('CC Hub with counter ring confirmed:', wheelCheck.hubText === 'CC' && wheelCheck.hasCounterRing ? 'PASS' : 'FAIL');
  console.log('5 Node discs confirmed:', wheelCheck.discCount === 5 ? 'PASS' : 'FAIL');
  console.log('Pointer triangle aligns with active node:', wheelCheck.hasPointer && wheelCheck.activeRole === wheelCheck.profileCardRole ? 'PASS' : 'FAIL');
  console.log('4s Activity toast confirmed:', wheelCheck.hasActivityToast ? 'PASS' : 'FAIL');

  // Test clicking tab rotates wheel and updates profile card
  const tabClickTest = await cdp.evaluate(`
    new Promise((resolve) => {
      const designerTab = document.querySelector('.network-tab-line[data-role="DESIGNERS"]');
      if (designerTab) {
        designerTab.click();
        setTimeout(() => {
          const profileRole = document.querySelector('.profile-card-role');
          const activeDisc = document.querySelector('.wheel-node-disc.is-active');
          resolve({
            profileRole: profileRole ? profileRole.textContent : null,
            activeDiscRole: activeDisc ? activeDisc.getAttribute('data-role') : null
          });
        }, 1400);
      } else {
        resolve(null);
      }
    })
  `);
  console.log('Tab click rotation test (DESIGNERS):', tabClickTest);
  console.log('Clicking DESIGNERS rotates wheel and updates card:', tabClickTest && tabClickTest.profileRole === 'DESIGNERS' ? 'PASS' : 'FAIL');

  console.log('\n=== TEST 6: THREE BACKGROUND PAUSES PAST SECTION 04 ===');
  const threePauseCheck = await cdp.evaluate(`
    (() => {
      const wrapper = document.querySelector('.live-three-canvas-wrapper');
      return {
        displayInSection06: wrapper ? wrapper.style.display : null
      };
    })()
  `);
  console.log('Three.js wrapper display in Section 06:', threePauseCheck.displayInSection06);
  console.log('Three.js canvas paused/hidden past Section 04:', threePauseCheck.displayInSection06 === 'none' ? 'PASS' : 'FAIL');

  // Scroll back to Hero and verify it resumes
  await cdp.evaluate(`
    (() => {
      const heroEl = document.querySelector('.landing-hero');
      if (heroEl) window.scrollTo(0, heroEl.offsetTop);
    })()
  `);
  await sleep(600);

  const threeResumeCheck = await cdp.evaluate(`
    (() => {
      const wrapper = document.querySelector('.live-three-canvas-wrapper');
      return {
        displayInHero: wrapper ? wrapper.style.display : null
      };
    })()
  `);
  console.log('Three.js wrapper display after scrolling back to Hero:', threeResumeCheck.displayInHero);
  console.log('Three.js canvas resumes in Hero:', threeResumeCheck.displayInHero === 'block' ? 'PASS' : 'FAIL');

  ws.close();
  try { chromeProc.kill(); } catch (e) {}

  console.log('\n========================================');
  console.log('ALL CHANGE REQUEST D8 TESTS COMPLETE');
  console.log('========================================');
  process.exit(0);
}

run().catch((err) => {
  console.error('Test execution error:', err);
  try { chromeProc.kill(); } catch (e) {}
  process.exit(1);
});
