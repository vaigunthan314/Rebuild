// ==============================================================================
// VERIFICATION SCRIPT FOR CHANGE REQUEST D5A
// Tests performance (?perf=1 FPS, draw time, bitmap cache),
// 1440x900 and 1920x1080 responsive layout, no text overlaps,
// Section 01 (About) column fit and 3 fact tags,
// Section 02 (Experience) 70vw x 54vh medium card, 62/38 split, filmstrip timeline.
// Strict rule: No hash symbol anywhere in this file.
// ==============================================================================

import { spawn } from 'child_process';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const userDataDir = '/tmp/chrome_perf_test_' + Date.now();

const chromeProc = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9225',
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
      const res = await fetch('http://127.0.0.1:9225/json/new?http://localhost:4173/?perf=1&intro=1', { method: 'PUT' });
      const data = await res.json();
      if (data && data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
    } catch (err) {}
    await sleep(200);
  }
  throw new Error('Could not connect to Chrome debugger on port 9225');
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
  await sleep(1000);

  // Click ENTER to begin
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('.btn-enter-stage');
      if (btn) btn.click();
    })()`
  });
  await sleep(3000);

  console.log('=== TEST 1: HERO ENTRANCE AND PERFORMANCE OVERLAY ===');
  let perfResult = await send('Runtime.evaluate', {
    expression: `(() => {
      const perfBox = document.querySelector('.perf-monitor-box');
      const text = perfBox ? perfBox.innerText : 'NO PERF BOX';
      const canvas = document.querySelector('.cinematic-canvas');
      const panel = document.querySelector('.hero-flat-panel');
      return {
        perfText: text,
        canvasWidth: canvas ? canvas.width : 0,
        canvasHeight: canvas ? canvas.height : 0,
        canvasStyle: canvas ? canvas.style.objectFit : '',
        heroHidden: panel ? panel.classList.contains('is-hero-hidden') : null,
        heroClip: panel ? window.getComputedStyle(panel).clipPath : null,
      };
    })()`,
    returnByValue: true,
  });
  console.log('Performance & Canvas:', perfResult?.result?.value);

  console.log('\n=== TEST 2: SECTION 01 (ABOUT) AT 1440x900 ===');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(500);

  // Scroll into section 01 so sticky stage is active
  await send('Runtime.evaluate', {
    expression: `(() => {
      const about = document.querySelector('.section-about');
      if (about) {
        window.scrollTo(0, about.offsetTop + 300);
      }
    })()`
  });
  await sleep(600);

  let aboutTest = await send('Runtime.evaluate', {
    expression: `(() => {
      const col = document.querySelector('.about-right-column');
      if (!col) return { error: 'No about-right-column found' };
      const colRect = col.getBoundingClientRect();
      const chips = document.querySelectorAll('.about-stat-chip');
      const factTags = document.querySelectorAll('.about-fact-tag');
      const progressFill = document.querySelector('.about-progress-fill');
      const slotWord = document.querySelector('.slot-machine-active');
      const headerStrip = document.querySelector('.section-about .section-header-strip');
      const headerRect = headerStrip ? headerStrip.getBoundingClientRect() : { top: 0 };

      const chipsInside = Array.from(chips).map((c, i) => {
        const cr = c.getBoundingClientRect();
        return {
          chip: i,
          visible: cr.bottom <= window.innerHeight && cr.top >= 0,
          rect: { top: Math.round(cr.top), bottom: Math.round(cr.bottom) }
        };
      });

      return {
        viewportHeight: window.innerHeight,
        headerTop: Math.round(headerRect.top),
        columnHeight: Math.round(colRect.height),
        columnTop: Math.round(colRect.top),
        columnBottom: Math.round(colRect.bottom),
        columnFitsInViewport: colRect.bottom <= window.innerHeight,
        allChipsVisibleWithoutScrolling: chipsInside.every(c => c.visible),
        factTagsCount: factTags.length,
        factTag1Text: factTags[0]?.innerText.replace(/\\n/g, ' '),
        factTag2Text: factTags[1]?.innerText.replace(/\\n/g, ' '),
        factTag3Text: factTags[2]?.innerText.replace(/\\n/g, ' '),
        slotWord: slotWord ? slotWord.innerText : '',
        progressWidth: progressFill ? progressFill.style.width : ''
      };
    })()`,
    returnByValue: true
  });
  console.log('Section 01 at 1440x900:', aboutTest?.result?.value);

  console.log('\n=== TEST 3: SECTION 02 (EXPERIENCE) AT 1440x900 ===');
  let expTest = await send('Runtime.evaluate', {
    expression: `(() => {
      const card = document.querySelector('.experience-medium-card');
      if (!card) return { error: 'No experience-medium-card found' };
      const cardRect = card.getBoundingClientRect();
      const videoPane = document.querySelector('.exp-video-pane');
      const videoRect = videoPane ? videoPane.getBoundingClientRect() : { width: 0 };
      const chaptersPane = document.querySelector('.exp-chapters-pane');
      const chaptersRect = chaptersPane ? chaptersPane.getBoundingClientRect() : { width: 0 };
      const timeline = document.querySelector('.exp-filmstrip-timeline');
      const ticks = document.querySelectorAll('.filmstrip-tick');
      const brandLabel = document.querySelector('.exp-video-brand-label');
      const recDot = document.querySelector('.exp-video-rec');
      const timecode = document.querySelector('.exp-video-timecode');
      const soundBtn = document.querySelector('.experience-sound-badge');

      const blRect = brandLabel ? brandLabel.getBoundingClientRect() : { top: 0, bottom: 0, left: 0, right: 0 };
      const tcRect = timecode ? timecode.getBoundingClientRect() : { top: 0, bottom: 0, left: 0, right: 0 };
      const sbRect = soundBtn ? soundBtn.getBoundingClientRect() : { top: 0, bottom: 0, left: 0, right: 0 };
      const recRect = recDot ? recDot.getBoundingClientRect() : { top: 0, bottom: 0, left: 0, right: 0 };

      const hasVideoTextOverlap = (
        (blRect.bottom > tcRect.top && blRect.right > tcRect.left) ||
        (recRect.bottom > sbRect.top && recRect.right > sbRect.left)
      );

      return {
        cardWidth: Math.round(cardRect.width),
        cardHeight: Math.round(cardRect.height),
        cardWidthVw: Math.round((cardRect.width / window.innerWidth) * 100) + 'vw',
        cardHeightVh: Math.round((cardRect.height / window.innerHeight) * 100) + 'vh',
        videoRatio: Math.round((videoRect.width / cardRect.width) * 100) + '%',
        chaptersRatio: Math.round((chaptersRect.width / cardRect.width) * 100) + '%',
        timelineTicksCount: ticks.length,
        hasTimeline: !!timeline,
        hasBrandLabel: !!brandLabel && brandLabel.innerText === 'BUILD · COMPETE · SHIP',
        hasRecDot: !!recDot,
        hasTimecode: !!timecode,
        hasSoundBadge: !!soundBtn,
        hasVideoTextOverlap: hasVideoTextOverlap,
        chapterItemsCount: document.querySelectorAll('.exp-chapter-item').length
      };
    })()`,
    returnByValue: true
  });
  console.log('Section 02 at 1440x900:', expTest?.result?.value);

  console.log('\n=== TEST 4: RESPONSIVE AT 1920x1080 ===');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(500);

  // Scroll into section 01
  await send('Runtime.evaluate', {
    expression: `(() => {
      const about = document.querySelector('.section-about');
      if (about) {
        window.scrollTo(0, about.offsetTop + 300);
      }
    })()`
  });
  await sleep(600);

  let hdTest = await send('Runtime.evaluate', {
    expression: `(() => {
      const col = document.querySelector('.about-right-column');
      const colRect = col ? col.getBoundingClientRect() : { bottom: 0, height: 0, top: 0 };
      const chips = document.querySelectorAll('.about-stat-chip');
      const card = document.querySelector('.experience-medium-card');
      const cardRect = card ? card.getBoundingClientRect() : { width: 0, height: 0 };

      const chipsInside = Array.from(chips).map((c, i) => {
        const cr = c.getBoundingClientRect();
        return {
          chip: i,
          visible: cr.bottom <= window.innerHeight && cr.top >= 0,
        };
      });

      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        colHeight: Math.round(colRect.height),
        colTop: Math.round(colRect.top),
        colBottom: Math.round(colRect.bottom),
        colFits: colRect.bottom <= window.innerHeight,
        allChipsVisible: chipsInside.every(c => c.visible),
        chipsCount: chips.length,
        cardWidthVw: Math.round((cardRect.width / window.innerWidth) * 100) + 'vw',
        cardHeightVh: Math.round((cardRect.height / window.innerHeight) * 100) + 'vh'
      };
    })()`,
    returnByValue: true
  });
  console.log('Responsive at 1920x1080:', hdTest?.result?.value);

  console.log('\n=== TEST 5: SIMULATE SCROLL THROUGH SECTIONS & MEASURE FPS ===');
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.scrollTo(0, 1500);
    })()`
  });
  await sleep(1000);

  let scrollPerf = await send('Runtime.evaluate', {
    expression: `(() => {
      const perfBox = document.querySelector('.perf-monitor-box');
      return {
        perfText: perfBox ? perfBox.innerText : 'NO PERF BOX',
        scrollY: window.scrollY
      };
    })()`,
    returnByValue: true
  });
  console.log('Scroll Performance:', scrollPerf?.result?.value);

  ws.close();
  chromeProc.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error('Error during test:', err);
  try { chromeProc.kill(); } catch (e) {}
  process.exit(1);
});
