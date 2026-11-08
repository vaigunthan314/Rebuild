import { spawn } from 'child_process';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const userDataDir = '/tmp/chrome_test_profile_' + Date.now();

const chromeProc = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9223',
  `--user-data-dir=${userDataDir}`,
  '--window-size=1280,800',
  '--autoplay-policy=no-user-gesture-required',
  '--disable-gpu',
  'about:blank'
], { stdio: 'ignore' });

process.on('exit', () => {
  try { chromeProc.kill(); } catch (e) {}
});

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  await sleep(1500);

  const newTabRes = await fetch('http://127.0.0.1:9223/json/new?http://localhost:4173/?intro=0', { method: 'PUT' });
  const tab = await newTabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
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
  await sleep(2000);

  // Click ENTER if enter stage is visible
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('.btn-enter-stage');
      if (btn && btn.offsetParent !== null) btn.click();
    })()`
  });
  await sleep(1500);

  console.log('--- VERIFYING CANVAS POSITION AND SIZING (NO WHITE STRIPS AT EDGES) ---');
  let res = await send('Runtime.evaluate', {
    expression: `(() => {
      const canvas = document.querySelector('.cinematic-canvas');
      const wrapper = document.querySelector('.cinematic-canvas-wrapper');
      const cRect = canvas.getBoundingClientRect();
      const wRect = wrapper.getBoundingClientRect();
      const bodyStyle = window.getComputedStyle(document.body);
      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        canvasRect: { top: cRect.top, left: cRect.left, width: cRect.width, height: cRect.height },
        wrapperRect: { top: wRect.top, left: wRect.left, width: wRect.width, height: wRect.height },
        bodyMargin: bodyStyle.margin,
        bodyPadding: bodyStyle.padding,
        canvasOpacity: window.getComputedStyle(canvas).opacity,
        wrapperOpacity: window.getComputedStyle(wrapper).opacity,
        wrapperPosition: window.getComputedStyle(wrapper).position,
        insetTop: wRect.top === 0 && wRect.left === 0 && wRect.width === window.innerWidth && wRect.height === window.innerHeight
      };
    })()`,
    returnByValue: true
  });
  console.log('Canvas Bounds & Edge Check:', JSON.stringify(res.result.value, null, 2));

  console.log('\n--- VERIFYING SCROLL THROUGH SECTIONS AND NO CANVAS FADES TO WHITE ---');
  const sections = [
    '.landing-hero',
    '.section-about',
    '.section-experience',
    '.section-how',
    '.section-hackathons',
    '.section-mission',
    '.section-community',
    '.section-cta',
    '.site-footer'
  ];

  for (const sel of sections) {
    res = await send('Runtime.evaluate', {
      expression: `(() => {
        const el = document.querySelector('${sel}');
        if (!el) return { found: false };
        el.scrollIntoView();
        const wrapper = document.querySelector('.cinematic-canvas-wrapper');
        const canvas = document.querySelector('.cinematic-canvas');
        const bg = window.getComputedStyle(el).backgroundColor;
        const cOpacity = window.getComputedStyle(canvas).opacity;
        const wOpacity = window.getComputedStyle(wrapper).opacity;
        const wVisibility = window.getComputedStyle(wrapper).visibility;
        return {
          section: '${sel}',
          scrollY: window.scrollY,
          bg,
          canvasOpacity: cOpacity,
          wrapperOpacity: wOpacity,
          wrapperVisibility: wVisibility
        };
      })()`,
      returnByValue: true
    });
    console.log(JSON.stringify(res.result.value));
    await sleep(400);
  }

  console.log('\n--- VERIFYING SPECIFIC SLIDE FEATURES ---');
  res = await send('Runtime.evaluate', {
    expression: `(() => {
      // 01 About: column on right
      const aboutCol = document.querySelector('.about-right-column');
      const aboutColRect = aboutCol.getBoundingClientRect();

      // 02 Experience: corner chips & progress ring
      const chips = document.querySelectorAll('.exp-corner-chip');
      const ring = document.querySelector('.exp-progress-ring');

      // 03 How it works: 4 near-black cards & vertical lime line
      const howCards = document.querySelectorAll('.how-step-card');
      const limeLine = document.querySelector('.how-vertical-lime-line');

      // 04 Arena: 3 stripes
      const stripes = document.querySelectorAll('.arena-stripe');

      // 05 Mission: words in headline
      const missionWords = document.querySelectorAll('.mission-word');

      // 06 Network: draggable nodes
      const networkNodes = document.querySelectorAll('.draggable-node');

      // 07 Ready: huge lime button
      const readyBtn = document.querySelector('.ready-huge-lime-btn');

      // Wipes
      const wipeLime = document.querySelector('.wipe-bar-lime');
      const wipeBlack = document.querySelector('.wipe-bar-black');

      return {
        aboutRightColumnPinned: !!aboutCol,
        aboutRightMargin: window.innerWidth - aboutColRect.right,
        experienceChipsCount: chips.length,
        experienceProgressRing: !!ring,
        howCardsCount: howCards.length,
        howVerticalLine: !!limeLine,
        arenaStripesCount: stripes.length,
        missionWordsCount: missionWords.length,
        networkDraggableNodesCount: networkNodes.length,
        readyButton: !!readyBtn,
        wipeLime: !!wipeLime,
        wipeBlack: !!wipeBlack
      };
    })()`,
    returnByValue: true
  });
  console.log('Slide features check:', JSON.stringify(res.result.value, null, 2));

  ws.close();
  chromeProc.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  try { chromeProc.kill(); } catch (e) {}
  process.exit(1);
});
