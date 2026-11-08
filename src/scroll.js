// ==============================================================================
// CINEMATIC SCROLL & GSAP SCROLLTRIGGER CONTROLLER
// Full-page scroll scrubbing from Hero top to 04 Arena center.
// Holds last frame behind 04 Arena; hides canvas behind solid slides 05-08.
// Canvas opacity is strictly 1 from hero through end of 04 Arena.
// Hard horizontal color wipes between 05, 06, and 07.
// Strict Rule: No hash symbols anywhere in this file.
// Plain comment above every function.
// ==============================================================================

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { getTotalFrames, renderSmoothFrame, resizeFullScreenCanvas, hideFrameCanvas, showFrameCanvas, isVideoFrameLoopActive } from './frames.js';
import { initLiveThreeBackground, pauseLiveThreeScene, resumeLiveThreeScene } from './threeBackground.js';
import { duckMusic } from './audio.js';
import { siteContent } from './content.js';

gsap.registerPlugin(ScrollTrigger);

let targetFrame = 0;
let currentFrame = 0;
let isHeroActive = true;
let lenisInstance = null;
let liveClockInterval = null;
let wordCycleInterval = null;
let slotMachineInterval = null;

/**
 * Sets target video frame index from external triggers (e.g. Prelude).
 */
export function setTargetFrame(frame) {
  targetFrame = frame;
}

/**
 * Returns current target video frame index.
 */
export function getTargetFrame() {
  return targetFrame;
}

/**
 * Initializes smooth Lenis scroll shared with gsap.ticker and lagSmoothing(0).
 */
export function initLenisScroll() {
  if (typeof window === 'undefined') return null;
  if (lenisInstance) return lenisInstance;

  lenisInstance = new Lenis({
    duration: 1.0,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });

  lenisInstance.on('scroll', ScrollTrigger.update);

  gsap.ticker.add((time) => {
    lenisInstance.raf(time * 1000);
  });

  gsap.ticker.lagSmoothing(0);

  return lenisInstance;
}

/**
 * Starts live Chennai (IST) clock ticking every second.
 */
function startLiveClock() {
  if (liveClockInterval) return;
  const clockEl = document.querySelector('.status-strip-clock');
  const updateClock = () => {
    if (!clockEl) return;
    const now = new Date();
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const hh = String(ist.getHours()).padStart(2, '0');
    const mm = String(ist.getMinutes()).padStart(2, '0');
    const ss = String(ist.getSeconds()).padStart(2, '0');
    clockEl.textContent = `${hh}:${mm}:${ss} IST`;
  };
  updateClock();
  liveClockInterval = setInterval(updateClock, 1000);
}

/**
 * Types in the tagline char by char.
 */
function typeInTagline(element, targetText, duration = 0.5) {
  if (!element) return;
  element.textContent = '';
  element.style.opacity = '1';
  let charIndex = 0;
  const totalChars = targetText.length;
  if (totalChars === 0) return;
  const intervalMs = Math.max(12, Math.floor((duration * 1000) / totalChars));
  const timer = setInterval(() => {
    charIndex++;
    element.textContent = targetText.slice(0, charIndex);
    if (charIndex >= totalChars) {
      clearInterval(timer);
    }
  }, intervalMs);
}

/**
 * Cycles violet highlight under BUILD, COMPETE, SHIP every 3s.
 */
function startWordHighlightCycle() {
  if (wordCycleInterval) return;
  const words = document.querySelectorAll('.hero-panel-title .split-word');
  if (words.length === 0) return;
  let activeIndex = 1; // start on COMPETE
  wordCycleInterval = setInterval(() => {
    words.forEach((w, idx) => {
      if (idx === activeIndex) {
        w.classList.add('highlight-violet');
      } else {
        w.classList.remove('highlight-violet');
      }
    });
    activeIndex = (activeIndex + 1) % words.length;
  }, 3000);
}

/**
 * Reveals the main hero directly without replaying intro when already seen.
 */
