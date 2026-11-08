// ==============================================================================
// VIDEO PRELUDE CONTROLLER (CHANGE REQUEST D7)
// 450vh scroll wrapper at top of document with 100vh sticky stage.
// Progress 0 to 1 maps linearly to full frame sequence (1 to 95).
// Centre 40 percent kept completely clear for 3D emblem and logo bars.
// Side content: 4 chapters, left chapter rail, bottom-left mono counter,
// side decorative shapes with scroll parallax, top-right HUD cues,
// right lime progress rail, and end-of-prelude dual hard wipe into Hero.
// Strict Rule: No hash symbols anywhere in this file.
// Plain comment above every function.
// ==============================================================================

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getTotalFrames, renderSmoothFrame, hideFrameCanvas, showFrameCanvas } from './frames.js';
import { initHeroSceneReveal, initLenisScroll, setTargetFrame } from './scroll.js';
import { resumeLiveThreeScene, pauseLiveThreeScene } from './threeBackground.js';
import { siteContent } from './content.js';

gsap.registerPlugin(ScrollTrigger);

let hasHeroRevealedFromPrelude = false;
let preludeScrollTrigger = null;

/**
 * Checks if the user prefers reduced motion.
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Returns the exact absolute document scroll offset in pixels where the Hero section begins.
 */
export function getHeroOffsetTop() {
  const heroSection = document.querySelector('.landing-hero');
  if (!heroSection) return 0;
  return Math.round(heroSection.getBoundingClientRect().top + window.scrollY);
}

/**
 * Immediately jumps past the prelude straight to the Hero top and reveals the Hero.
 * Called by SKIP buttons and the keyboard End key.
 */
export function skipToHero() {
  const heroSection = document.querySelector('.landing-hero');
  if (!heroSection) return;

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

  const heroTop = getHeroOffsetTop();
  const lenis = initLenisScroll();

  if (lenis) {
    lenis.start();
    lenis.scrollTo(heroTop, { immediate: true });
  }
  window.scrollTo(0, heroTop);

  // Reset video canvas to frame 1 (index 0) and swap to live Three.js background
  setTargetFrame(0);
  hideFrameCanvas();
  resumeLiveThreeScene();

  // Ensure prelude wipes are pushed out of view
  const wipeBlack = document.querySelector('.prelude-wipe-black');
  const wipeLime = document.querySelector('.prelude-wipe-lime');
  if (wipeBlack) wipeBlack.style.transform = 'translateX(101%)';
  if (wipeLime) wipeLime.style.transform = 'translateX(101%)';

  hasHeroRevealedFromPrelude = true;
  initHeroSceneReveal();
}

// Plain comment: Updates active chapter cards, outlined giant chapter number, and bottom-left percentage counter
function updatePreludeChapter(chapterIndex, currentFrameNum, totalFrames, progress = 0) {
  const cards = document.querySelectorAll('.prelude-card');
  const giantNum = document.querySelector('.prelude-giant-chapter-num');
  const frameCounter = document.querySelector('.prelude-frame-counter');

  // Update chapter cards (hard clip-path wipe in and out)
  cards.forEach((card, idx) => {
    if (idx === chapterIndex) {
      card.classList.add('is-card-active');
    } else {
      card.classList.remove('is-card-active');
    }
  });

  // Update outlined giant number
  const paddedChapter = String(chapterIndex + 1).padStart(2, '0');
  if (giantNum && giantNum.textContent !== paddedChapter) {
    giantNum.textContent = paddedChapter;
  }

  // Update bottom-left percentage counter: 000% to 100%
  if (frameCounter) {
    const pct = Math.min(100, Math.max(0, Math.round(progress * 100)));
    frameCounter.textContent = `${String(pct).padStart(3, '0')}%`;
  }
}

/**
 * Updates top-right HUD cue text as scroll advances.
 */
function updatePreludeHud(progress) {
  const cueTextEl = document.querySelector('.prelude-cue-text');
  if (!cueTextEl) return;

  const content = siteContent?.landing?.prelude || {};
  let targetText = content.hudCueInitial || 'SCROLL TO EXPLORE';

  if (progress >= 0.92) {
    targetText = content.hudCueFinal || 'ENTERING THE ARENA';
  } else if (progress >= 0.5) {
    targetText = content.hudCueMiddle || 'KEEP GOING';
  }

  if (cueTextEl.textContent !== targetText) {
    cueTextEl.textContent = targetText;
  }
}

/**
 * Drifts side decorative shapes with scroll parallax while keeping center 40% clear.
 */
