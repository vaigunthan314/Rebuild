// ==============================================================================
// SCRIPT: DIAGNOSE WHITE FLASH BETWEEN HOW IT WORKS AND ARENA
// Strict rule: No hash symbol anywhere in this file.
// ==============================================================================

import { spawn } from 'child_process';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const userDataDir = '/tmp/chrome_flash_debug_' + Date.now();

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

async function getWsUrl() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9226/json/new?http://localhost:4173/?debug=1&intro=0', { method: 'PUT' });
      const data = await res.json();
      if (data && data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
    } catch (err) {}
    await sleep(200);
  }
  throw new Error('Could not connect to Chrome debugger on port 9226');
}

async function run() {
  await sleep(1000);
  const wsUrl = await getWsUrl();
  const ws = new WebSocket(wsUrl);
  await new Promise(r => ws.onopen = r);

  let idCounter = 1;
  const callbacks = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg.result);
      callbacks.delete(msg.id);
    }
  };

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = idCounter++;
      callbacks.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send('Runtime.enable');
  await send('Page.enable');
  await sleep(1500);

  // Check section positions
  let secInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const how = document.querySelector('.section-how');
      const arena = document.querySelector('.section-hackathons');
      const mission = document.querySelector('.section-mission');
      return {
        howTop: how.offsetTop,
        howHeight: how.offsetHeight,
        howBottom: how.offsetTop + how.offsetHeight,
        arenaTop: arena.offsetTop,
        arenaHeight: arena.offsetHeight,
        arenaBottom: arena.offsetTop + arena.offsetHeight,
        missionTop: mission ? mission.offsetTop : 0,
      };
    })()`,
    returnByValue: true
  });
  console.log('Section Positions:', secInfo?.result?.value);

  const howBottom = secInfo?.result?.value?.howBottom;
  const arenaTop = secInfo?.result?.value?.arenaTop;
  const arenaBottom = secInfo?.result?.value?.arenaBottom;

  console.log('\\n--- SCROLLING NEAR TRANSITION FROM 03 TO 04 ---');
  // Sample scroll positions around the transition: from howBottom - 800 to arenaBottom
  for (let s = howBottom - 600; s <= arenaBottom; s += 150) {
    await send('Runtime.evaluate', {
      expression: `window.scrollTo(0, ${s})`
    });
    await sleep(100);

    let sample = await send('Runtime.evaluate', {
      expression: `(() => {
        const midX = window.innerWidth / 2;
        const midY = window.innerHeight / 2;
        const el = document.elementFromPoint(midX, midY);
        const canvas = document.querySelector('.cinematic-canvas');
        const wrapper = document.querySelector('.cinematic-canvas-wrapper');
        const bg = el ? window.getComputedStyle(el).backgroundColor : '';
        const op = el ? window.getComputedStyle(el).opacity : '';
        const canvasVis = wrapper ? window.getComputedStyle(wrapper).visibility : '';
        const canvasDisp = wrapper ? window.getComputedStyle(wrapper).display : '';
        return {
          scrollY: Math.round(window.scrollY),
          element: el ? (el.tagName + '.' + el.className) : 'null',
          bg: bg,
          opacity: op,
          canvasVis: canvasVis,
          canvasDisp: canvasDisp,
        };
      })()`,
      returnByValue: true
    });
    console.log(`scrollY: ${s} ->`, sample?.result?.value);
  }

  ws.close();
  chromeProc.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error('Error during test:', err);
  try { chromeProc.kill(); } catch (e) {}
  process.exit(1);
});