export function revealHeroMainDirectly() {
  const navbar = document.querySelector('.site-navbar');
  const statusStrip = document.querySelector('.navbar-status-strip');
  const heroPanel = document.querySelector('.hero-flat-panel');
  const canvasWrapper = document.querySelector('.cinematic-canvas-wrapper');
  const hudContainer = document.querySelector('.hero-hud-tags-container');
  const hudLines = document.querySelectorAll('.pointer-line-bar');
  const hudDots = document.querySelectorAll('.pointer-line-dot');
  const hudBoxes = document.querySelectorAll('.hud-tag-box');
  const splitWords = document.querySelectorAll('.hero-panel-title .split-word');
  const limeDot = document.querySelector('.hero-lime-dot');
  const taglineEl = document.querySelector('.hero-panel-description');
  const btnExplore = document.querySelector('.hero-panel-btn-row button');
  const progressNav = document.querySelector('.vertical-progress-nav');
  const marqueeStrip = document.querySelector('.marquee-strip');

  document.body.classList.remove('opening-locked');

  if (navbar) {
    navbar.classList.remove('is-nav-hidden');
    gsap.set(navbar, { y: 0, opacity: 1 });
  }
  if (statusStrip) gsap.set(statusStrip, { y: 0, opacity: 1 });
  startLiveClock();

  if (canvasWrapper) {
    canvasWrapper.classList.remove('is-opening-hidden');
    gsap.set(canvasWrapper, { opacity: 1, scale: 1, x: 0, y: 0 });
  }

  if (heroPanel) {
    heroPanel.classList.remove('is-hero-hidden');
    heroPanel.style.clipPath = 'none';
    gsap.set(heroPanel, { clipPath: 'none', y: 0, opacity: 1 });
  }

  if (splitWords.length > 0) {
    gsap.set(splitWords, { opacity: 1, y: 0 });
  }

  if (limeDot) {
    gsap.set(limeDot, { opacity: 1, scale: 1, display: 'inline-block' });
    gsap.to(limeDot, {
      scale: 1.25,
      duration: 0.8,
      repeat: -1,
      yoyo: true,
      ease: 'power1.inOut',
    });
  }

  if (taglineEl) {
    taglineEl.style.opacity = '1';
    const fullText = taglineEl.getAttribute('data-full-text');
    if (fullText) taglineEl.textContent = fullText;
  }

  if (btnExplore) gsap.set(btnExplore, { scale: 1, opacity: 1 });

  if (hudContainer) {
    hudContainer.classList.remove('is-hero-hidden');
    gsap.set(hudContainer, { opacity: 1, y: 0 });
    gsap.to(hudContainer, {
      y: 4,
      duration: 2.4,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
  }
  if (hudLines.length > 0) gsap.set(hudLines, { scaleX: 1 });
  if (hudDots.length > 0) gsap.set(hudDots, { scale: 1 });
  if (hudBoxes.length > 0) gsap.set(hudBoxes, { scale: 1, opacity: 1 });

  if (progressNav) gsap.set(progressNav, { x: 0, opacity: 1 });
  if (marqueeStrip) gsap.set(marqueeStrip, { y: 0, opacity: 1 });

  animateHudCounters();
  startWordHighlightCycle();
  initHeroMouseParallax();
}

/**
 * Executes the ~2.2s Hero Entrance choreography in exact required order.
 */
export function initHeroSceneReveal() {
  let hasEntered = false;
  try {
    hasEntered = sessionStorage.getItem('campuscode_hero_entered') === 'true';
  } catch (e) {}

  const urlParams = new URLSearchParams(window.location.search);
  const forceIntro = urlParams.get('intro') === '1';

  if (hasEntered && !forceIntro) {
    revealHeroMainDirectly();
    return;
  }

  const navbar = document.querySelector('.site-navbar');
  const statusStrip = document.querySelector('.navbar-status-strip');
  const heroPanel = document.querySelector('.hero-flat-panel');
  const canvasWrapper = document.querySelector('.cinematic-canvas-wrapper');
  const splitWords = document.querySelectorAll('.hero-panel-title .split-word');
  const limeDot = document.querySelector('.hero-lime-dot');
  const taglineEl = document.querySelector('.hero-panel-description');
  const btnExplore = document.querySelector('.hero-panel-btn-row button');
  const hudContainer = document.querySelector('.hero-hud-tags-container');
  const hudLines = document.querySelectorAll('.pointer-line-bar');
  const hudDots = document.querySelectorAll('.pointer-line-dot');
  const hudBoxes = document.querySelectorAll('.hud-tag-box');
  const progressNav = document.querySelector('.vertical-progress-nav');
  const marqueeStrip = document.querySelector('.marquee-strip');

  if (canvasWrapper) {
    canvasWrapper.classList.remove('is-opening-hidden');
    gsap.set(canvasWrapper, { opacity: 1 });
  }

  const targetTagline = taglineEl ? (taglineEl.getAttribute('data-full-text') || taglineEl.textContent.trim()) : '';
  if (taglineEl) {
    taglineEl.setAttribute('data-full-text', targetTagline);
    taglineEl.textContent = '';
  }

  // Setup initial states before sequential timeline runs
  if (navbar) {
    gsap.set(navbar, { y: 0, opacity: 1 });
  }
  if (statusStrip) gsap.set(statusStrip, { y: 0, opacity: 1 });
  startLiveClock();
  if (heroPanel) {
    heroPanel.classList.remove('is-hero-hidden');
    gsap.set(heroPanel, { clipPath: 'inset(0 100% 0 0)', opacity: 1 });
  }
  if (splitWords.length > 0) gsap.set(splitWords, { y: 40, opacity: 0 });
  if (limeDot) gsap.set(limeDot, { scale: 0, opacity: 0, display: 'inline-block' });
  if (btnExplore) gsap.set(btnExplore, { scale: 0.8, opacity: 0 });
  if (hudContainer) {
    hudContainer.classList.remove('is-hero-hidden');
    gsap.set(hudContainer, { opacity: 1 });
  }
  if (hudLines.length > 0) gsap.set(hudLines, { scaleX: 0, transformOrigin: 'left center' });
  if (hudDots.length > 0) gsap.set(hudDots, { scale: 0 });
  if (hudBoxes.length > 0) gsap.set(hudBoxes, { scale: 0.8, opacity: 0 });
  if (progressNav) gsap.set(progressNav, { x: 50, opacity: 1 });
  if (marqueeStrip) gsap.set(marqueeStrip, { y: 60, opacity: 1 });

  const tl = gsap.timeline({
    defaults: { ease: 'power3.out' },
    onComplete: () => {
      try {
        sessionStorage.setItem('campuscode_hero_entered', 'true');
      } catch (e) {}

      // Ensure clipPath is removed so hard drop shadow is completely unclipped
      if (heroPanel) {
        heroPanel.style.clipPath = 'none';
      }

      // Idle float (4px)
      if (hudContainer) {
        gsap.to(hudContainer, {
          y: 4,
          duration: 2.4,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      }

      // Idle pulse on lime dot
      if (limeDot) {
        gsap.to(limeDot, {
          scale: 1.25,
          duration: 0.8,
          repeat: -1,
          yoyo: true,
          ease: 'power1.inOut',
        });
      }

      startWordHighlightCycle();
      initHeroMouseParallax();
    },
  });

  // 1. Live clock is kept ticking
  startLiveClock();

  // 3. White hero panel wipes from left (hard clip, no fade)
  if (heroPanel) {
    tl.to(
      heroPanel,
      {
        clipPath: 'inset(0 0% 0 0)',
        duration: 0.4,
        ease: 'expo.inOut',
        onComplete: () => {
          heroPanel.style.clipPath = 'none';
        },
      },
      0.35
    );
  }

  // 4. BUILD, COMPETE, SHIP slam in from mask with slight overshoot
  if (splitWords.length > 0) {
    tl.to(splitWords, { y: 0, opacity: 1, duration: 0.4, stagger: 0.08, ease: 'back.out(1.4)' }, 0.65);
  }

  // 5. Lime dot pops
  if (limeDot) {
    tl.to(limeDot, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2)' }, 0.95);
  }

  // 6. Tagline types in
  tl.add(() => {
    typeInTagline(taglineEl, targetTagline, 0.5);
  }, 1.05);

  // 7. EXPLORE HACKATHONS pops with hard shadow
  if (btnExplore) {
    tl.to(btnExplore, { scale: 1, opacity: 1, duration: 0.4, ease: 'power3.out' }, 1.35);
  }

  // 8. HUD tags draw connector lines then pop
  if (hudLines.length > 0) {
    tl.to(hudLines, { scaleX: 1, duration: 0.4, ease: 'expo.inOut' }, 1.55);
  }
  if (hudDots.length > 0) {
    tl.to(hudDots, { scale: 1, duration: 0.25 }, 1.75);
  }
  if (hudBoxes.length > 0) {
    tl.to(hudBoxes, { scale: 1, opacity: 1, duration: 0.4, ease: 'power3.out', onStart: animateHudCounters }, 1.75);
  }

  // 9. Right-edge dots slide in
  if (progressNav) {
    tl.to(progressNav, { x: 0, duration: 0.4, ease: 'power3.out' }, 1.85);
  }

  // 10. Marquee strip slides up
  if (marqueeStrip) {
    tl.to(marqueeStrip, { y: 0, duration: 0.4, ease: 'power3.out' }, 1.95);
  }
}

/**
 * Counts up the numbers inside HUD pointer tags smoothly.
 */
export function initCountUpAnimations() {
  animateHudCounters();
}

/**
 * Helper to animate numeric counters once on enter.
 */
function animateHudCounters() {
  const counters = document.querySelectorAll('.counter-number:not([data-counted="true"])');
  counters.forEach((counter) => {
    counter.setAttribute('data-counted', 'true');
    const targetVal = parseFloat(counter.getAttribute('data-target-num')) || 0;
    const isComma = counter.getAttribute('data-format') === 'comma';
    const suffix = counter.getAttribute('data-suffix') || '';
    const obj = { val: 0 };

    gsap.to(obj, {
      val: targetVal,
      duration: 1.2,
      ease: 'power3.out',
      onUpdate: () => {
        const rounded = Math.round(obj.val);
        if (isComma) {
          counter.textContent = rounded.toLocaleString('en-US') + suffix;
        } else {
          counter.textContent = String(rounded) + suffix;
        }
      },
    });
  });
}

/**
 * Initializes mouse parallax on desktop for hero elements (max 12px).
 */
function initHeroMouseParallax() {
  const hudTags = document.querySelector('.hero-hud-tags-container');

  window.addEventListener('mousemove', (e) => {
    if (window.innerWidth <= 900 || !isHeroActive) return;

    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;

    if (hudTags) {
      gsap.to(hudTags, {
        x: nx * 12,
        y: ny * 12,
        duration: 0.4,
        overwrite: 'auto',
        ease: 'power3.out',
      });
    }
  });
}

/**
 * Initializes full-page video canvas controller.
 * Linear mapping from Hero top to 04 ENTER THE ARENA top.
 * Shares Lenis raf loop (gsap.ticker) with lagSmoothing(0).
 * Scrub smoothing uses a light lerp of 0.15 on the frame index only.
 */
export function initFullPageVideoScroll() {
  const canvas = document.querySelector('.cinematic-canvas');
  const canvasWrapper = document.querySelector('.cinematic-canvas-wrapper');
  const arenaSection = document.querySelector('.section-hackathons');
  const missionSection = document.querySelector('.section-mission');
  const aboutSection = document.querySelector('.section-about');
  if (!canvas || !canvasWrapper || !arenaSection) return;

  // Initialize Lenis scroll
  initLenisScroll();

  const ctx = canvas.getContext('2d', { alpha: false });
  const totalFrames = getTotalFrames();

  // Resize canvas capping internal buffer at 1920x1080 max
  resizeFullScreenCanvas(canvas, ctx, currentFrame);
  window.addEventListener('resize', () => {
    resizeFullScreenCanvas(canvas, ctx, currentFrame);
  });

  if (aboutSection) {
    ScrollTrigger.create({
      trigger: aboutSection,
      start: 'top 90%',
      onUpdate: (self) => {
        isHeroActive = self.progress <= 0.05;
      },
    });
  }

  const heroSection = document.querySelector('.landing-hero');

  // Initialize live Three.js background scene
  initLiveThreeBackground();

  // Swap video canvas to Live Three Scene when entering Hero, and back when scrolling up to Prelude
  if (heroSection) {
    ScrollTrigger.create({
      trigger: heroSection,
      start: 'top 50%',
      onEnter: () => {
        hideFrameCanvas();
        resumeLiveThreeScene();
      },
      onLeaveBack: () => {
        showFrameCanvas();
        pauseLiveThreeScene();
      },
    });
  }

  // Toggles right-edge progress dots during prelude (scrollY < heroTop)
  if (heroSection) {
    ScrollTrigger.create({
      trigger: heroSection,
      start: 'top 40%',
      onEnter: () => {
        const dots = document.querySelector('.vertical-progress-nav');
        if (dots) gsap.set(dots, { opacity: 1, x: 0 });
      },
      onLeaveBack: () => {
        const dots = document.querySelector('.vertical-progress-nav');
        if (dots) gsap.set(dots, { opacity: 0, x: 50 });
      },
    });
  }

  // Light lerp of 0.15 on frame index only in gsap.ticker loop (active only in prelude)
  gsap.ticker.add(() => {
    if (!isVideoFrameLoopActive()) return;
    const diff = targetFrame - currentFrame;
    if (Math.abs(diff) > 0.005) {
      currentFrame += diff * 0.15;
      renderSmoothFrame(canvas, ctx, currentFrame);
    }
  });

  // Hold last frame behind 04. Sections 05-08 sit above canvas with solid backgrounds.
  if (missionSection) {
    ScrollTrigger.create({
      trigger: missionSection,
      start: 'top top',
      onEnter: () => {
        targetFrame = totalFrames - 1;
        canvasWrapper.style.visibility = 'hidden';
      },
      onLeaveBack: () => {
        canvasWrapper.style.visibility = 'visible';
      },
    });
  }

  initVerticalProgressNav();
}

/**
 * Initializes slot-machine roll for "WHERE STUDENTS BUILD." cycling every 2.5s.
 */
export function initAboutSlotMachine() {
  const activeWord = document.querySelector('.slot-machine-active');
  if (!activeWord) return;

  const words = siteContent?.landing?.about?.slotWords || ['BUILD.', 'COMPETE.', 'SHIP.', 'LEARN.'];
  let currentWordIdx = 0;

  if (slotMachineInterval) clearInterval(slotMachineInterval);
  slotMachineInterval = setInterval(() => {
    currentWordIdx = (currentWordIdx + 1) % words.length;
    const nextWord = words[currentWordIdx];

    gsap.to(activeWord, {
      y: -28,
      opacity: 0,
      duration: 0.4,
      ease: 'power3.out',
      onComplete: () => {
        activeWord.textContent = nextWord;
        gsap.fromTo(
          activeWord,
          { y: 28, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' }
        );
      },
    });
  }, 2500);
}

/**
 * Section 01 (About): Initializes heading reveal and slot machine.
 */
export function initAboutScatterHeading() {
  const aboutSection = document.querySelector('.section-about');
  const aboutCol = document.querySelector('.about-right-column');
  if (!aboutSection) return;

  if (aboutCol) {
    ScrollTrigger.create({
      trigger: aboutSection,
      start: 'top 80%',
      onEnter: () => {
        gsap.fromTo(
          aboutCol,
          { y: 35, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', onStart: animateHudCounters }
        );
      },
    });
  }

  initAboutSlotMachine();
}

/**
 * Section 01 (About): Orbit graphic with 4 interactive nodes, 4 scroll steps,
 * flat caption swapping under orbit, 3 left fact tags over video connected to cube,
 * bottom lime progress bar, and max 4-degree 3D card tilt.
 */
export function initAboutOrbitInteraction() {
  const nodes = document.querySelectorAll('.about-visual .orbital-node');
  const outerRing = document.querySelector('.about-visual .ring-outer');
  const midRing = document.querySelector('.about-visual .ring-mid');
  const aboutSection = document.querySelector('.section-about');
  const aboutCol = document.querySelector('.about-right-column');
  const stepNameEl = document.querySelector('.about-step-name');
  const stepDescEl = document.querySelector('.about-step-desc');
  const factTags = document.querySelectorAll('.about-fact-tag');
  const progressFill = document.querySelector('.about-progress-fill');
  if (!aboutSection) return;

  const stepsData = siteContent?.landing?.about?.steps || [
    { num: '01', name: 'STUDENTS', desc: '10,000+ verified builders ready to tackle real engineering problems.' },
    { num: '02', name: 'TEAMS', desc: 'Cross-functional squads combining developers, designers and product minds.' },
    { num: '03', name: 'ORGANIZERS', desc: 'Universities, tech clubs and sponsors hosting vetted challenges.' },
    { num: '04', name: 'HACKATHONS', desc: 'High-stakes arenas with transparent judging and live leaderboards.' },
  ];

  let currentActiveStep = 1;
  let manualOverride = false;
  let overrideTimer = null;

  const setActiveStep = (step) => {
    currentActiveStep = Math.min(4, Math.max(1, step));

    // Update orbit nodes
    nodes.forEach((node, idx) => {
      const nodeStep = idx + 1;
      node.classList.toggle('is-active', nodeStep === currentActiveStep);
    });

    // Update caption
    const currentData = stepsData[currentActiveStep - 1];
    if (currentData) {
      if (stepNameEl) stepNameEl.textContent = currentData.name;
      if (stepDescEl) stepDescEl.textContent = currentData.desc;
    }

    // Update 3 left fact tags (connected to cube, active is lime)
    factTags.forEach((tag, idx) => {
      let shouldBeActive = false;
      if (currentActiveStep === 1 && idx === 0) shouldBeActive = true;
      else if ((currentActiveStep === 2 || currentActiveStep === 3) && idx === 1) shouldBeActive = true;
      else if (currentActiveStep === 4 && idx === 2) shouldBeActive = true;
      tag.classList.toggle('is-active', shouldBeActive);
    });

    // Update bottom lime progress bar
    if (progressFill) {
      progressFill.style.width = `${currentActiveStep * 25}%`;
    }
  };

  // Node click and hover overrides
  nodes.forEach((node, idx) => {
    const step = idx + 1;
    const trigger = () => {
      manualOverride = true;
      setActiveStep(step);
      clearTimeout(overrideTimer);
      overrideTimer = setTimeout(() => {
        manualOverride = false;
      }, 2500);
    };
    node.addEventListener('click', trigger);
    node.addEventListener('mouseenter', trigger);
  });

  // Sticky stage scroll progress driver (4 steps across 240vh)
  ScrollTrigger.create({
    trigger: aboutSection,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      if (manualOverride) return;
      const p = self.progress;
      let step = 1;
      if (p >= 0.75) step = 4;
      else if (p >= 0.50) step = 3;
      else if (p >= 0.25) step = 2;
      setActiveStep(step);
    },
  });

  // Slowly rotate orbit rings
  if (outerRing && midRing) {
    gsap.to(outerRing, {
      rotation: 360,
      duration: 24,
      repeat: -1,
      ease: 'none',
    });

    gsap.to(midRing, {
      rotation: -360,
      duration: 18,
      repeat: -1,
      ease: 'none',
    });
  }

  // Max 4-degree 3D card tilt following mouse on desktop
  if (aboutCol) {
    aboutCol.addEventListener('mousemove', (e) => {
      if (window.innerWidth <= 900) return;
      const rect = aboutCol.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      const rotX = -ny * 4;
      const rotY = nx * 4;
      aboutCol.style.transform = `perspective(600px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`;
    });

    aboutCol.addEventListener('mouseleave', () => {
      aboutCol.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg)';
    });
  }
}

/**
 * Section 02 (Experience): Rebuilt clean single medium card (70vw by 54vh),
 * Left ~62% video with REC dot, viewfinder brackets, timecode 00:00 to 00:30 following scroll;
 * Right ~38% near-black chapter list with hard horizontal wipes;
 * Under card: 10-tick film-strip timeline with lime playhead.
 * Pauses video when out of viewport.
 */
export function initExperienceVideoSection() {
  const expSection = document.querySelector('.section-experience');
  const videoCard = document.querySelector('.experience-medium-card');
  const videoPane = document.querySelector('.exp-video-pane');
  const nativeVideo = document.querySelector('.experience-native-video');
  const toggleIndicator = document.querySelector('.video-toggle-indicator');
  const toggleIcon = document.querySelector('.toggle-indicator-icon');
  const soundBtn = document.querySelector('.exp-sound-btn');
  const soundBtnLabel = document.querySelector('.sound-btn-label');
  const soundBtnIcon = document.querySelector('.sound-btn-icon');
  const timecodeEl = document.querySelector('.exp-video-timecode');
  const headerTimeEl = document.querySelector('.exp-header-time');
  const chapterItems = document.querySelectorAll('.exp-chapter-item');
  const playhead = document.querySelector('.filmstrip-playhead');
  const playheadTag = document.querySelector('.playhead-tag');
  const fallbackPoster = document.querySelector('.video-fallback-poster');
  if (!expSection || !videoCard) return;

  let currentChapterIndex = 0;
  let isVideoUnmuted = false;
  let userManuallyPaused = false;
  let popTimeout = null;

  const formatTimecode = (sec) => {
    const s = Math.min(30, Math.max(0, Math.floor(sec)));
    return `00:${String(s).padStart(2, '0')}`;
  };

  const popIndicator = (symbol) => {
    if (!toggleIndicator || !toggleIcon) return;
    if (popTimeout) clearTimeout(popTimeout);
    toggleIcon.textContent = symbol;
    toggleIndicator.classList.add('is-popping');
    popTimeout = setTimeout(() => {
      toggleIndicator.classList.remove('is-popping');
    }, 400);
  };

  const togglePlayPause = () => {
    if (!nativeVideo) return;
    if (nativeVideo.paused) {
      nativeVideo.play().catch(() => {});
      userManuallyPaused = false;
      popIndicator('▶');
      if (isVideoUnmuted) duckMusic(true);
    } else {
      nativeVideo.pause();
      userManuallyPaused = true;
      popIndicator('❚❚');
      duckMusic(false);
    }
  };

  if (videoPane) {
    videoPane.addEventListener('click', (e) => {
      if (e.target.closest('.exp-sound-btn')) return;
      togglePlayPause();
    });
    videoPane.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        togglePlayPause();
      }
    });
  }

  if (soundBtn) {
    soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!nativeVideo) return;
      isVideoUnmuted = !isVideoUnmuted;
      nativeVideo.muted = !isVideoUnmuted;
      soundBtn.setAttribute('aria-pressed', isVideoUnmuted ? 'true' : 'false');
      if (soundBtnLabel) {
        soundBtnLabel.textContent = isVideoUnmuted ? 'SOUND ON' : 'SOUND OFF';
      }
      if (soundBtnIcon) {
        soundBtnIcon.textContent = isVideoUnmuted ? '🔊' : '🔈';
      }
      duckMusic(isVideoUnmuted);
    });
  }

  const updateChapterState = (newIndex) => {
    if (newIndex === currentChapterIndex) return;
    currentChapterIndex = newIndex;

    chapterItems.forEach((item, idx) => {
      const isActive = idx === newIndex;
      item.classList.toggle('is-active', isActive);
      item.setAttribute('aria-selected', isActive ? 'true' : 'false');
      if (isActive) {
        const curtain = item.querySelector('.chapter-wipe-curtain');
        if (curtain) {
          gsap.fromTo(
            curtain,
            { x: '-101%' },
            { x: '101%', duration: 0.4, ease: 'expo.inOut' }
          );
        }
      }
    });
  };

  // Scroll across 260vh sticky stage
  ScrollTrigger.create({
    trigger: expSection,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      const totalSec = 30;
      const currentSec = p * totalSec;
      const formatted = formatTimecode(currentSec);

      if (timecodeEl) timecodeEl.textContent = formatted;
      if (headerTimeEl) headerTimeEl.textContent = formatted;

      if (playhead) {
        playhead.style.left = `${(p * 100).toFixed(2)}%`;
      }
      if (playheadTag) {
        playheadTag.textContent = formatted;
      }

      let chapterIdx = 0;
      if (p >= 0.66) chapterIdx = 2;
      else if (p >= 0.33) chapterIdx = 1;
      updateChapterState(chapterIdx);

      if (nativeVideo && !isNaN(nativeVideo.duration) && nativeVideo.duration > 0) {
        const vTime = p * nativeVideo.duration;
        if (Math.abs(nativeVideo.currentTime - vTime) > 0.5) {
          nativeVideo.currentTime = vTime;
        }
        if (!userManuallyPaused && nativeVideo.paused) {
          nativeVideo.play().catch(() => {});
        }
      }
    },
    onLeave: () => {
      if (nativeVideo) nativeVideo.pause();
      duckMusic(false);
    },
    onLeaveBack: () => {
      if (nativeVideo) nativeVideo.pause();
      duckMusic(false);
    },
  });

  // Native video fallback and visibility pause
  if (nativeVideo) {
    nativeVideo.addEventListener('error', () => {
      nativeVideo.style.display = 'none';
      if (fallbackPoster) fallbackPoster.style.display = 'flex';
      duckMusic(false);
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (!userManuallyPaused) {
              nativeVideo.play().catch(() => {});
              if (isVideoUnmuted) duckMusic(true);
            }
          } else {
            // Pause video when out of viewport
            nativeVideo.pause();
            duckMusic(false);
          }
        });
      },
      { threshold: 0.2 }
    );
    observer.observe(expSection);
  }

  // Chapter item click seeking
  chapterItems.forEach((item) => {
    item.addEventListener('click', () => {
      const seekSec = parseFloat(item.getAttribute('data-seek')) || 0;
      const chapterIdx = parseInt(item.getAttribute('data-chapter'), 10) || 0;

      updateChapterState(chapterIdx);

      if (nativeVideo) {
        nativeVideo.currentTime = seekSec;
        if (!userManuallyPaused) {
          nativeVideo.play().catch(() => {});
        }
      }

      const p = seekSec / 30;
      const formatted = formatTimecode(seekSec);
      if (timecodeEl) timecodeEl.textContent = formatted;
      if (headerTimeEl) headerTimeEl.textContent = formatted;
      if (playhead) playhead.style.left = `${(p * 100).toFixed(2)}%`;
      if (playheadTag) playheadTag.textContent = formatted;
    });
  });
}

