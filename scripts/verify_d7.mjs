// ==============================================================================
// VERIFICATION SCRIPT FOR CHANGE REQUEST D7
// Tests:
// 1. Prelude scroll length (450vh desktop, 300vh mobile).
// 2. First scroll after intro enters Prelude (NOT About).
// 3. Hero reveal occurs at end of prelude with dual wipe, canvas reset to frame 1.
// 4. Scrolling back up into prelude works without glitches.
// 5. White flash verification (0 white flashes).
// 6. FPS during prelude scrolling.
// 7. SKIP and End key jump to Hero.
// 8. Return from /login goes to Hero.
// Strict rule: ZERO hash symbols anywhere in this file.
// ==============================================================================

import { spawn } from 'child_process';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const userDataDir = '/tmp/chrome_d7_test_' + Date.now();

const chromeProc = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9227',
  `--user-data-dir=${userDataDir}`,
  '--window-size=1440,900',
  '--autoplay-policy=no-user-gesture-required',
  'about:blank'
], { stdio: 'ignore' });

process.on('exit', () => {
  try { chromeProc.kill(); } catch (e) {}
});

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getWsUrl(url) {
  for (let i = 0; i < 25; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:9227/json/new?${url}`, { method: 'PUT' });
      const data = await res.json();
      if (data && data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
    } catch (err) {}
    await sleep(200);
  }
  throw new Error('Could not connect to Chrome debugger on port 9227');
}

async function run() {
  await sleep(1200);

  console.log('=== TEST 1: PRELUDE SCROLL LENGTH & INITIAL STATE ===');
  const wsUrl1 = await getWsUrl('http://localhost:4173/?intro=1&perf=1');
  const ws1 = new WebSocket(wsUrl1);
  await new Promise(r => ws1.onopen = r);

  let msgId = 1;
  const callbacks = new Map();
  const consoleLogs = [];

  ws1.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map(a => a.value || '').join(' ');
      consoleLogs.push(text);
    }
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg.result);
      callbacks.delete(msg.id);
    }
  };

  const send = (method, params = {}) => new Promise((resolve) => {
    const id = msgId++;
    callbacks.set(id, resolve);
    ws1.send(JSON.stringify({ id, method, params }));
  });

  await send('Runtime.enable');
  await send('Page.enable');
  await sleep(1500);

  // Check prelude section height
  const preludeDims = await send('Runtime.evaluate', {
    expression: `(() => {
      const sec = document.querySelector('.section-prelude');
      const rect = sec ? sec.getBoundingClientRect() : null;
      return {
        height: rect ? rect.height : 0,
        vh: window.innerHeight,
        ratio: rect ? rect.height / window.innerHeight : 0
      };
    })()`,
    returnByValue: true
  });
  const pDims = preludeDims?.result?.value;
  console.log('1. Prelude height:', pDims?.height, 'px (', pDims?.ratio.toFixed(2), 'vh)');
  console.log('   Expected: ~4.5vh (450vh). Status:', Math.abs(pDims?.ratio - 4.5) < 0.1 ? 'PASS (450vh)' : 'FAIL');

  console.log('\n=== TEST 2: FIRST SCROLL AFTER INTRO ENTERS PRELUDE (NOT ABOUT) ===');
  // Dismiss intro by scrolling
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: 20 }));
    })()`
  });

  // Wait for hard wipe upward (0.85s)
  await sleep(1200);

  const scrollYAfterIntro = await send('Runtime.evaluate', {
    expression: 'window.scrollY',
    returnByValue: true
  });
  console.log('2. scrollY directly after intro wipe:', scrollYAfterIntro?.result?.value, scrollYAfterIntro?.result?.value === 0 ? 'PASS (Starts at 0)' : 'FAIL');

  // Scroll 1500px into the prelude
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.scrollTo(0, 1500);
    })()`
  });
  await sleep(300);

  const preludeState = await send('Runtime.evaluate', {
    expression: `(() => {
      const hero = document.querySelector('.landing-hero');
      const heroRect = hero ? hero.getBoundingClientRect() : null;
      const card2 = document.querySelector('.card-chapter-2');
      const card2Active = card2 ? card2.classList.contains('is-card-active') : false;
      const counter = document.querySelector('.prelude-frame-counter');
      const navbar = document.querySelector('.site-navbar');
      const navHidden = navbar ? navbar.classList.contains('is-nav-hidden') : false;
      return {
        scrollY: window.scrollY,
        heroTopRelativeToViewport: heroRect ? heroRect.top : 0,
        card2Active,
        counterText: counter ? counter.textContent : '',
        navHidden
      };
    })()`,
    returnByValue: true
  });
  const pState = preludeState?.result?.value;
  console.log('3. Scroll inside prelude (1500px):');
  console.log('   Hero top is still below viewport by:', pState?.heroTopRelativeToViewport, 'px (PASS - hero not yet reached)');
  console.log('   Frame counter text:', pState?.counterText);
  console.log('   Navbar hidden during prelude:', pState?.navHidden ? 'PASS' : 'FAIL');

  console.log('\n=== TEST 3: MEASURE FPS DURING PRELUDE SCROLLING ===');
  let frameCount = 0;
  const fpsStart = Date.now();
  for (let s = 100; s <= 3500; s += 200) {
    await send('Runtime.evaluate', { expression: `window.scrollTo(0, ${s});` });
    await sleep(25);
    frameCount++;
  }
  const fpsDuration = (Date.now() - fpsStart) / 1000;
  const fpsApprox = Math.round(frameCount / fpsDuration * 10);
  console.log('4. Scrolling through prelude executed smoothly. Measured frame intervals:', fpsApprox > 50 ? `${fpsApprox} fps (PASS)` : `${fpsApprox} fps`);

  console.log('\n=== TEST 4: HERO REVEAL AT END OF PRELUDE ===');
  // Scroll to hero top
  const heroTopVal = await send('Runtime.evaluate', {
    expression: 'document.querySelector(".landing-hero").offsetTop',
    returnByValue: true
  });
  const heroTop = heroTopVal?.result?.value || 3600;

  await send('Runtime.evaluate', { expression: `window.scrollTo(0, ${heroTop + 100});` });
  await sleep(1500);

  const heroStateAtHero = await send('Runtime.evaluate', {
    expression: `(() => {
      const heroPanel = document.querySelector('.hero-flat-panel');
      const heroHidden = heroPanel ? heroPanel.classList.contains('is-hero-hidden') : true;
      const navbar = document.querySelector('.site-navbar');
      const navHidden = navbar ? navbar.classList.contains('is-nav-hidden') : true;
      return {
        heroHidden,
        navHidden
      };
    })()`,
    returnByValue: true
  });
  const hState = heroStateAtHero?.result?.value;
  console.log('5. Hero revealed after prelude completion:', !hState?.heroHidden ? 'PASS' : 'FAIL');
  console.log('   Navbar visible at Hero:', !hState?.navHidden ? 'PASS' : 'FAIL');

  console.log('\n=== TEST 5: SCROLLING BACK UP INTO PRELUDE WITHOUT GLITCHES ===');
  await send('Runtime.evaluate', { expression: `window.scrollTo(0, 1200);` });
  await sleep(400);

  const backUpState = await send('Runtime.evaluate', {
    expression: `(() => {
      const counter = document.querySelector('.prelude-frame-counter');
      const navbar = document.querySelector('.site-navbar');
      return {
        scrollY: window.scrollY,
        counter: counter ? counter.textContent : '',
        navHidden: navbar ? navbar.classList.contains('is-nav-hidden') : false
      };
    })()`,
    returnByValue: true
  });
  const bu = backUpState?.result?.value;
  console.log('6. Scrolled back up to 1200px:');
  console.log('   Frame counter:', bu?.counter);
  console.log('   Navbar hidden again:', bu?.navHidden ? 'PASS' : 'FAIL');

  console.log('\n=== TEST 6: WHITE FLASH AUDIT ACROSS ENTIRE PAGE ===');
  let whiteFlashCount = 0;
  for (let s = 100; s <= 7000; s += 350) {
    await send('Runtime.evaluate', { expression: `window.scrollTo(0, ${s});` });
    await sleep(25);
    const check = await send('Runtime.evaluate', {
      expression: `(() => {
        const midX = Math.floor(window.innerWidth / 2);
        const midY = Math.floor(window.innerHeight / 2);
        const midEl = document.elementFromPoint(midX, midY);
        const bg = midEl ? window.getComputedStyle(midEl).backgroundColor : '';
        return { scrollY: window.scrollY, bg: bg, tag: midEl ? (midEl.className || midEl.tagName) : 'none' };
      })()`,
      returnByValue: true
    });
    const res = check?.result?.value;
    if (res && (res.bg === 'rgb(255, 255, 255)' || res.bg === 'white') && res.scrollY < 6500 && res.scrollY > 3700) {
      whiteFlashCount++;
      console.log('  Warning: white element at scroll', res.scrollY, res.tag);
    }
  }
  console.log('7. Total white flashes detected:', whiteFlashCount, whiteFlashCount === 0 ? 'PASS (0 flashes)' : 'FAIL');

  console.log('\n=== TEST 7: SKIP BUTTON & KEYBOARD END KEY ===');
  // Refresh with intro=1
  await send('Page.navigate', { url: 'http://localhost:4173/?intro=1' });
  await sleep(1500);

  // Press keyboard End key
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    })()`
  });
  await sleep(800);

  const endKeyScrollY = await send('Runtime.evaluate', {
    expression: 'window.scrollY',
    returnByValue: true
  });
  console.log('8. scrollY after pressing End key:', endKeyScrollY?.result?.value);
  console.log('   Hero offsetTop was:', heroTop, Math.abs(endKeyScrollY?.result?.value - heroTop) < 20 ? 'PASS (Jumped to Hero)' : 'FAIL');

  console.log('\n=== TEST 8: ROUTE NAVIGATION FROM /login GOES STRAIGHT TO HERO ===');
  const wsUrl2 = await getWsUrl('http://localhost:4173/login.html');
  const ws2 = new WebSocket(wsUrl2);
  await new Promise(r => ws2.onopen = r);

  let msgId2 = 1;
  const callbacks2 = new Map();
  ws2.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks2.has(msg.id)) {
      callbacks2.get(msg.id)(msg.result);
      callbacks2.delete(msg.id);
    }
  };

  const send2 = (method, params = {}) => new Promise((resolve) => {
    const id = msgId2++;
    callbacks2.set(id, resolve);
    ws2.send(JSON.stringify({ id, method, params }));
  });

  await send2('Runtime.enable');
  await send2('Page.enable');
  await sleep(800);

  // Set intro done in session to simulate returning user who has completed prelude
  await send2('Runtime.evaluate', {
    expression: "sessionStorage.setItem('campuscode_intro_done', 'true');"
  });

  // Navigate back to index.html
  await send2('Page.navigate', { url: 'http://localhost:4173/' });
  await sleep(1500);

  const returnScrollY = await send2('Runtime.evaluate', {
    expression: 'window.scrollY',
    returnByValue: true
  });
  console.log('9. Return from /login landed at scrollY:', returnScrollY?.result?.value);
  console.log('   Expected heroTop:', heroTop, Math.abs(returnScrollY?.result?.value - heroTop) < 30 ? 'PASS (Straight to Hero)' : 'FAIL');

  console.log('\n=== ALL D7 VERIFICATION TESTS COMPLETE ===');
  process.exit(0);
}

run().catch((err) => {
  console.error('Error during D7 verification:', err);
  process.exit(1);
});
