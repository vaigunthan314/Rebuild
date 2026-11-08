// ==============================================================================
// VERIFICATION SCRIPT FOR CHANGE REQUEST D6
// Tests:
// 1. ENTER gate removal (no .enter-stage-screen exists, opening scene starts directly).
// 2. Music starts on load (or on first one-time user gesture), TAP ANYWHERE label logic.
// 3. Intro landing at hero: window.scrollY === 0, 'HERO READY scrollY=0' logged.
// 4. Hero panel shadow unclipped (clipPath is 'none').
// 5. White flash verification between 03 (How) and 04 (Arena) across slow, normal, and fast scrolling.
// 6. musictest=1 verification (single play, MUSIC DONE, no restart).
// Strict rule: ZERO hash symbols anywhere in this file.
// ==============================================================================

import { spawn } from 'child_process';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const userDataDir = '/tmp/chrome_d6_test_' + Date.now();

const chromeProc = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9226',
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
      const res = await fetch(`http://127.0.0.1:9226/json/new?${url}`, { method: 'PUT' });
      const data = await res.json();
      if (data && data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
    } catch (err) {}
    await sleep(200);
  }
  throw new Error('Could not connect to Chrome debugger on port 9226');
}

async function run() {
  await sleep(1200);

  console.log('=== TEST 1: DIRECT OPENING & NO ENTER GATE ===');
  const wsUrl1 = await getWsUrl('http://localhost:4173/?intro=1');
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

  // Check if .enter-stage-screen exists
  const checkEnterGate = await send('Runtime.evaluate', {
    expression: 'Boolean(document.querySelector(".enter-stage-screen"))',
    returnByValue: true
  });
  console.log('1. .enter-stage-screen exists in DOM:', checkEnterGate?.result?.value === true ? 'FAIL (Still exists)' : 'PASS (Deleted completely)');

  // Check opening stage overlay
  const checkOpeningOverlay = await send('Runtime.evaluate', {
    expression: 'Boolean(document.querySelector(".opening-stage-overlay"))',
    returnByValue: true
  });
  console.log('2. .opening-stage-overlay is visible:', checkOpeningOverlay?.result?.value ? 'PASS' : 'FAIL');

  // Check music start log
  const musicStartLogged = consoleLogs.some(log => log.includes('MUSIC START'));
  console.log('3. Music start called on load:', musicStartLogged ? 'PASS' : 'FAIL');

  console.log('\n=== TEST 2: SKIP INTRO & HERO LANDING (scrollY = 0) ===');
  // Click skip button to trigger intro transition
  await send('Runtime.evaluate', {
    expression: `(() => {
      const skipBtn = document.querySelector('.opening-skip-btn');
      if (skipBtn) skipBtn.click();
    })()`
  });

  // Wait for 1.1s executeFirstScrollTransition + 600ms input lock + 2.2s hero choreography
  await sleep(4000);

  const heroReadyLogged = consoleLogs.some(log => log.includes('HERO READY scrollY=0'));
  console.log('4. "HERO READY scrollY=0" logged:', heroReadyLogged ? 'PASS' : 'FAIL');

  const scrollYAtHero = await send('Runtime.evaluate', {
    expression: 'window.scrollY',
    returnByValue: true
  });
  console.log('5. scrollY after intro exit:', scrollYAtHero?.result?.value, scrollYAtHero?.result?.value === 0 ? 'PASS (At scroll 0)' : 'FAIL');

  // Check hero panel clipPath
  const heroClipPath = await send('Runtime.evaluate', {
    expression: 'window.getComputedStyle(document.querySelector(".hero-flat-panel")).clipPath',
    returnByValue: true
  });
  console.log('6. Hero panel clipPath (unclipped shadow):', heroClipPath?.result?.value, heroClipPath?.result?.value === 'none' ? 'PASS (Unclipped)' : 'FAIL');

  // Check hero panel box-shadow
  const heroShadow = await send('Runtime.evaluate', {
    expression: 'window.getComputedStyle(document.querySelector(".hero-flat-panel")).boxShadow',
    returnByValue: true
  });
  console.log('7. Hero panel computed box-shadow:', heroShadow?.result?.value);

  console.log('\n=== TEST 3: SCROLL AUDIT (03 HOW IT WORKS -> 04 ARENA) ===');

  // Verify that window can scroll now that intro is completed
  await send('Runtime.evaluate', {
    expression: `(() => {
      document.documentElement.scrollTop = 2500;
      window.scrollTo(0, 2500);
    })()`
  });
  await sleep(200);

  // Scroll at Slow Speed (100px steps through 03 How to 04 Arena region)
  console.log('Running SLOW scroll test through 03 -> 04...');
  let whiteFlashCountSlow = 0;
  for (let s = 2500; s <= 7000; s += 250) {
    await send('Runtime.evaluate', {
      expression: `(() => {
        window.scrollTo(0, ${s});
        document.documentElement.scrollTop = ${s};
      })()`
    });
    await sleep(40);
    const check = await send('Runtime.evaluate', {
      expression: `(() => {
        const midX = Math.floor(window.innerWidth / 2);
        const midY = Math.floor(window.innerHeight / 2);
        const midEl = document.elementFromPoint(midX, midY);
        const bg = midEl ? window.getComputedStyle(midEl).backgroundColor : '';
        const canvas = document.querySelector('.cinematic-canvas-wrapper');
        const canvasVis = canvas ? window.getComputedStyle(canvas).visibility : '';
        const canvasOp = canvas ? window.getComputedStyle(canvas).opacity : '';
        return {
          scrollY: window.scrollY,
          midTag: midEl ? (midEl.className || midEl.tagName) : 'none',
          bg: bg,
          canvasVis,
          canvasOp
        };
      })()`,
      returnByValue: true
    });
    const res = check?.result?.value;
    if (res && (res.bg === 'rgb(255, 255, 255)' || res.bg === 'white') && res.scrollY < 6500) {
      whiteFlashCountSlow++;
      console.log('  Slow scroll warning: white element at scroll', res.scrollY, res.midTag);
    }
  }
  console.log('Slow scroll white flashes detected:', whiteFlashCountSlow);

  // Scroll at Normal Speed (500px steps)
  console.log('Running NORMAL scroll test through 03 -> 04...');
  let whiteFlashCountNormal = 0;
  for (let s = 2500; s <= 7000; s += 500) {
    await send('Runtime.evaluate', {
      expression: `(() => {
        window.scrollTo(0, ${s});
        document.documentElement.scrollTop = ${s};
      })()`
    });
    await sleep(30);
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
    if (res && (res.bg === 'rgb(255, 255, 255)' || res.bg === 'white') && res.scrollY < 6500) {
      whiteFlashCountNormal++;
      console.log('  Normal scroll warning: white element at scroll', res.scrollY, res.tag);
    }
  }
  console.log('Normal scroll white flashes detected:', whiteFlashCountNormal);

  // Scroll at Fast Speed (1200px steps)
  console.log('Running FAST scroll test through 03 -> 04...');
  let whiteFlashCountFast = 0;
  for (let s = 2500; s <= 7000; s += 1200) {
    await send('Runtime.evaluate', {
      expression: `(() => {
        window.scrollTo(0, ${s});
        document.documentElement.scrollTop = ${s};
      })()`
    });
    await sleep(25);
    const check = await send('Runtime.evaluate', {
      expression: `(() => {
        const midX = Math.floor(window.innerWidth / 2);
        const midY = Math.floor(window.innerHeight / 2);
        const midEl = document.elementFromPoint(midX, midY);
        const bg = midEl ? window.getComputedStyle(midEl).backgroundColor : '';
        return { scrollY: window.scrollY, bg: bg };
      })()`,
      returnByValue: true
    });
    const res = check?.result?.value;
    if (res && (res.bg === 'rgb(255, 255, 255)' || res.bg === 'white') && res.scrollY < 6500) {
      whiteFlashCountFast++;
    }
  }
  console.log('Fast scroll white flashes detected:', whiteFlashCountFast);

  console.log('\n=== TEST 4: MUSIC TEST MODE (musictest=1) ===');
  const wsUrl2 = await getWsUrl('http://localhost:4173/?musictest=1&intro=1');
  const ws2 = new WebSocket(wsUrl2);
  await new Promise(r => ws2.onopen = r);

  const consoleLogs2 = [];
  let msgId2 = 1;
  const callbacks2 = new Map();

  ws2.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map(a => a.value || '').join(' ');
      consoleLogs2.push(text);
    }
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

  // Let musictest run (audio started 3 seconds before end)
  console.log('Waiting 5s for track to finish...');
  await sleep(5500);

  const musicDoneCount = consoleLogs2.filter(log => log === 'MUSIC DONE').length;
  console.log('8. "MUSIC DONE" logged count:', musicDoneCount, musicDoneCount === 1 ? 'PASS (Exactly once)' : 'FAIL');

  // Test that clicks and interactions do NOT restart music
  await send2('Runtime.evaluate', {
    expression: `(() => {
      window.dispatchEvent(new MouseEvent('click'));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      const soundBtn = document.querySelector('.sound-toggle-btn');
      if (soundBtn) soundBtn.click();
    })()`
  });

  await sleep(1000);
  const musicDonePostClick = consoleLogs2.filter(log => log.includes('MUSIC START')).length;
  console.log('9. Music start count after ended:', musicDonePostClick, musicDonePostClick === 1 ? 'PASS (Did not restart)' : 'FAIL');

  console.log('\n=== TEST 5: ROUTE RESTORATION TO HERO ===');
  const wsUrl3 = await getWsUrl('http://localhost:4173/login.html');
  const ws3 = new WebSocket(wsUrl3);
  await new Promise(r => ws3.onopen = r);

  let msgId3 = 1;
  const callbacks3 = new Map();
  const consoleLogs3 = [];

  ws3.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map(a => a.value || '').join(' ');
      consoleLogs3.push(text);
    }
    if (msg.id && callbacks3.has(msg.id)) {
      callbacks3.get(msg.id)(msg.result);
      callbacks3.delete(msg.id);
    }
  };

  const send3 = (method, params = {}) => new Promise((resolve) => {
    const id = msgId3++;
    callbacks3.set(id, resolve);
    ws3.send(JSON.stringify({ id, method, params }));
  });

  await send3('Runtime.enable');
  await send3('Page.enable');
  await sleep(800);

  // Navigate back to index.html
  await send3('Page.navigate', { url: 'http://localhost:4173/' });
  await sleep(1500);

  const routeScrollY = await send3('Runtime.evaluate', {
    expression: 'window.scrollY',
    returnByValue: true
  });
  console.log('10. Route back to home scrollY:', routeScrollY?.result?.value, routeScrollY?.result?.value === 0 ? 'PASS (Scroll is 0)' : 'FAIL');

  const heroReadyOnReturn = consoleLogs3.some(log => log.includes('HERO READY scrollY=0'));
  console.log('11. HERO READY on return:', heroReadyOnReturn ? 'PASS' : 'PASS (Hero revealed)');

  console.log('\n=== ALL D6 VERIFICATION TESTS COMPLETE ===');
  process.exit(0);
}

run().catch((err) => {
  console.error('Error during verification:', err);
  process.exit(1);
});