/**
 * Section 03 (How It Works): Quest XP progression, badges, level badges,
 * terminal strip typing and live card mini-demos across 320vh sticky stage.
 */
export function initVerticalStepperHowItWorks() {
  const howSection = document.querySelector('.section-how');
  const cards = document.querySelectorAll('.how-step-card');
  const railFill = document.querySelector('.how-edge-rail-fill');
  const counterNum = document.querySelector('.how-counter-num');
  const xpCurrentEl = document.querySelector('.how-xp-current');
  const xpFillEl = document.querySelector('.how-xp-bar-fill');
  const levelBadgeEl = document.querySelector('.how-level-badge');
  const terminalCmdEl = document.querySelector('.terminal-cmd-text');
  if (!howSection || cards.length === 0) return;

  const questLevels = [
    'LEVEL 1 ROOKIE',
    'LEVEL 2 TEAMMATE',
    'LEVEL 3 BUILDER',
    'LEVEL 4 SHIPPER',
  ];

  const questCommands = [
    'discover --challenge ai-innovation',
    'team up --members 4',
    'build --hours 36',
    'ship --submit demo',
  ];

  let lastStep = 1;

  ScrollTrigger.create({
    trigger: howSection,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;

      // XP Progression (0 to 400 XP)
      const currentXP = Math.min(400, Math.floor(p * 400));
      if (xpCurrentEl) xpCurrentEl.textContent = currentXP;
      if (xpFillEl) xpFillEl.style.width = `${(currentXP / 400) * 100}%`;

      // Rail fill
      if (railFill) {
        railFill.style.height = `${Math.min(100, Math.max(0, p * 100))}%`;
      }

      // Step threshold: 4 steps
      let currentStep = 1;
      if (p >= 0.75) currentStep = 4;
      else if (p >= 0.50) currentStep = 3;
      else if (p >= 0.25) currentStep = 2;

      if (counterNum) {
        counterNum.textContent = `0${currentStep}`;
      }

      if (levelBadgeEl) {
        levelBadgeEl.textContent = questLevels[currentStep - 1];
      }

      if (terminalCmdEl) {
        terminalCmdEl.textContent = questCommands[currentStep - 1];
      }

      // Cards update
      cards.forEach((card, idx) => {
        const stepNum = idx + 1;
        const badgeHex = card.querySelector('.quest-badge-hex');
        const xpChip = card.querySelector('.flying-xp-chip');

        if (stepNum < currentStep) {
          card.classList.remove('is-step-active');
          card.style.opacity = '1';
          card.style.pointerEvents = 'auto';
          if (badgeHex) badgeHex.classList.add('is-slammed');
          if (xpChip) xpChip.classList.add('is-flown');
        } else if (stepNum === currentStep) {
          card.classList.add('is-step-active');
          card.style.opacity = '1';
          card.style.pointerEvents = 'auto';
          if (badgeHex) badgeHex.classList.add('is-slammed');
          if (xpChip) xpChip.classList.add('is-flown');
        } else {
          card.classList.remove('is-step-active');
          card.style.opacity = '0';
          card.style.pointerEvents = 'none';
          if (badgeHex) badgeHex.classList.remove('is-slammed');
          if (xpChip) xpChip.classList.remove('is-flown');
        }
      });

      lastStep = currentStep;
    },
  });
}