function updateSideDecorativeParallax(p) {
  const limeRing = document.querySelector('.prelude-shape-lime-ring');
  const logoBars = document.querySelector('.prelude-shape-logo-bars');
  const box1 = document.querySelector('.prelude-shape-outline-box.box-1');
  const violetCircle = document.querySelector('.prelude-shape-violet-circle');
  const cube = document.querySelector('.prelude-shape-cube');
  const box2 = document.querySelector('.prelude-shape-outline-box.box-2');

  // Left side shapes drift upward
  if (limeRing) {
    limeRing.style.transform = `translateY(-${p * 140}px) rotate(${p * 200}deg)`;
  }
  if (logoBars) {
    logoBars.style.transform = `translateY(-${p * 110}px) rotate(${18 + p * 36}deg)`;
  }
  if (box1) {
    box1.style.transform = `translateY(-${p * 170}px) rotate(${p * 90}deg)`;
  }

  // Right side shapes drift downward
  if (violetCircle) {
    violetCircle.style.transform = `translateY(${p * 130}px)`;
  }
  if (cube) {
    cube.style.transform = `translateY(${p * 160}px) rotate(${p * 70}deg)`;
  }
  if (box2) {
    box2.style.transform = `translateY(${p * 100}px) rotate(${-p * 140}deg)`;
  }
}

/**
 * Initializes the video prelude ScrollTrigger, side content, and transition wipes.
 */
export function initPreludeScroll() {
  const preludeSection = document.querySelector('.section-prelude');
  const heroSection = document.querySelector('.landing-hero');
  const rightRailFill = document.querySelector('.prelude-right-rail-fill');
  const wipeBlack = document.querySelector('.prelude-wipe-black');
  const wipeLime = document.querySelector('.prelude-wipe-lime');
  const skipBtn = document.querySelector('.prelude-skip-btn');
  const totalFrames = getTotalFrames();

  if (!preludeSection || !heroSection || preludeSection.style.display === 'none') return;

  // Keyboard End key listener jumps to Hero start
  window.addEventListener('keydown', (e) => {
    if (e.key === 'End') {
      e.preventDefault();
      skipToHero();
    }
  });

  if (skipBtn) {
    skipBtn.addEventListener('click', skipToHero);
  }

  // Create Prelude ScrollTrigger
  preludeScrollTrigger = ScrollTrigger.create({
    trigger: preludeSection,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const heroTop = heroSection.offsetTop;
      const scrollY = window.scrollY;

      // When scroll moves past prelude into main landing page, return early
      if (scrollY >= heroTop - 8) {
        return;
      }

      const p = self.progress;

      // Update right slim rail
      if (rightRailFill) {
        rightRailFill.style.height = `${(p * 100).toFixed(1)}%`;
      }

      // Map progress to video frame index (0 to 0.88 scrubs frames 0 to 94)
      const scrubPhaseEnd = 0.88;
      let frameSlot = 0;
      if (p <= scrubPhaseEnd) {
        frameSlot = Math.min(totalFrames - 1, Math.floor((p / scrubPhaseEnd) * totalFrames));
      } else {
        frameSlot = totalFrames - 1;
      }

      // Choose active frame from Prelude
      setTargetFrame(frameSlot);

      // Determine active chapter: 0..0.25 (0), 0.25..0.55 (1), 0.55..0.85 (2), 0.85..1.0 (3)
      let chapterIdx = 0;
      if (p >= 0.85) chapterIdx = 3;
      else if (p >= 0.55) chapterIdx = 2;
      else if (p >= 0.25) chapterIdx = 1;

      updatePreludeChapter(chapterIdx, frameSlot + 1, totalFrames, p);
      updatePreludeHud(p);
      updateSideDecorativeParallax(p);

      // Transition zone at end of prelude (last 100vh / p >= 0.88)
      if (p >= scrubPhaseEnd) {
        const wipeProgress = Math.min(1, Math.max(0, (p - scrubPhaseEnd) / (1 - scrubPhaseEnd)));

        // Dual hard wipes across screen: near-black, then lime
        const blackX = -101 + wipeProgress * 202;
        const limeX = -101 + Math.max(0, (wipeProgress - 0.12) / 0.88) * 202;

        if (wipeBlack) wipeBlack.style.transform = `translateX(${blackX.toFixed(1)}%)`;
        if (wipeLime) wipeLime.style.transform = `translateX(${limeX.toFixed(1)}%)`;

        // Once wipe covers the screen (wipeProgress >= 0.94), reset frame canvas to 0 and reveal Hero
        if (wipeProgress >= 0.94) {
          setTargetFrame(0);
          hideFrameCanvas();
          resumeLiveThreeScene();
          if (!hasHeroRevealedFromPrelude) {
            hasHeroRevealedFromPrelude = true;
            try {
              sessionStorage.setItem('campuscode_intro_done', 'true');
            } catch (err) {}
            initHeroSceneReveal();
          }
        }
      } else {
        // Reset wipe positions if scrolling backward up into the prelude
        if (wipeBlack) wipeBlack.style.transform = 'translateX(-101%)';
        if (wipeLime) wipeLime.style.transform = 'translateX(-101%)';
        if (p < 0.82) {
          hasHeroRevealedFromPrelude = false;
          showFrameCanvas();
          pauseLiveThreeScene();
        }
      }
    },
  });

  return preludeScrollTrigger;
}
