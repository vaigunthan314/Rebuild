import { spawn } from 'child_process';

// 1. Launch Chrome in headless mode with debugging port 9222
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const userDataDir = '/tmp/chrome_test_profile_' + Date.now();

const chromeProc = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  `--user-data-dir=${userDataDir}`,
  '--autoplay-policy=no-user-gesture-required',
  '--disable-gpu',
  'about:blank'
], { stdio: 'ignore' });

// Clean up chrome process on exit
process.on('exit', () => {
  try { chromeProc.kill(); } catch (e) {}
});

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  await sleep(1500);

  // Get WebSocket URL from /json
  let versionRes;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      versionRes = await fetch('http://127.0.0.1:9222/json/version');
      if (versionRes.ok) break;
    } catch (e) {
      await sleep(500);
    }
  }

  const newTabRes = await fetch('http://127.0.0.1:9222/json/new?http://localhost:4173/?audiodebug=1', { method: 'PUT' });
  const tab = await newTabRes.json();
  const wsUrl = tab.webSocketDebuggerUrl;

  const ws = new WebSocket(wsUrl);
  await new Promise(r => ws.onopen = r);

  let idCounter = 1;
  const callbacks = new Map();
  const consoleLogs = [];

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
      consoleLogs.push({ type: msg.params.type, text });
      console.log(`[BROWSER CONSOLE ${msg.params.type.toUpperCase()}]`, text);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.error('[BROWSER EXCEPTION]', JSON.stringify(msg.params.exceptionDetails));
    }
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

  console.log('\n--- STEP 1: INITIAL STATE BEFORE ENTER ---');
  let evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const audios = Array.from(document.querySelectorAll('audio')).concat(window.__ccMusic ? [window.__ccMusic] : []);
      const uniqueAudios = Array.from(new Set(audios));
      const videos = Array.from(document.querySelectorAll('video'));
      return {
        url: window.location.href,
        audioCount: uniqueAudios.length,
        videoCount: videos.length,
        musicStartCount: window.__musicStartCount || 0,
        audioContextCount: window.__audioContextCount || 0,
        activeMediaCount: [...uniqueAudios, ...videos].filter(m => !m.paused).length
      };
    })()`,
    returnByValue: true
  });
  console.log('State before ENTER:', JSON.stringify(evalRes.result.value, null, 2));

  console.log('\n--- STEP 2: CLICKING ENTER BUTTON ---');
  evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('.btn-enter-stage');
      if (btn) {
        btn.click();
        return { clicked: true, isDisabled: btn.disabled };
      }
      return { clicked: false };
    })()`,
    returnByValue: true
  });
  console.log('ENTER button click:', JSON.stringify(evalRes.result.value, null, 2));

  await sleep(2500);

  console.log('\n--- STEP 3: CHECK MEDIA ELEMENTS AFTER ENTER ---');
  evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const audios = Array.from(document.querySelectorAll('audio')).concat(window.__ccMusic ? [window.__ccMusic] : []);
      const uniqueAudios = Array.from(new Set(audios));
      const videos = Array.from(document.querySelectorAll('video'));
      const allMedia = [...uniqueAudios, ...videos];
      const nonPaused = allMedia.filter(m => !m.paused);
      return {
        audioTotal: uniqueAudios.length,
        audioList: uniqueAudios.map(a => ({ paused: a.paused, volume: a.volume, currentTime: a.currentTime, loop: a.loop })),
        videoTotal: videos.length,
        videoList: videos.map(v => ({ paused: v.paused, muted: v.muted })),
        nonPausedMediaCount: nonPaused.length,
        musicStartCount: window.__musicStartCount || 0,
        audioContextCount: window.__audioContextCount || 0
      };
    })()`,
    returnByValue: true
  });
  console.log('After ENTER media check:', JSON.stringify(evalRes.result.value, null, 2));

  console.log('\n--- STEP 4: NAVIGATING TO LOGIN ---');
  await send('Page.navigate', { url: 'http://localhost:4173/login.html?audiodebug=1' });
  await sleep(1500);
  evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const audios = Array.from(document.querySelectorAll('audio')).concat(window.__ccMusic ? [window.__ccMusic] : []);
      const uniqueAudios = Array.from(new Set(audios));
      const videos = Array.from(document.querySelectorAll('video'));
      const nonPaused = [...uniqueAudios, ...videos].filter(m => !m.paused);
      return {
        page: 'login.html',
        nonPausedMediaCount: nonPaused.length,
        musicStartCount: window.__musicStartCount || 0,
        audioContextCount: window.__audioContextCount || 0
      };
    })()`,
    returnByValue: true
  });
  console.log('Login check:', JSON.stringify(evalRes.result.value, null, 2));

  console.log('\n--- STEP 5: NAVIGATING TO REGISTER ---');
  await send('Page.navigate', { url: 'http://localhost:4173/register.html?audiodebug=1' });
  await sleep(1500);
  evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const audios = Array.from(document.querySelectorAll('audio')).concat(window.__ccMusic ? [window.__ccMusic] : []);
      const uniqueAudios = Array.from(new Set(audios));
      const videos = Array.from(document.querySelectorAll('video'));
      const nonPaused = [...uniqueAudios, ...videos].filter(m => !m.paused);
      return {
        page: 'register.html',
        nonPausedMediaCount: nonPaused.length,
        musicStartCount: window.__musicStartCount || 0,
        audioContextCount: window.__audioContextCount || 0
      };
    })()`,
    returnByValue: true
  });
  console.log('Register check:', JSON.stringify(evalRes.result.value, null, 2));

  console.log('\n--- STEP 6: NAVIGATING TO DASHBOARD ---');
  await send('Page.navigate', { url: 'http://localhost:4173/dashboard.html?audiodebug=1' });
  await sleep(1500);
  evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const audios = Array.from(document.querySelectorAll('audio')).concat(window.__ccMusic ? [window.__ccMusic] : []);
      const uniqueAudios = Array.from(new Set(audios));
      const videos = Array.from(document.querySelectorAll('video'));
      const nonPaused = [...uniqueAudios, ...videos].filter(m => !m.paused);
      return {
        page: 'dashboard.html',
        nonPausedMediaCount: nonPaused.length,
        musicStartCount: window.__musicStartCount || 0,
        audioContextCount: window.__audioContextCount || 0
      };
    })()`,
    returnByValue: true
  });
  console.log('Dashboard check:', JSON.stringify(evalRes.result.value, null, 2));

  console.log('\n--- STEP 7: NAVIGATING BACK TO INDEX ---');
  await send('Page.navigate', { url: 'http://localhost:4173/?audiodebug=1' });
  await sleep(2000);
  evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const audios = Array.from(document.querySelectorAll('audio')).concat(window.__ccMusic ? [window.__ccMusic] : []);
      const uniqueAudios = Array.from(new Set(audios));
      const videos = Array.from(document.querySelectorAll('video'));
      const nonPaused = [...uniqueAudios, ...videos].filter(m => !m.paused);
      return {
        page: 'index.html (back)',
        nonPausedMediaCount: nonPaused.length,
        musicStartCount: window.__musicStartCount || 0,
        audioContextCount: window.__audioContextCount || 0
      };
    })()`,
    returnByValue: true
  });
  console.log('Back to index check:', JSON.stringify(evalRes.result.value, null, 2));

  ws.close();
  chromeProc.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  try { chromeProc.kill(); } catch (e) {}
  process.exit(1);
});