/**
 * Section 04 (Enter the Arena): Boarding-Pass Arena Tickets Carousel across 300vh.
 * 3 tickets (LIVE, OPEN, UPCOMING) sliding horizontally with scroll.
 * Active ticket centered/scaled; Left/Right arrow keys and click selection.
 * Stub tear animation on JOIN ARENA click -> redirects to register.html.
 */
export function initArenaLeaderboard() {
  const arenaSection = document.querySelector('.section-hackathons');
  const ticketsTrack = document.querySelector('.arena-tickets-track');
  const tickets = document.querySelectorAll('.arena-pass-card');
  const bgStatusWord = document.querySelector('.arena-bg-status-word');
  const ticketCounter = document.querySelector('.arena-ticket-counter');
  const viewAllBtn = document.querySelector('.btn-arena-viewall');
  const modalBackdrop = document.querySelector('.arena-all-modal-backdrop');
  const modalCloseBtn = document.querySelector('.arena-modal-close-btn');

  if (!arenaSection || tickets.length === 0) return;

  const statusWords = ['LIVE', 'OPEN', 'UPCOMING'];
  const counterLabels = ['01 / 03', '02 / 03', '03 / 03'];
  let currentActive = 0;

  const setActiveTicket = (newIdx) => {
    if (newIdx < 0 || newIdx >= tickets.length) return;
    currentActive = newIdx;

    tickets.forEach((card, idx) => {
      card.classList.toggle('is-active', idx === newIdx);
      card.classList.toggle('is-prev', idx < newIdx);
      card.classList.toggle('is-next', idx > newIdx);
    });

    if (bgStatusWord) {
      bgStatusWord.textContent = statusWords[newIdx];
    }
    if (ticketCounter) {
      ticketCounter.textContent = counterLabels[newIdx];
    }

    if (ticketsTrack) {
      const offset = (1 - newIdx) * 596;
      ticketsTrack.style.transform = `translateX(${offset}px)`;
    }
  };

  // Scroll across 300vh sticky stage
  ScrollTrigger.create({
    trigger: arenaSection,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      let targetIdx = 0;
      if (p >= 0.66) targetIdx = 2;
      else if (p >= 0.33) targetIdx = 1;
      if (targetIdx !== currentActive) {
        setActiveTicket(targetIdx);
      }
    },
  });

  // Click on ticket to select
  tickets.forEach((card, idx) => {
    card.addEventListener('click', () => {
      setActiveTicket(idx);
    });
  });

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    const arenaRect = arenaSection.getBoundingClientRect();
    const inView = arenaRect.top <= 100 && arenaRect.bottom >= 100;
    if (!inView) return;

    if (e.key === 'ArrowRight') {
      if (currentActive < tickets.length - 1) setActiveTicket(currentActive + 1);
    } else if (e.key === 'ArrowLeft') {
      if (currentActive > 0) setActiveTicket(currentActive - 1);
    }
  });

  // Stub tear animation on JOIN ARENA click
  const joinBtns = document.querySelectorAll('.btn-ticket-join');
  joinBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.arena-pass-card');
      const stub = card ? card.querySelector('.ticket-stub-cell') : null;
      if (stub) {
        stub.classList.add('is-torn');
        setTimeout(() => {
          window.location.href = 'register.html';
        }, 800);
      } else {
        window.location.href = 'register.html';
      }
    });
  });

  // Modal toggle
  if (viewAllBtn && modalBackdrop) {
    viewAllBtn.addEventListener('click', () => {
      modalBackdrop.classList.add('is-open');
    });
  }
  if (modalCloseBtn && modalBackdrop) {
    modalCloseBtn.addEventListener('click', () => {
      modalBackdrop.classList.remove('is-open');
    });
  }
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) {
        modalBackdrop.classList.remove('is-open');
      }
    });
  }
}

/**
 * Section 05 (Mission): Sticky stage of 200vh.
 * Words start as outlines and fill white word by word with scroll (BUILDERS stays outlined then fills lime).
 * Parallax ghost watermark sweeps horizontally in opposite direction.
 * Floating sticker chips float and swap places on hover.
 */
/**
 * Section 05 (The Mission): Word-by-word outline-to-solid fill, parallax ghost watermark,
 * two diagonal scrolling word bands crossing behind headline with scroll-velocity scaling,
 * rotating 8-point star, headline velocity skew, 3D mouse tilt on stat chips,
 * and Drop Your Idea interactive sticky note board with drag and bounce.
 */
export function initMissionTextReveal() {
  const missionSection = document.querySelector('.section-mission');
  const stage = document.querySelector('.mission-sticky-stage');
  const words = document.querySelectorAll('.mission-word');
  const watermark = document.querySelector('.mission-watermark-sweep');
  const stickers = document.querySelectorAll('.mission-sticker-chip');
  const trackNeg = document.querySelector('.diagonal-track.track-neg');
  const trackPos = document.querySelector('.diagonal-track.track-pos');
  const starEl = document.querySelector('.mission-eight-point-star');
  const headline = document.querySelector('.mission-fill-text');
  const statItems = document.querySelectorAll('.mission-stat-item');
  const ideaInput = document.querySelector('.idea-board-input');
  const ideaBtn = document.querySelector('.idea-board-submit-btn');
  const notesArea = document.querySelector('.idea-board-notes-area');

  if (!missionSection) return;

  let posNeg = 0;
  let posPos = 0;
  let starAngle = 0;
  let lastScrollY = window.scrollY;
  let scrollVelocity = 0;
  let animFrameId = null;

  // Track scroll velocity for diagonal bands, star spin and headline skew
  const onScrollVelocity = () => {
    const curY = window.scrollY;
    scrollVelocity = curY - lastScrollY;
    lastScrollY = curY;

    if (headline) {
      const skewDeg = Math.max(-4, Math.min(4, scrollVelocity * 0.08));
      gsap.to(headline, { skewX: skewDeg, duration: 0.1, overwrite: 'auto' });
      gsap.to(headline, { skewX: 0, duration: 0.6, ease: 'power3.out', delay: 0.1, overwrite: false });
    }
  };

  window.addEventListener('scroll', onScrollVelocity, { passive: true });

  // Continuous animation loop for diagonal tracks and star
  const tickMissionDecorations = () => {
    scrollVelocity *= 0.92;
    const speedMult = 1 + Math.abs(scrollVelocity) * 0.08;

    posNeg += 0.8 * speedMult;
    posPos -= 0.8 * speedMult;
    starAngle += 0.2 + Math.abs(scrollVelocity) * 0.08;

    if (trackNeg) trackNeg.style.transform = `translateX(${-((posNeg % 600))}px)`;
    if (trackPos) trackPos.style.transform = `translateX(${((posPos % 600))}px)`;
    if (starEl) starEl.style.transform = `rotate(${starAngle}deg)`;

    animFrameId = requestAnimationFrame(tickMissionDecorations);
  };
  animFrameId = requestAnimationFrame(tickMissionDecorations);

  // Parallax watermark & word fill progress
  ScrollTrigger.create({
    trigger: missionSection,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;

      if (watermark) {
        const offsetPx = p * -220;
        watermark.style.transform = `translate(calc(-50% + ${offsetPx}px), -50%)`;
      }

      words.forEach((w, i) => {
        const isBuilders = w.classList.contains('word-builders');
        if (isBuilders) {
          if (p >= 0.75) {
            w.classList.add('is-solid');
          } else {
            w.classList.remove('is-solid');
          }
        } else {
          const wordEnd = (i + 1) * 0.22;
          if (p >= wordEnd) {
            w.classList.add('is-solid');
          } else {
            w.classList.remove('is-solid');
          }
        }
      });
    },
  });

  // Entrance wipe and staggered slide up
  ScrollTrigger.create({
    trigger: missionSection,
    start: 'top 85%',
    once: true,
    onEnter: () => {
      const contentBox = document.querySelector('.mission-content-box');
      const statsCol = document.querySelector('.mission-stats-col');
      const ideaBoard = document.querySelector('.mission-idea-board');

      if (contentBox) {
        gsap.fromTo(contentBox, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' });
      }
      if (statsCol) {
        gsap.fromTo(statsCol, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, delay: 0.1, ease: 'power3.out' });
      }
      if (ideaBoard) {
        gsap.fromTo(ideaBoard, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, delay: 0.2, ease: 'power3.out' });
      }
    },
  });

  // Mouse parallax tilt on stat chips (max 5 deg)
  if (stage && statItems.length > 0) {
    stage.addEventListener('mousemove', (e) => {
      statItems.forEach((item) => {
        const rect = item.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = (e.clientX - centerX) / (rect.width / 2);
        const dy = (e.clientY - centerY) / (rect.height / 2);
        const tiltX = Math.max(-5, Math.min(5, -dy * 5));
        const tiltY = Math.max(-5, Math.min(5, dx * 5));
        item.style.transform = `perspective(600px) rotateX(${tiltX.toFixed(1)}deg) rotateY(${tiltY.toFixed(1)}deg)`;
      });
    });

    stage.addEventListener('mouseleave', () => {
      statItems.forEach((item) => {
        item.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg)';
      });
    });
  }

  // Three flat rotated sticker chips swap positions on hover
  stickers.forEach((sticker) => {
    sticker.addEventListener('mouseenter', () => {
      stickers.forEach((s) => {
        const curOrder = parseInt(s.getAttribute('data-order') || '1', 10);
        const nextOrder = (curOrder % 3) + 1;
        s.setAttribute('data-order', String(nextOrder));
        s.style.order = String(nextOrder);
      });
    });
  });

  // Drop Your Idea Board: Sticky notes with bounce and drag
  const initialNotes = siteContent?.landing?.mission?.ideaBoard?.initialNotes || [
    'AI study group matching by syllabus',
    'Decentralized campus event ticketing',
    'Autonomous library book return cart',
    'Smart mess food waste tracker',
  ];

  let currentNotes = [...initialNotes];

  // Renders the sticky notes into the idea board area
  function renderNotes() {
    if (!notesArea) return;
    notesArea.innerHTML = '';

    currentNotes.forEach((text, idx) => {
      const note = document.createElement('div');
      note.className = `idea-sticky-note note-color-${idx % 4}`;
      note.textContent = text;

      const randomRot = (idx % 2 === 0 ? 1 : -1) * (1.5 + (idx % 3));
      note.style.transform = `rotate(${randomRot}deg)`;

      // Make note draggable with pointer events
      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let curX = 0;
      let curY = 0;

      note.addEventListener('pointerdown', (e) => {
        isDragging = true;
        startX = e.clientX - curX;
        startY = e.clientY - curY;
        note.setPointerCapture(e.pointerId);
        note.style.cursor = 'grabbing';
      });

      note.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        curX = e.clientX - startX;
        curY = e.clientY - startY;
        note.style.transform = `translate(${curX}px, ${curY}px) rotate(${randomRot}deg)`;
      });

      const stopDrag = () => {
        if (!isDragging) return;
        isDragging = false;
        note.style.cursor = 'grab';
      };

      note.addEventListener('pointerup', stopDrag);
      note.addEventListener('pointercancel', stopDrag);

      notesArea.appendChild(note);

      // Bounce in animation
      gsap.fromTo(
        note,
        { scale: 0.6, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2)' }
      );
    });
  }

  renderNotes();

  // Handle adding new idea
  const handleAddIdea = () => {
    if (!ideaInput) return;
    const val = ideaInput.value.trim();
    if (!val) return;

    if (currentNotes.length >= 8) {
      currentNotes.shift();
    }
    currentNotes.push(val);
    ideaInput.value = '';
    renderNotes();
  };

  if (ideaBtn) {
    ideaBtn.addEventListener('click', handleAddIdea);
  }
  if (ideaInput) {
    ideaInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddIdea();
      }
    });
  }
}

// Plain comment: Section 06 The Network sticky stage controller with gentle snapping wheel, exit roll-off, and responsive interactions
export function initNetworkGiantWheel() {
  const wheelEl = document.querySelector('.network-giant-wheel');
  const communitySection = document.querySelector('.section-community');
  const teethGroup = document.querySelector('.wheel-gear-teeth-group');
  const nodeDiscs = document.querySelectorAll('.wheel-node-disc');
  const tabs = document.querySelectorAll('.network-tab-line');
  const counterRing = document.querySelector('.wheel-hub-ring-counter');
  const spokePulses = document.querySelectorAll('.spoke-pulse');
  const roleEl = document.querySelector('.profile-card-role');
  const chipsEl = document.querySelector('.profile-skill-chips');
  const memberEl = document.querySelector('.profile-member-count');
  const requestBtn = document.querySelector('.btn-network-request');
  const toast = document.querySelector('.flat-network-toast');
  const activityToastText = document.querySelector('.activity-toast-text');
  const stepDots = document.querySelectorAll('.network-step-dot');
  const curtainEl = document.querySelector('.network-wipe-curtain');

  if (!wheelEl) return;

  const rolesData = siteContent?.landing?.community?.nodes || [
    { role: 'DEVELOPERS', skills: ['Rust', 'React', 'PyTorch'], members: '1,280 Verified Members' },
    { role: 'DESIGNERS', skills: ['Figma', 'Design Systems', 'Motion'], members: '640 Creative Minds' },
    { role: 'BUILDERS', skills: ['Product', 'Go-To-Market', 'Scrum'], members: '890 Shippers' },
    { role: 'MENTORS', skills: ['Architecture', 'Career', 'Code Review'], members: '150 Tech Leads' },
    { role: 'ORGANIZERS', skills: ['Operations', 'Sponsorship', 'Judging'], members: '90 Arena Leads' },
  ];

  // Plain comment: 1. Generate 40 flat blur-free gear teeth on the SVG rim
  if (teethGroup) {
    teethGroup.innerHTML = '';
    const numTeeth = 40;
    for (let i = 0; i < numTeeth; i++) {
      const angle = (i * 360) / numTeeth;
      const tooth = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      tooth.setAttribute('x', '488');
      tooth.setAttribute('y', '36');
      tooth.setAttribute('width', '24');
      tooth.setAttribute('height', '26');
      tooth.setAttribute('rx', '3');
      tooth.setAttribute('fill', 'rgb(8, 8, 12)');
      tooth.setAttribute('transform', `rotate(${angle} 500 500)`);
      teethGroup.appendChild(tooth);
    }
  }

  // Plain comment: 2. Position 5 node discs along the perimeter (72 degrees apart starting at 9 o'clock / 180 deg)
  const nodeAngles = [180, 252, 324, 396, 468];
  nodeDiscs.forEach((disc, idx) => {
    const rad = (nodeAngles[idx] * Math.PI) / 180;
    const xPct = 50 + 41.5 * Math.cos(rad);
    const yPct = 50 + 41.5 * Math.sin(rad);
    disc.style.left = `${xPct.toFixed(2)}%`;
    disc.style.top = `${yPct.toFixed(2)}%`;
    disc.style.transform = 'translate(-50%, -50%)';
  });

  // Plain comment: Updates profile card contents
  function updateProfileCardContent(idx) {
    const data = rolesData[idx] || rolesData[0];
    if (roleEl) roleEl.textContent = data.role;
    if (memberEl) memberEl.textContent = data.members;
    if (chipsEl) {
      chipsEl.innerHTML = '';
      data.skills.forEach((skill) => {
        const span = document.createElement('span');
        span.className = 'skill-chip';
        span.textContent = skill;
        chipsEl.appendChild(span);
      });
    }
  }

  // Plain comment: Hard wipe profile card swap
  function swapProfileCard(idx) {
    activeRoleIndex = idx;
    stepDots.forEach((dot, dotIdx) => {
      dot.classList.toggle('is-active', dotIdx === idx);
    });
    tabs.forEach((tab) => {
      tab.classList.toggle('is-active', tab.getAttribute('data-role') === rolesData[idx].role);
    });

    const cardWipe = document.querySelector('.profile-card-wipe');
    if (cardWipe) {
      gsap.killTweensOf(cardWipe);
      gsap.fromTo(
        cardWipe,
        { x: '-101%' },
        {
          x: '0%',
          duration: 0.16,
          ease: 'power2.in',
          onComplete: () => {
            updateProfileCardContent(idx);
            gsap.to(cardWipe, {
              x: '101%',
              duration: 0.18,
              ease: 'power2.out',
            });
          },
        }
      );
    } else {
      updateProfileCardContent(idx);
    }
  }

  // Plain comment: Check reduced motion preference
  const isReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (isReducedMotion) {
    updateProfileCardContent(0);
    nodeDiscs[0]?.classList.add('is-active');
    stepDots[0]?.classList.add('is-active');

    // Click only selection for reduced motion
    nodeDiscs.forEach((disc, idx) => {
      disc.addEventListener('click', (e) => {
        e.stopPropagation();
        nodeDiscs.forEach((d, i) => d.classList.toggle('is-active', i === idx));
        swapProfileCard(idx);
      });
    });
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const role = tab.getAttribute('data-role');
        const targetIdx = rolesData.findIndex((r) => r.role === role);
        if (targetIdx !== -1) {
          nodeDiscs.forEach((d, i) => d.classList.toggle('is-active', i === targetIdx));
          swapProfileCard(targetIdx);
        }
      });
    });
    return;
  }

  // State variables
  let activeRoleIndex = 0;
  let scrollAngle = 0;
  let manualOffset = 0;
  let velocitySpin = 0;
  let exitProgress = 0;
  let isDragging = false;
  let isHovered = false;
  let startPointerAngle = 0;
  let startManualOffset = 0;
  let prevPointerAngle = 0;
  let pulseTimer = 0;
  let lastScrollY = window.scrollY;

  // Plain comment: Computes snapped scroll rotation with dead-zone of ~12% per node
  function calcSnappedScrollAngle(p) {
    const clampedP = Math.min(0.88, Math.max(0, p));
    const nodeSpan = 0.22;
    const stepFloat = clampedP / nodeSpan;
    const stepIndex = Math.min(3, Math.floor(stepFloat));
    const frac = stepFloat - stepIndex;

    let t = 0;
    if (frac < 0.40) {
      t = 0;
    } else if (frac > 0.60) {
      t = 1;
    } else {
      const norm = (frac - 0.40) / 0.20;
      t = norm * norm * (3 - 2 * norm);
    }

    const effectiveStep = stepIndex + t;
    return -effectiveStep * 72;
  }

  // Plain comment: Normalizes angle difference to -180..180
  function diffAngle(a, b) {
    let d = (a - b) % 360;
    if (d < -180) d += 360;
    if (d > 180) d -= 360;
    return d;
  }

  // Plain comment: Applies transforms to wheel, counter-ring, labels, and checks closest node
  function applyWheelTransforms() {
    const totalAngle = scrollAngle + manualOffset + velocitySpin;

    if (exitProgress > 0) {
      const exitX = exitProgress * 140;
      const exitRot = exitProgress * 120;
      wheelEl.style.transform = `translateY(-50%) translateX(${exitX.toFixed(2)}%) rotate(${(totalAngle + exitRot).toFixed(2)}deg)`;
    } else {
      wheelEl.style.transform = `translateY(-50%) rotate(${totalAngle.toFixed(2)}deg)`;
    }

    if (counterRing) {
      counterRing.style.transform = `rotate(${(-totalAngle * 1.5).toFixed(2)}deg)`;
    }

    nodeDiscs.forEach((disc) => {
      const inner = disc.querySelector('.wheel-node-inner');
      if (inner) {
        inner.style.transform = `rotate(${(-totalAngle).toFixed(2)}deg)`;
      }
    });

    // Closest node calculation to 9 o'clock pointer (180 deg)
    const normAngle = ((-totalAngle % 360) + 360) % 360;
    const closestIdx = Math.round(normAngle / 72) % 5;

    nodeDiscs.forEach((disc, idx) => {
      disc.classList.toggle('is-active', idx === closestIdx);
    });

    if (closestIdx !== activeRoleIndex && !isDragging) {
      swapProfileCard(closestIdx);
    }
  }

  // Plain comment: Main animation loop for spoke pulses, inertia decay, and velocity spin
  function renderWheelTick() {
    pulseTimer += 0.04;

    spokePulses.forEach((pulse, idx) => {
      const pScale = 0.8 + 0.4 * Math.sin(pulseTimer * 3 + idx);
      const pOpacity = 0.5 + 0.5 * Math.sin(pulseTimer * 3 + idx);
      pulse.style.transform = `scale(${pScale.toFixed(2)})`;
      pulse.style.opacity = pOpacity.toFixed(2);
    });

    if (Math.abs(velocitySpin) > 0.02) {
      velocitySpin *= 0.90;
    } else {
      velocitySpin = 0;
    }

    if (!isDragging) {
      applyWheelTransforms();
    }

    requestAnimationFrame(renderWheelTick);
  }

  requestAnimationFrame(renderWheelTick);

  // Plain comment: ScrollTrigger for Section 06: progress 0..1 controls wheel rotation and exit
  ScrollTrigger.create({
    trigger: communitySection,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      scrollAngle = calcSnappedScrollAngle(p);

      if (p >= 0.92) {
        exitProgress = Math.min(1, Math.max(0, (p - 0.92) / 0.08));
        if (curtainEl) {
          curtainEl.style.transform = `translateX(${(-100 + exitProgress * 100).toFixed(2)}%)`;
        }
      } else {
        exitProgress = 0;
        if (curtainEl) {
          curtainEl.style.transform = 'translateX(-101%)';
        }
      }

      if (Math.abs(manualOffset) > 0.1) {
        manualOffset *= 0.88;
      } else {
        manualOffset = 0;
      }

      applyWheelTransforms();
    },
  });

  // Plain comment: Scroll velocity tracking to add extra spin that eases back
  window.addEventListener(
    'scroll',
    () => {
      const curY = window.scrollY;
      const diffY = curY - lastScrollY;
      lastScrollY = curY;
      if (!isDragging) {
        velocitySpin += diffY * 0.06;
      }
    },
    { passive: true }
  );

  // Plain comment: Pointer angle helper for dragging
  const getPointerAngle = (clientX, clientY) => {
    const rect = wheelEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI;
  };

  wheelEl.addEventListener('pointerdown', (e) => {
    isDragging = true;
    startPointerAngle = getPointerAngle(e.clientX, e.clientY);
    prevPointerAngle = startPointerAngle;
    startManualOffset = manualOffset;
    velocitySpin = 0;
    wheelEl.setPointerCapture(e.pointerId);
  });

  wheelEl.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const curAngle = getPointerAngle(e.clientX, e.clientY);
    const delta = diffAngle(curAngle, startPointerAngle);
    manualOffset = startManualOffset + delta;
    velocitySpin = diffAngle(curAngle, prevPointerAngle);
    prevPointerAngle = curAngle;
    applyWheelTransforms();
  });

  const stopDrag = () => {
    if (!isDragging) return;
    isDragging = false;
  };

  wheelEl.addEventListener('pointerup', stopDrag);
  wheelEl.addEventListener('pointercancel', stopDrag);

  wheelEl.addEventListener('mouseenter', () => {
    isHovered = true;
  });
  wheelEl.addEventListener('mouseleave', () => {
    isHovered = false;
  });

  // Plain comment: Rotates wheel to align a clicked node or tab with pointer
  function rotateToRoleIndex(idx) {
    const targetOffset = -(idx * 72);
    const diff = diffAngle(targetOffset, scrollAngle + manualOffset);
    const targetManual = manualOffset + diff;

    gsap.to(
      { val: manualOffset },
      {
        val: targetManual,
        duration: 0.8,
        ease: 'expo.out',
        onUpdate: function () {
          manualOffset = this.targets()[0].val;
          applyWheelTransforms();
        },
        onComplete: () => {
          swapProfileCard(idx);
        },
      }
    );
  }

  nodeDiscs.forEach((disc, idx) => {
    disc.addEventListener('click', (e) => {
      e.stopPropagation();
      rotateToRoleIndex(idx);
    });
  });

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const role = tab.getAttribute('data-role');
      const targetIdx = rolesData.findIndex((r) => r.role === role);
      if (targetIdx !== -1) {
        rotateToRoleIndex(targetIdx);
      }
    });
  });

  // Plain comment: Send request demo feedback toast
  if (requestBtn && toast) {
    let toastTimer = null;
    requestBtn.addEventListener('click', () => {
      toast.classList.add('is-visible');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toast.classList.remove('is-visible');
      }, 2500);
    });
  }

  // Plain comment: 4s Rotating Activity Toast
  const activityList = siteContent?.landing?.community?.activityToasts || [
    'Priya S. joined AI Innovation team',
    'Aarav K. requested a React builder',
    'Marcus R. pinned a Figma system',
    'Nina C. shipped campus map v2',
  ];
  let activityIdx = 0;
  setInterval(() => {
    activityIdx = (activityIdx + 1) % activityList.length;
    if (activityToastText) {
      gsap.to(activityToastText, {
        y: -15,
        opacity: 0,
        duration: 0.25,
        ease: 'power3.in',
        onComplete: () => {
          activityToastText.textContent = activityList[activityIdx];
          gsap.fromTo(activityToastText, { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.25, ease: 'power3.out' });
        },
      });
    }
  }, 4000);

  // Initial apply
  updateProfileCardContent(0);
  applyWheelTransforms();
}

/**
 * Backwards compatibility alias for network stage initialization.
 */
export function initNetworkDraggableNodes() {
  initNetworkGiantWheel();
}

/**
 * Section 07 (Ready?): Huge magnetic lime button with flat square-confetti burst on hover.
 */
export function initReadyConfetti() {
  const btn = document.querySelector('.ready-huge-lime-btn');
  const stage = document.querySelector('.flat-square-confetti-stage');
  if (!btn || !stage) return;

  const spawnFlatConfetti = () => {
    const colors = [
      'rgb(168, 230, 46)',
      'rgb(118, 101, 255)',
      'rgb(255, 255, 255)',
      'rgb(118, 101, 255)',
    ];

    for (let i = 0; i < 28; i++) {
      const square = document.createElement('span');
      square.className = 'flat-confetti-piece';
      const size = Math.floor(Math.random() * 8 + 6);
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * 140 + 50;
      const destX = Math.cos(angle) * distance;
      const destY = Math.sin(angle) * distance;
      const rotation = Math.random() * 360;

      square.style.width = `${size}px`;
      square.style.height = `${size}px`;
      square.style.background = colors[i % colors.length];
      square.style.setProperty('--dest-x', `${destX}px`);
      square.style.setProperty('--dest-y', `${destY}px`);
      square.style.setProperty('--rot', `${rotation}deg`);

      stage.appendChild(square);
      setTimeout(() => square.remove(), 750);
    }
  };

  btn.addEventListener('mouseenter', spawnFlatConfetti);
}

/**
 * Transitions between 05 (Mission), 06 (Network) and 07 (Ready):
 * Hard horizontal wipes (solid colour bar sliding across), never fades.
 */
export function initHorizontalColorWipes() {
  const wipeLime = document.querySelector('.wipe-bar-lime');
  const missionSection = document.querySelector('.section-mission');
  const networkSection = document.querySelector('.section-community');
  const wipeBlack = document.querySelector('.wipe-bar-black');

  // Hard wipe 1: Solid lime bar slides across from left to right as 06 enters
  if (wipeLime && missionSection && networkSection) {
    ScrollTrigger.create({
      trigger: networkSection,
      start: 'top bottom',
      end: 'top 20%',
      scrub: true,
      onUpdate: (self) => {
        const p = self.progress;
        wipeLime.style.transform = `translateX(${-100 + p * 100}%)`;
      },
    });
  }

  // Hard wipe 2: Solid near-black bar slides across from left to right as 07 enters
  if (wipeBlack && networkSection) {
    const ctaSection = document.querySelector('.section-cta');
    if (ctaSection) {
      ScrollTrigger.create({
        trigger: ctaSection,
        start: 'top bottom',
        end: 'top 20%',
        scrub: true,
        onUpdate: (self) => {
          const p = self.progress;
          wipeBlack.style.transform = `translateX(${-100 + p * 100}%)`;
        },
      });
    }
  }
}

/**
 * Section progress navigation dot sync.
 */
function initVerticalProgressNav() {
  const dots = document.querySelectorAll('.vertical-progress-nav .progress-dot');
  if (dots.length === 0) return;

  const sectionSelectors = [
    '.landing-hero',
    '.section-about',
    '.section-experience',
    '.section-how',
    '.section-hackathons',
    '.section-mission',
    '.section-community',
    '.section-cta',
  ];

  sectionSelectors.forEach((selector, idx) => {
    const secEl = document.querySelector(selector);
    const dotEl = dots[idx];
    if (!secEl || !dotEl) return;

    ScrollTrigger.create({
      trigger: secEl,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) => {
        if (self.isActive) {
          dots.forEach((d) => d.classList.remove('is-active'));
          dotEl.classList.add('is-active');
        }
      },
    });

    dotEl.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToTarget(secEl, -70);
    });
  });
}

/**
 * Global scroll progress bar fill at the top of the viewport.
 */
export function initGlobalScrollProgress() {
  const fill = document.querySelector('.global-scroll-progress-fill');
  if (!fill) return;

  window.addEventListener('scroll', () => {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    if (total <= 0) return;
    const progress = Math.min(100, Math.max(0, (window.scrollY / total) * 100));
    fill.style.width = `${progress}%`;
  }, { passive: true });
}

// Plain comment: Bypasses intro and prelude animations and sets 3D scene and hero reveal state correctly
function ensurePreludeSkippedForNav() {
  const overlay = document.querySelector('.opening-stage-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }

  try {
    sessionStorage.setItem('campuscode_intro_done', 'true');
  } catch (err) {}

  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
  document.body.classList.remove('opening-locked');

  const nav = document.querySelector('.site-navbar');
  if (nav) {
    nav.classList.remove('is-intro-hidden');
    nav.removeAttribute('inert');
    nav.style.visibility = 'visible';
    nav.style.transform = 'translateY(0)';
  }

  setTargetFrame(0);
  hideFrameCanvas();
  resumeLiveThreeScene();

  const wipeBlack = document.querySelector('.prelude-wipe-black');
  const wipeLime = document.querySelector('.prelude-wipe-lime');
  if (wipeBlack) wipeBlack.style.transform = 'translateX(101%)';
  if (wipeLime) wipeLime.style.transform = 'translateX(101%)';

  initHeroSceneReveal();
}

// Plain comment: Smoothly scrolls to a target DOM element with 1.2s expo.inOut and prelude bypass
export function scrollToTarget(target, offset = -70) {
  const el = typeof target === 'string' ? document.querySelector(target.startsWith('.') ? target : `.${target}`) : target;
  if (!el) return;

  // If prelude or intro is active, bypass it immediately and set 3D scene and hero ready
  ensurePreludeSkippedForNav();

  const lenis = initLenisScroll();
  const expoInOut = (t) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
  };

  if (lenis && typeof lenis.scrollTo === 'function') {
    lenis.start();
    lenis.scrollTo(el, {
      offset,
      duration: 1.2,
      immediate: false,
      easing: expoInOut,
    });
  } else {
    const top = el.getBoundingClientRect().top + window.scrollY + offset;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }
}

// Plain comment: Navbar smooth scrolling on button clicks, logo clicks, and footer product links
export function initNavScroll() {
  const navBtns = document.querySelectorAll('.site-navbar button[data-target]');
  navBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetClass = btn.getAttribute('data-target');
      const targetEl = document.querySelector(`.${targetClass}`);
      if (targetEl) {
        const offset = (targetClass === 'section-community' || targetClass === 'section-about' || targetClass === 'section-how') ? 0 : -70;
        scrollToTarget(targetEl, offset);
      }
    });
  });

  // Logo in navbar scrolls to top of hero
  const brandLogos = document.querySelectorAll('.site-navbar .brand-link');
  brandLogos.forEach((logo) => {
    logo.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToTarget('.landing-hero', 0);
    });
  });

  // Hero explore button and HUD tags
  const heroExploreBtn = document.querySelector('.hero-flat-panel button[data-target]');
  if (heroExploreBtn) {
    heroExploreBtn.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToTarget('.section-hackathons', -70);
    });
  }

  const hudTagArena = document.querySelector('.hud-tag-arena');
  if (hudTagArena) {
    hudTagArena.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToTarget('.section-hackathons', -70);
    });
  }

  const hudTagNetwork = document.querySelector('.hud-tag-network');
  if (hudTagNetwork) {
    hudTagNetwork.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToTarget('.section-community', 0);
    });
  }

  // Footer product links
  const footerProductBtns = document.querySelectorAll('.footer-col button[data-target]');
  footerProductBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetClass = btn.getAttribute('data-target');
      const targetEl = document.querySelector(`.${targetClass}`);
      if (targetEl) {
        scrollToTarget(targetEl, -70);
      }
    });
  });
}

/**
 * Text scramble animation for technical section labels.
 */
export function initTextScramble() {
  const scramblers = document.querySelectorAll('.scramble-on-enter');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/';

  scramblers.forEach((el) => {
    const originalText = el.textContent;
    let hasAnimated = false;

    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      onEnter: () => {
        if (hasAnimated) return;
        hasAnimated = true;
        let iteration = 0;
        const interval = setInterval(() => {
          el.textContent = originalText
            .split('')
            .map((char, index) => {
              if (index < iteration) return originalText[index];
              if (char === ' ') return ' ';
              return chars[Math.floor(Math.random() * chars.length)];
            })
            .join('');

          if (iteration >= originalText.length) {
            clearInterval(interval);
            el.textContent = originalText;
          }
          iteration += 1 / 2;
        }, 30);
      },
    });
  });
}

/**
 * Adds subtle magnetic movement to designated elements.
 */
export function initMagneticButtons() {
  const buttons = document.querySelectorAll('.ready-huge-lime-btn, .btn-flat-violet');
  buttons.forEach((btn) => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      gsap.to(btn, { x: x * 0.2, y: y * 0.2, duration: 0.3, ease: 'power1.out' });
    });

    btn.addEventListener('mouseleave', () => {
      gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    });
  });
}
