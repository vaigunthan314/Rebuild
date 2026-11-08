// ==============================================================================
// CAMPUSCODE MAIN CLIENT CONTROLLER
// Direct 3D emblem drop-and-bounce opening, first-scroll transition,
// slide-up/slide-in page transitions without full-screen colored wipes,
// and session-persistent audio continuity across index, auth, and dashboard pages.
// Strict Rule: No hash symbols anywhere.
// ==============================================================================

// Ensure manual scroll restoration and scroll to top before any DOM elements render
if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
if (typeof window !== 'undefined') {
  window.scrollTo(0, 0);
}

import { renderSmoothFrame, startSilentPreload } from './frames.js';
import { siteContent } from './content.js';
import {
  initAudioSystem,
  startMusic,
} from './audio.js';
import {
  initAboutOrbitInteraction,
  initAboutScatterHeading,
  initArenaLeaderboard,
  initCountUpAnimations,
  initExperienceVideoSection,
  initFullPageVideoScroll,
  initGlobalScrollProgress,
  initHeroSceneReveal,
  initHorizontalColorWipes,
  initLenisScroll,
  initMagneticButtons,
  initMissionTextReveal,
  initNavScroll,
  initNetworkDraggableNodes,
  initReadyConfetti,
  initTextScramble,
  initVerticalStepperHowItWorks,
  revealHeroMainDirectly,
} from './scroll.js';
import {
  executeFirstScrollTransition,
  initThreeOpeningScene,
  skipOpeningBounce,
  skipOpeningStageImmediately,
} from './threeScene.js';
import {
  getHeroOffsetTop,
  initPreludeScroll,
  prefersReducedMotion,
  skipToHero,
} from './prelude.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Spawns an expanding violet/lime shockwave ring and bursting particles
 * at the impact point of the 3D CampusCode object.
 */
function spawnImpactShockwaveAndParticles(impactLevel) {
  const container = document.querySelector('.opening-stage-overlay');
  if (!container) return;

  // Expanding shockwave ring (sound produced solely by singleton background music)
  const shockwaveViolet = document.createElement('div');
  shockwaveViolet.className = `opening-shockwave level-violet ${impactLevel === 1 ? 'size-primary' : 'size-secondary'}`;
  container.appendChild(shockwaveViolet);

  setTimeout(() => {
    const shockwaveLime = document.createElement('div');
    shockwaveLime.className = `opening-shockwave level-lime ${impactLevel === 1 ? 'size-primary' : 'size-secondary'}`;
    container.appendChild(shockwaveLime);
    setTimeout(() => shockwaveLime.remove(), 700);
  }, 90);

  setTimeout(() => shockwaveViolet.remove(), 750);

  // 3. Light dust puff
  const dust = document.createElement('div');
  dust.className = 'opening-dust-puff';
  container.appendChild(dust);
  setTimeout(() => dust.remove(), 600);

  // 4. Particle Burst
  const particleCount = impactLevel === 1 ? 26 : 14;
  const particleWrap = document.createElement('div');
  particleWrap.className = 'impact-particles-wrap';
  container.appendChild(particleWrap);

  for (let i = 0; i < particleCount; i++) {
    const p = document.createElement('span');
    const isLime = Math.random() > 0.45;
    p.className = `burst-particle ${isLime ? 'particle-lime' : 'particle-violet'}`;

    const angle = Math.random() * Math.PI * 2;
    const distance = (Math.random() * 85 + 40) * (impactLevel === 1 ? 1.5 : 1);
    const destX = Math.cos(angle) * distance;
    const destY = Math.sin(angle) * distance - (Math.random() * 30 + 10);

    p.style.setProperty('--dest-x', `${destX}px`);
    p.style.setProperty('--dest-y', `${destY}px`);
    p.style.setProperty('--scale-rand', `${(Math.random() * 0.7 + 0.6).toFixed(2)}`);

    particleWrap.appendChild(p);
  }

  setTimeout(() => particleWrap.remove(), 700);
}

/**
 * Initializes the Three.js 3D Opening Scene with cube drop, bounce, shockwave, and wordmark.
 * Direct entrance without any black ENTER gate screen.
 * Once user scrolls, hard wipes upward to reveal the video prelude.
 * Bypasses intro and prelude if already seen in this session (unless intro=1 query param is set).
 */
function initOpeningLanding() {
  const skipBtn = document.querySelector('.opening-skip-btn');
  const scrollPrompt = document.querySelector('.opening-scroll-prompt');

  // Check if intro was already played in this browser tab
  const urlParams = new URLSearchParams(window.location.search);
  const forceIntro = urlParams.get('intro') === '1';

  let hasSeenIntro = false;
  try {
    hasSeenIntro = sessionStorage.getItem('campuscode_intro_done') === 'true';
  } catch (err) {}

  if (prefersReducedMotion() || (hasSeenIntro && !forceIntro)) {
    // Completely bypass opening and prelude, open straight on the hero
    skipOpeningStageImmediately();
    const overlay = document.querySelector('.opening-stage-overlay');
    if (overlay) overlay.style.display = 'none';
    const enterScreen = document.querySelector('.enter-stage-screen');
    if (enterScreen) enterScreen.style.display = 'none';

    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.classList.remove('opening-locked');

    const nav = document.querySelector('.site-navbar');
    if (nav) {
      nav.classList.remove('is-intro-hidden');
      nav.removeAttribute('inert');
      nav.style.visibility = 'visible';
      nav.style.opacity = '1';
      nav.style.transform = 'none';
    }
    const statusStrip = document.querySelector('.navbar-status-strip');
    if (statusStrip) {
      statusStrip.style.opacity = '1';
      statusStrip.style.transform = 'none';
    }

    // Set all page content visible
    const pageWrapper = document.querySelector('.page-wrapper');
    if (pageWrapper) {
      pageWrapper.style.opacity = '1';
      pageWrapper.style.visibility = 'visible';
      pageWrapper.style.transform = 'none';
    }
    document.querySelectorAll('.split-word').forEach((w) => {
      w.style.opacity = '1';
      w.style.transform = 'none';
    });
    document.querySelectorAll('.hero-flat-panel, .hero-hud-tags-container').forEach((el) => {
      el.classList.remove('is-hero-hidden');
      el.style.opacity = '1';
      el.style.transform = 'none';
      el.style.clipPath = 'none';
    });

    // Hide prelude and frame canvas so page starts directly on the hero at scroll 0
    const preludeSec = document.querySelector('.section-prelude');
    if (preludeSec) {
      preludeSec.style.display = 'none';
    }
    const canvasWrapper = document.querySelector('.cinematic-canvas-wrapper');
    if (canvasWrapper) {
      canvasWrapper.style.display = 'none';
    }

    window.scrollTo(0, 0);
    const lenis = initLenisScroll();
    if (lenis) {
      lenis.scrollTo(0, { immediate: true });
      lenis.start();
    }

    try {
      sessionStorage.removeItem('campuscode_hero_entered');
    } catch (e) {}
    initHeroSceneReveal();
    return;
  }

  // Lock scrolling completely during the intro
  document.body.classList.add('opening-locked');
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';

  const lenis = initLenisScroll();
  if (lenis) {
    lenis.stop();
    lenis.scrollTo(0, { immediate: true });
  }
  window.scrollTo(0, 0);

  // Plain comment: Prevents page displacement during intro while keeping navbar interactive
  const preventScrollDuringIntro = (e) => {
    if (e.target && e.target.closest && e.target.closest('.site-navbar')) {
      return;
    }
    e.preventDefault();
  };
  window.addEventListener('wheel', preventScrollDuringIntro, { passive: false });
  window.addEventListener('touchmove', preventScrollDuringIntro, { passive: false });

  // 1. Music starts automatically on page load (singleton Audio object, non-looping)
  startMusic(1500);

  let transitionTriggered = false;

  const triggerTransition = () => {
    if (transitionTriggered) return;
    transitionTriggered = true;

    window.removeEventListener('wheel', onScrollAttempt);
    window.removeEventListener('touchmove', onScrollAttempt);
    window.removeEventListener('keydown', onKeyAttempt);

    executeFirstScrollTransition(() => {
      // Intro exit timeline complete: hard wipe upward into the prelude at scroll 0
      window.removeEventListener('wheel', preventScrollDuringIntro, { passive: false });
      window.removeEventListener('touchmove', preventScrollDuringIntro, { passive: false });
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.classList.remove('opening-locked');

      const nav = document.querySelector('.site-navbar');
      if (nav) {
        nav.classList.remove('is-intro-hidden');
        nav.removeAttribute('inert');
        gsap.fromTo(nav, { y: -100, visibility: 'visible' }, { y: 0, duration: 0.6, ease: 'power3.out' });
        const strip = document.querySelector('.navbar-status-strip');
        if (strip) {
          gsap.fromTo(strip, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.4, delay: 0.2, ease: 'power2.out' });
        }
      }

      const currentLenis = initLenisScroll();
      if (currentLenis) {
        currentLenis.scrollTo(0, { immediate: true });
        currentLenis.start();
      }
      window.scrollTo(0, 0);
      ScrollTrigger.refresh();
    });
  };

  const onScrollAttempt = (e) => {
    // Detect intent to enter without allowing any scroll displacement
    if (Math.abs(e.deltaY) > 2 || e.type === 'touchmove') {
      triggerTransition();
    }
  };

  const onKeyAttempt = (e) => {
    if (['ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) {
      triggerTransition();
    }
  };

  const onLandingComplete = () => {
    window.addEventListener('wheel', onScrollAttempt, { passive: true });
    window.addEventListener('touchmove', onScrollAttempt, { passive: true });
    window.addEventListener('keydown', onKeyAttempt);

    if (scrollPrompt) {
      scrollPrompt.addEventListener('click', triggerTransition);
    }
  };

  // 2. Start 3D drop-and-bounce opening scene straight away
  initThreeOpeningScene({
    onLandingComplete,
    onShockwave: (level) => {
      spawnImpactShockwaveAndParticles(level);
    },
  });

  if (skipBtn) {
    skipBtn.addEventListener('click', skipToHero);
  }
}

// Plain comment: Manages page entrance states and handles bfcache reload without link interception
function initPageTransitions() {
  try {
    const container = document.querySelector('.page-wrapper, .auth-page-container, .dashboard-layout');
    if (container) {
      container.style.opacity = '1';
      container.style.visibility = 'visible';
    }
  } catch (err) {}

  // Plain comment: Reloads page if restored from browser bfcache so state initializes cleanly
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      window.location.reload();
    }
  });
}

/**
 * Initializes mobile navigation hamburger menu toggle.
 */
function initMobileMenu() {
  const toggleBtn = document.querySelector('.nav-mobile-toggle');
  const navMenu = document.querySelector('.nav-links');
  if (!toggleBtn || !navMenu) return;

  toggleBtn.addEventListener('click', () => {
    const isOpen = navMenu.classList.toggle('nav-open');
    toggleBtn.setAttribute('aria-expanded', isOpen);
    toggleBtn.textContent = isOpen ? '✕' : '☰';
  });

  const navItems = navMenu.querySelectorAll('button, a');
  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      navMenu.classList.remove('nav-open');
      toggleBtn.textContent = '☰';
    });
  });
}

/**
 * Generates a random 5-character alphanumeric captcha string.
 */
function generateRandomCaptcha() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Computes password strength and returns rating and percentage.
 */
function evaluatePasswordStrength(password) {
  if (!password || password.length < 4) {
    return { label: 'Weak', percent: 20, color: 'rgb(220, 50, 50)' };
  }
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) {
    return { label: 'Weak', percent: 25, color: 'rgb(220, 50, 50)' };
  } else if (score === 2) {
    return { label: 'Fair', percent: 50, color: 'rgb(200, 150, 30)' };
  } else if (score === 3) {
    return { label: 'Good', percent: 75, color: 'var(--cc-lime-dark)' };
  } else {
    return { label: 'Strong', percent: 100, color: 'var(--cc-lime-dark)' };
  }
}

/**
 * Extracts student initials from full name or email.
 */
function extractInitials(name) {
  if (!name || typeof name !== 'string') return 'BU';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (name.length >= 2) {
    return name.substring(0, 2).toUpperCase();
  }
  return 'BU';
}

// Plain comment: Sets up rotating tip, count-up stats, and safety net for auth pages
function initAuthCommon() {
  try {
    // Tip text
    const tipTextEl = document.querySelector('.auth-rotating-tip .tip-text');
    if (tipTextEl) {
      const tip = (siteContent && siteContent.auth && siteContent.auth.tipText) || 'Verify with your PIN to enter the arena.';
      tipTextEl.textContent = tip;
    }

    // Count-up stats row
    const statValEls = document.querySelectorAll('.auth-stat-val');
    statValEls.forEach((el) => {
      const targetVal = parseInt(el.getAttribute('data-val'), 10) || 0;
      const suffix = el.getAttribute('data-suffix') || '';
      let current = 0;
      const step = Math.max(1, Math.floor(targetVal / 30));
      const timer = setInterval(() => {
        current += step;
        if (current >= targetVal) {
          current = targetVal;
          clearInterval(timer);
        }
        el.textContent = `${current.toLocaleString()}${suffix}`;
      }, 30);
    });
  } catch (err) {}

  // Safety net on both /login and /register: after 1.5 seconds remove any wipe or overlay and force all content visible
  setTimeout(() => {
    try {
      const curtains = document.querySelectorAll('.auth-wipe-curtain');
      curtains.forEach((c) => {
        c.classList.remove('is-wiping');
        c.style.display = 'none';
      });
      const containers = document.querySelectorAll(
        '.auth-page-container, .auth-grid-split, .login-dark-panel, .login-white-panel, .register-dark-card, .register-lime-panel'
      );
      containers.forEach((el) => {
        el.style.opacity = '1';
        el.style.visibility = 'visible';
        el.style.transform = 'none';
      });
    } catch (err) {}
  }, 1500);
}

/**
 * Copies plain text to user clipboard with fallback support.
 */
function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const success = document.execCommand('copy');
      document.body.removeChild(ta);
      if (success) resolve();
      else reject(new Error('Copy failed'));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Masks an email address showing the first character and domain.
 */
function maskEmail(email) {
  if (!email || !email.includes('@')) return 'a***@campus.edu';
  const parts = email.trim().split('@');
  const user = parts[0] || 'a';
  const domain = parts[1] || 'campus.edu';
  const maskedUser = user.length > 1 ? `${user.charAt(0)}***` : `${user}***`;
  return `${maskedUser}@${domain}`;
}

/**
 * Generates a cryptographically secure 6-digit random PIN in memory.
 */
function generateRandom6DigitPin() {
  const arr = new Uint32Array(1);
  window.crypto.getRandomValues(arr);
  const num = 100000 + (arr[0] % 900000);
  return String(num);
}

/**
 * Manages 6-digit PIN input fields, navigation, copy toast, resend timer,
 * wrong-attempt lock countdown, and verification submission.
 */
function setupPinVerificationController(options) {
  const {
    container,
    getInitialPin,
    onPinChange,
    onSuccess,
    onChangeEmail,
  } = options;

  if (!container) return null;

  let currentPin = getInitialPin();
  let attemptsLeft = 3;
  let isLocked = false;
  let lockTimer = null;
  let resendTimer = null;
  let resendRemaining = 30;

  const digitInputs = Array.from(container.querySelectorAll('.pin-digit-box'));
  const submitBtn = container.querySelector('.btn-submit-pin');
  const resendBtn = container.querySelector('.btn-resend-pin');
  const changeEmailBtn = container.querySelector('.btn-change-email');
  const errorContainer = container.querySelector('.pin-error-container');
  const errorText = container.querySelector('.pin-error-text');
  const pinRow = container.querySelector('.pin-inputs-row');
  const pinForm = container.querySelector('.pin-verification-form');

  const toastEl = document.querySelector('.demo-inbox-toast');
  const toastPinEl = document.querySelector('.demo-inbox-pin');
  const copyBtn = document.querySelector('.btn-copy-pin');

  // Update demo toast
  const refreshToast = (pinVal) => {
    if (toastPinEl) toastPinEl.textContent = pinVal;
    if (toastEl) toastEl.style.display = 'block';
  };

  refreshToast(currentPin);

  // Copy button
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      copyTextToClipboard(currentPin)
        .then(() => {
          copyBtn.textContent = 'COPIED ✓';
          setTimeout(() => {
            copyBtn.textContent = 'COPY';
          }, 1500);
        })
        .catch(() => {
          copyBtn.textContent = 'COPIED ✓';
          setTimeout(() => {
            copyBtn.textContent = 'COPY';
          }, 1500);
        });
    });
  }

  // Check if all 6 digits are entered
  const checkInputsComplete = () => {
    const isComplete = digitInputs.every((box) => box.value.trim().length === 1);
    if (submitBtn) {
      submitBtn.disabled = !isComplete || isLocked;
    }
    return isComplete;
  };

  // Clear all digits
  const clearDigits = () => {
    digitInputs.forEach((box) => {
      box.value = '';
      box.classList.remove('is-invalid', 'is-success');
    });
    checkInputsComplete();
  };

  // Start 30s resend countdown
  const startResendCountdown = () => {
    if (resendTimer) clearInterval(resendTimer);
    resendRemaining = 30;
    if (resendBtn) {
      resendBtn.disabled = true;
      resendBtn.style.cursor = 'not-allowed';
      resendBtn.style.color = 'var(--text-dim)';
      resendBtn.textContent = `RESEND IN ${resendRemaining}s`;
    }
    resendTimer = setInterval(() => {
      resendRemaining -= 1;
      if (resendRemaining > 0) {
        if (resendBtn) resendBtn.textContent = `RESEND IN ${resendRemaining}s`;
      } else {
        clearInterval(resendTimer);
        resendTimer = null;
        if (resendBtn && !isLocked) {
          resendBtn.disabled = false;
          resendBtn.style.cursor = 'pointer';
          resendBtn.style.color = 'rgb(8, 8, 12)';
          resendBtn.textContent = 'RESEND PIN';
        }
      }
    }, 1000);
  };

  startResendCountdown();

  // Resend button click
  if (resendBtn) {
    resendBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (resendBtn.disabled || isLocked) return;
      currentPin = generateRandom6DigitPin();
      if (onPinChange) onPinChange(currentPin);
      refreshToast(currentPin);
      clearDigits();
      if (errorContainer) errorContainer.style.display = 'none';
      startResendCountdown();
      if (digitInputs[0]) digitInputs[0].focus();
    });
  }

  // Change Email click
  if (changeEmailBtn) {
    changeEmailBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (resendTimer) clearInterval(resendTimer);
      if (lockTimer) clearInterval(lockTimer);
      if (toastEl) toastEl.style.display = 'none';
      if (onChangeEmail) onChangeEmail();
    });
  }

  // Verify PIN submission
  const performVerification = () => {
    if (isLocked) return;
    const entered = digitInputs.map((box) => box.value.trim()).join('');
    if (entered.length < 6) return;

    if (entered === currentPin) {
      // Correct PIN
      if (errorContainer) errorContainer.style.display = 'none';
      if (submitBtn) submitBtn.disabled = true;
      if (resendBtn) resendBtn.disabled = true;

      // Digits turn lime one by one
      digitInputs.forEach((box, idx) => {
        setTimeout(() => {
          box.classList.remove('is-invalid');
          box.classList.add('is-success');
        }, idx * 60);
      });

      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 420);
    } else {
      // Incorrect PIN
      attemptsLeft -= 1;
      if (pinRow) {
        pinRow.classList.add('has-error');
        setTimeout(() => {
          pinRow.classList.remove('has-error');
        }, 450);
      }
      digitInputs.forEach((box) => {
        box.classList.add('is-invalid');
        box.value = '';
      });
      checkInputsComplete();

      if (attemptsLeft === 2) {
        if (errorContainer && errorText) {
          errorContainer.style.display = 'block';
          errorText.textContent = 'INCORRECT PIN. 2 ATTEMPTS LEFT';
        }
        if (digitInputs[0]) digitInputs[0].focus();
      } else if (attemptsLeft === 1) {
        if (errorContainer && errorText) {
          errorContainer.style.display = 'block';
          errorText.textContent = 'INCORRECT PIN. 1 ATTEMPT LEFT';
        }
        if (digitInputs[0]) digitInputs[0].focus();
      } else {
        // Lock for 30s after 3 wrong attempts
        isLocked = true;
        digitInputs.forEach((box) => {
          box.disabled = true;
        });
        if (submitBtn) submitBtn.disabled = true;
        if (resendBtn) resendBtn.disabled = true;

        let lockSeconds = 30;
        if (errorContainer && errorText) {
          errorContainer.style.display = 'block';
          errorText.textContent = `TOO MANY ATTEMPTS. LOCKED FOR ${lockSeconds}s`;
        }

        lockTimer = setInterval(() => {
          lockSeconds -= 1;
          if (lockSeconds > 0) {
            if (errorText) errorText.textContent = `TOO MANY ATTEMPTS. LOCKED FOR ${lockSeconds}s`;
          } else {
            clearInterval(lockTimer);
            lockTimer = null;
            isLocked = false;
            attemptsLeft = 3;
            currentPin = generateRandom6DigitPin();
            if (onPinChange) onPinChange(currentPin);
            refreshToast(currentPin);
            digitInputs.forEach((box) => {
              box.disabled = false;
              box.classList.remove('is-invalid', 'is-success');
              box.value = '';
            });
            checkInputsComplete();
            if (errorText) {
              errorText.textContent = 'NEW PIN GENERATED. PLEASE TRY AGAIN.';
              setTimeout(() => {
                if (errorContainer) errorContainer.style.display = 'none';
              }, 2500);
            }
            if (digitInputs[0]) digitInputs[0].focus();
            startResendCountdown();
          }
        }, 1000);
      }
    }
  };

  // Wire up digit inputs
  digitInputs.forEach((box, index) => {
    // Input filtering and auto-advance
    box.addEventListener('input', () => {
      let val = box.value.replace(/[^0-9]/g, '');
      if (val.length > 1) {
        val = val.charAt(val.length - 1);
      }
      box.value = val;
      box.classList.remove('is-invalid');
      if (val.length === 1 && index < digitInputs.length - 1) {
        digitInputs[index + 1].focus();
      }
      checkInputsComplete();
    });

    // Keydown navigation
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace') {
        if (box.value === '' && index > 0) {
          e.preventDefault();
          digitInputs[index - 1].value = '';
          digitInputs[index - 1].classList.remove('is-invalid');
          digitInputs[index - 1].focus();
          checkInputsComplete();
        } else if (box.value !== '') {
          box.value = '';
          checkInputsComplete();
        }
      } else if (e.key === 'ArrowLeft' && index > 0) {
        e.preventDefault();
        digitInputs[index - 1].focus();
      } else if (e.key === 'ArrowRight' && index < digitInputs.length - 1) {
        e.preventDefault();
        digitInputs[index + 1].focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        clearDigits();
        if (digitInputs[0]) digitInputs[0].focus();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (checkInputsComplete() && !isLocked) {
          performVerification();
        }
      }
    });

    // Paste handling
    box.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text') || '';
      const digits = text.replace(/[^0-9]/g, '').slice(0, 6);
      if (digits.length > 0) {
        digits.split('').forEach((d, i) => {
          if (digitInputs[i]) {
            digitInputs[i].value = d;
            digitInputs[i].classList.remove('is-invalid');
          }
        });
        const focusIdx = Math.min(digits.length, digitInputs.length - 1);
        if (digitInputs[focusIdx]) digitInputs[focusIdx].focus();
        checkInputsComplete();
      }
    });
  });

  // Form submit event prevention and trigger
  if (pinForm) {
    pinForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (checkInputsComplete() && !isLocked) {
        performVerification();
      }
    });
  }

  return {
    focusFirst: () => {
      if (digitInputs[0]) digitInputs[0].focus();
    },
    reset: () => {
      clearDigits();
      if (errorContainer) errorContainer.style.display = 'none';
      refreshToast(currentPin);
      startResendCountdown();
    },
    setPin: (p) => {
      currentPin = p;
      refreshToast(p);
    },
  };
}

/**
 * Launches success confetti particles inside a container.
 */
function launchAuthConfetti(container) {
  if (!container) return;
  container.innerHTML = '';
  container.classList.add('is-active');
  const colors = [
    'rgb(168, 230, 46)',
    'rgb(255, 255, 255)',
    'rgb(8, 8, 12)',
    'rgb(118, 101, 255)',
  ];
  for (let i = 0; i < 24; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-particle';
    const dx = `${(Math.random() - 0.5) * 360}px`;
    const dy = `${(Math.random() - 0.5) * 360}px`;
    const rot = `${(Math.random() - 0.5) * 720}deg`;
    p.style.setProperty('--dx', dx);
    p.style.setProperty('--dy', dy);
    p.style.setProperty('--rot', rot);
    p.style.left = '50%';
    p.style.top = '50%';
    p.style.background = colors[i % colors.length];
    container.appendChild(p);
  }
}

// Plain comment: Generates and draws a 5-character verification code onto a canvas with random rotation and noise
function setupCaptchaComponent({ canvas, input, refreshBtn, helpBtn }) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  const charset = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let currentCode = '';

  const generateCode = () => {
    const randomArray = new Uint32Array(5);
    window.crypto.getRandomValues(randomArray);
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += charset[randomArray[i] % charset.length];
    }
    return code;
  };

  const drawCode = () => {
    currentCode = generateCode();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background: flat white
    ctx.fillStyle = 'rgb(255, 255, 255)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Flat noise lines (near-black and lime)
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = i % 2 === 0 ? 'rgb(182, 229, 79)' : 'rgb(11, 11, 18)';
      ctx.stroke();
    }

    // Flat noise dots
    for (let i = 0; i < 28; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0 ? 'rgb(182, 229, 79)' : 'rgb(11, 11, 18)';
      ctx.fill();
    }

    // Draw characters with random rotation and offset
    ctx.font = 'bold 30px monospace';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < currentCode.length; i++) {
      const char = currentCode[i];
      const charX = 22 + i * 32 + (Math.random() * 4 - 2);
      const charY = 32 + (Math.random() * 6 - 3);
      const rot = (Math.random() * 26 - 13) * (Math.PI / 180);

      ctx.save();
      ctx.translate(charX, charY);
      ctx.rotate(rot);
      ctx.fillStyle = 'rgb(11, 11, 18)';
      ctx.fillText(char, -10, 0);
      ctx.restore();
    }

    if (input) {
      input.value = '';
      const wrap = input.closest('.form-input-wrap');
      if (wrap) wrap.classList.remove('has-error', 'has-success');
    }
  };

  drawCode();

  if (refreshBtn) {
    refreshBtn.addEventListener('click', (e) => {
      e.preventDefault();
      drawCode();
      if (input) input.focus();
    });
  }

  if (helpBtn) {
    helpBtn.addEventListener('click', (e) => {
      e.preventDefault();
      drawCode();
      if (input) input.focus();
    });
  }

  return {
    getCode: () => currentCode,
    refresh: drawCode,
    validate: (userVal) => {
      const trimmed = (userVal || '').trim().toUpperCase();
      if (!trimmed) {
        return { valid: false, error: 'ENTER THE CODE' };
      }
      if (trimmed !== currentCode) {
        return { valid: false, error: 'CODE DOES NOT MATCH' };
      }
      return { valid: true };
    },
  };
}

// Plain comment: Shakes an input field and shows error outline
function shakeInput(inputEl) {
  if (!inputEl) return;
  const wrap = inputEl.closest('.form-input-wrap');
  if (wrap) {
    wrap.classList.add('has-error');
    setTimeout(() => wrap.classList.remove('has-error'), 450);
  }
}

// Plain comment: Initializes Login page with dark route theme, bus track animation, verification code and PIN flow
function initLoginPage() {
  const step1Stage = document.querySelector('.login-step-1');
  const step2Stage = document.querySelector('.login-step-2');
  if (!step1Stage || !step2Stage) return;

  initAuthCommon();

  const loginForm = document.querySelector('.login-form-step1');
  const inputEmail = document.querySelector('.login-input-email');
  const inputPassword = document.querySelector('.login-input-password');
  const btnTogglePass = document.querySelector('.btn-toggle-password');
  const errorContainer = document.querySelector('.login-error-container');
  const errorText = document.querySelector('.login-error-text');
  const btnSubmit = document.querySelector('.btn-submit-login-step1');
  const btnLabel = btnSubmit ? btnSubmit.querySelector('.btn-label-text') : null;
  const loadingSquares = btnSubmit ? btnSubmit.querySelector('.btn-loading-squares') : null;
  const confettiStage = document.querySelector('.auth-confetti-stage');
  const wipeCurtain = document.querySelector('.auth-wipe-curtain');
  const maskedEmailDisplay = document.querySelector('.masked-email-display');
  const toastEl = document.querySelector('.demo-inbox-toast');

  // Captcha elements
  const captchaCanvas = document.querySelector('.login-captcha-block .auth-captcha-canvas');
  const inputCaptcha = document.querySelector('.login-input-captcha');
  const btnRefreshCaptcha = document.querySelector('.login-captcha-block .btn-refresh-captcha');
  const btnCaptchaHelp = document.querySelector('.login-captcha-block .btn-captcha-help-link');

  // Bus Track elements
  const busTrack = document.querySelector('.login-bus-track');
  const busWrap = document.querySelector('.bus-track-vehicle-wrap');
  const busProgressFill = document.querySelector('.bus-track-progress-fill');
  const busStatus = document.querySelector('.bus-track-status');
  const busWheels = document.querySelectorAll('.bus-wheel');
  const busSmoke = document.querySelector('.bus-smoke-puffs');
  const stationFlag = document.querySelector('.station-flag');

  let activePin = '';
  let pinController = null;
  let isBusDriving = false;

  const captchaController = setupCaptchaComponent({
    canvas: captchaCanvas,
    input: inputCaptcha,
    refreshBtn: btnRefreshCaptcha,
    helpBtn: btnCaptchaHelp,
  });

  // Show/Hide password toggle
  if (btnTogglePass && inputPassword) {
    btnTogglePass.addEventListener('click', () => {
      const isPass = inputPassword.getAttribute('type') === 'password';
      inputPassword.setAttribute('type', isPass ? 'text' : 'password');
    });
  }

  // Real-time inline feedback
  if (inputEmail) {
    inputEmail.addEventListener('input', () => {
      const wrap = inputEmail.closest('.form-input-wrap');
      const val = inputEmail.value.trim();
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
      if (wrap) {
        wrap.classList.toggle('has-success', valid);
        wrap.classList.remove('has-error');
      }
    });
  }

  if (inputPassword) {
    inputPassword.addEventListener('input', () => {
      const wrap = inputPassword.closest('.form-input-wrap');
      const valid = inputPassword.value.length >= 8;
      if (wrap) {
        wrap.classList.toggle('has-success', valid);
        wrap.classList.remove('has-error');
      }
    });
  }

  if (inputCaptcha) {
    inputCaptcha.addEventListener('input', () => {
      const wrap = inputCaptcha.closest('.form-input-wrap');
      if (wrap) {
        wrap.classList.toggle('has-success', inputCaptcha.value.trim().length === 5);
        wrap.classList.remove('has-error');
      }
    });
  }

  // Form submit for Step 1
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (isBusDriving) return;

      const emailVal = inputEmail ? inputEmail.value.trim() : '';
      const passVal = inputPassword ? inputPassword.value : '';
      const captchaVal = inputCaptcha ? inputCaptcha.value : '';

      const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal);
      const isPassValid = passVal.length >= 8;
      const captchaCheck = captchaController ? captchaController.validate(captchaVal) : { valid: true };

      if (!isEmailValid || !isPassValid || !captchaCheck.valid) {
        if (errorContainer && errorText) {
          errorContainer.style.display = 'block';
          if (!isEmailValid) {
            errorText.textContent = 'PLEASE ENTER A VALID UNIVERSITY EMAIL ADDRESS.';
            shakeInput(inputEmail);
          } else if (!isPassValid) {
            errorText.textContent = 'PASSWORD MUST BE AT LEAST 8 CHARACTERS LONG.';
            shakeInput(inputPassword);
          } else {
            errorText.textContent = captchaCheck.error;
            shakeInput(inputCaptcha);
            if (captchaController) captchaController.refresh();
          }
        }

        // Bus shakes in place, status shows CONNECTION FAILED on lime, then returns to READY
        if (busTrack && busStatus) {
          busTrack.classList.add('is-shaking');
          setTimeout(() => busTrack.classList.remove('is-shaking'), 450);
          busStatus.textContent = 'CONNECTION FAILED';
          busStatus.classList.add('is-failed');
          setTimeout(() => {
            busStatus.textContent = 'READY';
            busStatus.classList.remove('is-failed');
          }, 1500);
        }
        return;
      }

      if (errorContainer) errorContainer.style.display = 'none';

      // Store derived username from email prefix in sessionStorage
      try {
        const rawPrefix = emailVal.split('@')[0].replace(/[._-]/g, ' ');
        const formatted = rawPrefix
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
        sessionStorage.setItem('campuscode_user_name', formatted || 'ALEX');
      } catch (err) {}

      // Valid: Bus drives across track from left to right
      isBusDriving = true;
      if (btnSubmit) btnSubmit.disabled = true;
      if (btnLabel) btnLabel.textContent = 'LOGIN';

      if (busStatus) {
        busStatus.textContent = 'CONNECTING...';
        busStatus.classList.remove('is-failed');
      }
      if (busWheels) {
        busWheels.forEach((w) => w.classList.add('is-spinning'));
      }
      if (busSmoke) {
        busSmoke.style.opacity = '1';
      }

      // Generate in-memory PIN
      activePin = generateRandom6DigitPin();

      const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const onBusArrived = () => {
        isBusDriving = false;
        if (busStatus) {
          busStatus.textContent = 'CONNECTED ✓';
          busStatus.classList.add('is-connected');
        }
        if (stationFlag) {
          gsap.fromTo(stationFlag, { scale: 1.4 }, { scale: 1, duration: 0.35, ease: 'bounce.out' });
        }
        if (busWheels) {
          busWheels.forEach((w) => w.classList.remove('is-spinning'));
        }
        if (busSmoke) {
          busSmoke.style.opacity = '0';
        }

        setTimeout(() => {
          // Update masked email in Step 2
          if (maskedEmailDisplay) {
            maskedEmailDisplay.textContent = maskEmail(emailVal);
          }

          // Hard horizontal wipe transition to Step 2
          if (wipeCurtain) {
            wipeCurtain.classList.add('is-wiping');
            setTimeout(() => {
              step1Stage.style.display = 'none';
              step2Stage.style.display = 'block';

              if (!pinController) {
                pinController = setupPinVerificationController({
                  container: step2Stage,
                  getInitialPin: () => activePin,
                  onPinChange: (newPin) => {
                    activePin = newPin;
                  },
                  onSuccess: () => {
                    try {
                      sessionStorage.setItem('campuscode_logged_in', 'true');
                    } catch (err) {}
                    launchAuthConfetti(confettiStage);
                    if (toastEl) toastEl.style.display = 'none';
                    setTimeout(() => {
                      if (wipeCurtain) wipeCurtain.classList.add('is-wiping');
                      setTimeout(() => {
                        window.location.href = 'dashboard.html';
                      }, 350);
                    }, 600);
                  },
                  onChangeEmail: () => {
                    step2Stage.style.display = 'none';
                    step1Stage.style.display = 'block';
                    if (busWrap) gsap.set(busWrap, { x: 0 });
                    if (busProgressFill) gsap.set(busProgressFill, { width: '0%' });
                    if (busStatus) {
                      busStatus.textContent = 'READY';
                      busStatus.classList.remove('is-connected', 'is-failed');
                    }
                    if (btnSubmit) btnSubmit.disabled = false;
                    if (btnLabel) btnLabel.textContent = 'LOGIN';
                    if (captchaController) captchaController.refresh();
                    if (inputEmail) inputEmail.focus();
                  },
                });
              } else {
                pinController.setPin(activePin);
                pinController.reset();
              }

              if (pinController) pinController.focusFirst();

              setTimeout(() => {
                wipeCurtain.classList.remove('is-wiping');
                if (btnSubmit) btnSubmit.disabled = false;
                if (btnLabel) btnLabel.textContent = 'LOGIN';
              }, 250);
            }, 300);
          } else {
            step1Stage.style.display = 'none';
            step2Stage.style.display = 'block';
            if (pinController) pinController.focusFirst();
          }
        }, 400);
      };

      if (prefersReduced || !busWrap || !busTrack) {
        setTimeout(onBusArrived, 400);
      } else {
        const trackWidth = busTrack.offsetWidth;
        const targetX = Math.max(120, trackWidth - 110);

        gsap.to(busWrap, {
          x: targetX,
          duration: 2.0,
          ease: 'power2.inOut',
          onComplete: onBusArrived,
        });

        if (busProgressFill) {
          gsap.to(busProgressFill, {
            width: '100%',
            duration: 2.0,
            ease: 'power2.inOut',
          });
        }
      }
    });
  }
}

// Plain comment: Initializes Register page with mirrored lime ID card layout, live card preview, 4-segment step bar, verification code, and PIN
function initRegisterPage() {
  const step1Stage = document.querySelector('.register-step-1');
  const step2Stage = document.querySelector('.register-step-2');
  const welcomeStage = document.querySelector('.register-step-welcome');
  if (!step1Stage || !step2Stage) return;

  initAuthCommon();

  const regForm = document.querySelector('.register-form-step1');
  const inputName = document.querySelector('.register-input-name');
  const inputEmail = document.querySelector('.register-input-email');
  const inputPassword = document.querySelector('.register-input-password');
  const inputConfirm = document.querySelector('.register-input-confirm');
  const checkboxAge = document.querySelector('.register-checkbox-age');
  const passLabel = document.querySelector('.register-pass-label');
  const btnTogglePass = document.querySelector('.btn-toggle-reg-pass');
  const segments = document.querySelectorAll('.strength-segment');
  const errorContainer = document.querySelector('.register-error-container');
  const errorText = document.querySelector('.register-error-text');
  const btnSubmit = document.querySelector('.btn-submit-reg-step1');
  const btnLabel = btnSubmit ? btnSubmit.querySelector('.btn-label-text') : null;
  const loadingSquares = btnSubmit ? btnSubmit.querySelector('.btn-loading-squares') : null;
  const confettiStage = document.querySelector('.auth-confetti-stage');
  const wipeCurtain = document.querySelector('.auth-wipe-curtain');
  const maskedEmailDisplay = step2Stage.querySelector('.masked-email-display');
  const btnGotoDashboard = document.querySelector('.btn-goto-dashboard');
  const toastEl = document.querySelector('.demo-inbox-toast');

  // Captcha elements
  const captchaCanvas = document.querySelector('.register-captcha-block .auth-captcha-canvas');
  const inputCaptcha = document.querySelector('.register-input-captcha');
  const btnRefreshCaptcha = document.querySelector('.register-captcha-block .btn-refresh-captcha');
  const btnCaptchaHelp = document.querySelector('.register-captcha-block .btn-captcha-help-link');

  // Live Student ID Card elements
  const idCard = document.querySelector('.student-id-card');
  const idNameVal = document.querySelector('.id-card-name-val');
  const idInitials = document.querySelector('.id-card-initials');
  const idEmailDomain = document.querySelector('.id-card-email-domain');
  const idCardStamp = document.querySelector('.id-card-stamp');
  const limePanel = document.querySelector('.register-lime-panel');

  let activePin = '';
  let pinController = null;

  const captchaController = setupCaptchaComponent({
    canvas: captchaCanvas,
    input: inputCaptcha,
    refreshBtn: btnRefreshCaptcha,
    helpBtn: btnCaptchaHelp,
  });

  // Student ID card subtle 3deg tilt following mouse inside lime panel
  if (limePanel && idCard) {
    limePanel.addEventListener('mousemove', (e) => {
      const rect = limePanel.getBoundingClientRect();
      const normX = (e.clientX - rect.left) / rect.width - 0.5;
      const normY = (e.clientY - rect.top) / rect.height - 0.5;
      idCard.style.transform = `rotate(${3 + normX * 4}deg) translateY(${normY * 6}px)`;
    });
    limePanel.addEventListener('mouseleave', () => {
      idCard.style.transform = 'rotate(3deg)';
    });
  }

  // Toggle password visibility
  if (btnTogglePass && inputPassword && inputConfirm) {
    btnTogglePass.addEventListener('click', () => {
      const isPass = inputPassword.getAttribute('type') === 'password';
      inputPassword.setAttribute('type', isPass ? 'text' : 'password');
      inputConfirm.setAttribute('type', isPass ? 'text' : 'password');
    });
  }

  // 4-Segment Strength Meter
  if (inputPassword) {
    inputPassword.addEventListener('input', () => {
      const val = inputPassword.value;
      let score = 0;
      if (val.length >= 8) score += 1;
      if (/[A-Z]/.test(val)) score += 1;
      if (/[0-9]/.test(val)) score += 1;
      if (/[^A-Za-z0-9]/.test(val)) score += 1;

      segments.forEach((seg, idx) => {
        seg.className = 'strength-segment';
        if (idx < score) {
          seg.classList.add('is-active', `lvl-${score}`);
        }
      });

      const labels = ['Weak', 'Fair', 'Good', 'Unbreakable'];
      if (passLabel) {
        passLabel.textContent = val.length === 0 ? 'Weak' : labels[Math.max(0, score - 1)];
      }

      const wrap = inputPassword.closest('.form-input-wrap');
      if (wrap) {
        wrap.classList.toggle('has-success', score >= 2);
        wrap.classList.remove('has-error');
      }
    });
  }

  // Real-time updates to live student ID card
  if (inputName) {
    inputName.addEventListener('input', () => {
      const val = inputName.value.trim();
      if (idNameVal) idNameVal.textContent = val || 'STUDENT BUILDER';
      if (idInitials) {
        const parts = val.split(' ').filter(Boolean);
        if (parts.length >= 2) {
          idInitials.textContent = (parts[0][0] + parts[1][0]).toUpperCase();
        } else if (parts.length === 1 && parts[0].length >= 1) {
          idInitials.textContent = parts[0].substring(0, 2).toUpperCase();
        } else {
          idInitials.textContent = 'CC';
        }
      }
      const wrap = inputName.closest('.form-input-wrap');
      if (wrap) {
        wrap.classList.toggle('has-success', val.length >= 2);
        wrap.classList.remove('has-error');
      }
    });
  }

  if (inputEmail) {
    inputEmail.addEventListener('input', () => {
      const val = inputEmail.value.trim();
      const domain = val.includes('@') ? '@' + val.split('@')[1] : '@campus.edu';
      if (idEmailDomain) idEmailDomain.textContent = domain;
      const wrap = inputEmail.closest('.form-input-wrap');
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
      if (wrap) {
        wrap.classList.toggle('has-success', valid);
        wrap.classList.remove('has-error');
      }
    });
  }

  if (inputConfirm && inputPassword) {
    inputConfirm.addEventListener('input', () => {
      const wrap = inputConfirm.closest('.form-input-wrap');
      const match = inputConfirm.value === inputPassword.value && inputConfirm.value.length >= 8;
      if (wrap) {
        wrap.classList.toggle('has-success', match);
        wrap.classList.remove('has-error');
      }
    });
  }

  if (inputCaptcha) {
    inputCaptcha.addEventListener('input', () => {
      const wrap = inputCaptcha.closest('.form-input-wrap');
      if (wrap) {
        wrap.classList.toggle('has-success', inputCaptcha.value.trim().length === 5);
        wrap.classList.remove('has-error');
      }
    });
  }

  // Form submit for Step 1
  if (regForm) {
    regForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameVal = inputName ? inputName.value.trim() : '';
      const emailVal = inputEmail ? inputEmail.value.trim() : '';
      const passVal = inputPassword ? inputPassword.value : '';
      const confirmVal = inputConfirm ? inputConfirm.value : '';
      const ageChecked = checkboxAge ? checkboxAge.checked : false;
      const captchaVal = inputCaptcha ? inputCaptcha.value : '';

      const showError = (msg, inputEl) => {
        if (errorContainer && errorText) {
          errorContainer.style.display = 'block';
          errorText.textContent = msg;
        }
        if (inputEl) {
          shakeInput(inputEl);
        }
      };

      if (!nameVal || nameVal.length < 2) {
        showError('PLEASE ENTER YOUR FULL NAME.', inputName);
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
        showError('PLEASE ENTER A VALID UNIVERSITY EMAIL.', inputEmail);
        return;
      }
      if (passVal.length < 8) {
        showError('PASSWORD MUST BE AT LEAST 8 CHARACTERS.', inputPassword);
        return;
      }
      if (passVal !== confirmVal) {
        showError('PASSWORDS DO NOT MATCH.', inputConfirm);
        return;
      }
      if (!ageChecked) {
        showError('YOU MUST CONFIRM YOU ARE 18 YEARS OF AGE OR OLDER.', null);
        return;
      }

      const captchaCheck = captchaController ? captchaController.validate(captchaVal) : { valid: true };
      if (!captchaCheck.valid) {
        showError(captchaCheck.error, inputCaptcha);
        if (captchaController) captchaController.refresh();
        return;
      }

      if (errorContainer) errorContainer.style.display = 'none';

      // Store user name
      try {
        sessionStorage.setItem('campuscode_user_name', nameVal);
      } catch (err) {}

      // Loading state on button (~600ms) with three pulsing squares
      if (btnSubmit) btnSubmit.disabled = true;
      if (btnLabel) btnLabel.textContent = 'CREATING ACCOUNT...';
      if (loadingSquares) loadingSquares.style.display = 'inline-flex';

      // Generate in-memory PIN
      activePin = generateRandom6DigitPin();

      setTimeout(() => {
        // Update masked email in Step 2
        if (maskedEmailDisplay) {
          maskedEmailDisplay.textContent = maskEmail(emailVal);
        }

        // Hard horizontal wipe transition to Step 2
        if (wipeCurtain) {
          wipeCurtain.classList.add('is-wiping');
          setTimeout(() => {
            step1Stage.style.display = 'none';
            step2Stage.style.display = 'block';

            if (!pinController) {
              pinController = setupPinVerificationController({
                container: step2Stage,
                getInitialPin: () => activePin,
                onPinChange: (newPin) => {
                  activePin = newPin;
                },
                onSuccess: () => {
                  try {
                    sessionStorage.setItem('campuscode_logged_in', 'true');
                  } catch (err) {}

                  // Slam VERIFIED stamp onto Student ID Card
                  if (idCardStamp) {
                    idCardStamp.classList.add('is-stamped');
                  }

                  launchAuthConfetti(confettiStage);
                  if (toastEl) toastEl.style.display = 'none';

                  // Slide to Welcome step
                  setTimeout(() => {
                    step2Stage.style.display = 'none';
                    if (welcomeStage) welcomeStage.style.display = 'block';
                  }, 500);
                },
                onChangeEmail: () => {
                  step2Stage.style.display = 'none';
                  step1Stage.style.display = 'block';
                  if (btnSubmit) btnSubmit.disabled = false;
                  if (btnLabel) btnLabel.textContent = 'CREATE ACCOUNT →';
                  if (loadingSquares) loadingSquares.style.display = 'none';
                  if (captchaController) captchaController.refresh();
                  if (inputEmail) inputEmail.focus();
                },
              });
            } else {
              pinController.setPin(activePin);
              pinController.reset();
            }

            if (pinController) pinController.focusFirst();

            setTimeout(() => {
              wipeCurtain.classList.remove('is-wiping');
              if (btnSubmit) btnSubmit.disabled = false;
              if (btnLabel) btnLabel.textContent = 'CREATE ACCOUNT →';
              if (loadingSquares) loadingSquares.style.display = 'none';
            }, 250);
          }, 300);
        } else {
          step1Stage.style.display = 'none';
          step2Stage.style.display = 'block';
          if (pinController) pinController.focusFirst();
        }
      }, 600);
    });
  }

  // Welcome Step button to dashboard
  if (btnGotoDashboard) {
    btnGotoDashboard.addEventListener('click', (e) => {
      e.preventDefault();
      if (wipeCurtain) {
        wipeCurtain.classList.add('is-wiping');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 350);
      } else {
        window.location.href = 'dashboard.html';
      }
    });
  }

  if (welcomeStage) {
    welcomeStage.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (btnGotoDashboard) btnGotoDashboard.click();
      }
    });
  }
}

/**
 * Initializes Student Dashboard features:
 * Displays user name from sessionStorage (fallback "BUILDER"),
 * runs count-up animation on stat metric cards, handles mobile & collapsible sidebar,
 * live countdown digit blocks, SVG progress ring, activity heatmap with tooltips,
 * quick actions, notification dropdown with mark-all-read, and command palette (Ctrl+K / Cmd+K).
 */
function initDashboardPage() {
  const dashboardMain = document.querySelector('.dashboard-main-area');
  if (!dashboardMain) return;

  // 1. Retrieve name from sessionStorage
  let userName = 'BUILDER';
  try {
    const stored = sessionStorage.getItem('campuscode_user_name');
    if (stored && stored.trim().length > 0) {
      userName = stored.trim();
    }
  } catch (err) {}

  const initials = extractInitials(userName);

  // Update greeting and avatar elements
  const welcomeEl = document.querySelector('.dashboard-welcome-name');
  if (welcomeEl) welcomeEl.textContent = userName.toUpperCase();

  const nameDisplays = document.querySelectorAll('.dashboard-user-name-display');
  nameDisplays.forEach((el) => {
    el.textContent = userName.toUpperCase();
  });

  const initialsEls = document.querySelectorAll('.dashboard-user-initials');
  initialsEls.forEach((el) => {
    el.textContent = initials;
  });

  // 2. Count-up animation for stat metric cards
  const statNums = document.querySelectorAll('.stat-metric-num');
  statNums.forEach((statEl) => {
    const target = parseFloat(statEl.getAttribute('data-count-to')) || 0;
    const obj = { val: 0 };
    gsap.to(obj, {
      val: target,
      duration: 1.4,
      ease: 'power2.out',
      onUpdate: () => {
        const intVal = Math.round(obj.val);
        statEl.textContent = intVal < 10 ? `0${intVal}` : String(intVal);
      },
    });
  });

  // 3. Staggered entry animation on first load
  const animatedCards = document.querySelectorAll('.dashboard-hero-card, .dashboard-quick-actions-row, .stat-metric-card, .dashboard-panel-card');
  if (animatedCards.length > 0) {
    gsap.fromTo(
      animatedCards,
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, stagger: 0.08, ease: 'power3.out' }
    );
  }

  // 4. Mobile sidebar drawer
  const menuBtn = document.querySelector('.btn-dashboard-menu');
  const closeBtn = document.querySelector('.dashboard-sidebar-close');
  const sidebar = document.querySelector('.dashboard-sidebar');

  if (menuBtn && sidebar) {
    menuBtn.addEventListener('click', () => {
      sidebar.classList.add('sidebar-mobile-open');
    });
  }

  if (closeBtn && sidebar) {
    closeBtn.addEventListener('click', () => {
      sidebar.classList.remove('sidebar-mobile-open');
    });
  }

  // 5. Collapsible sidebar (icons only) with localStorage memory
  const collapseBtn = document.querySelector('.btn-sidebar-collapse');
  if (collapseBtn && sidebar) {
    let isCollapsed = false;
    try {
      isCollapsed = localStorage.getItem('cc_sidebar_collapsed') === 'true';
      if (isCollapsed) {
        sidebar.classList.add('sidebar-collapsed');
        collapseBtn.textContent = '▶';
      }
    } catch (e) {}

    collapseBtn.addEventListener('click', () => {
      isCollapsed = !isCollapsed;
      sidebar.classList.toggle('sidebar-collapsed', isCollapsed);
      collapseBtn.textContent = isCollapsed ? '▶' : '◀';
      try {
        localStorage.setItem('cc_sidebar_collapsed', String(isCollapsed));
      } catch (e) {}
    });
  }

  // 6. Interactive refresh button feedback
  const refreshBtn = document.querySelector('.btn-dashboard-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      gsap.fromTo(refreshBtn, { rotate: 0 }, { rotate: 360, duration: 0.6, ease: 'power2.out' });
      showDashboardToast('Dashboard state synchronized.');
    });
  }

  // 7. Live countdown with flat digit blocks (DAYS HRS MIN SEC)
  const daysEl = document.querySelector('.countdown-days');
  const hrsEl = document.querySelector('.countdown-hrs');
  const minEl = document.querySelector('.countdown-min');
  const secEl = document.querySelector('.countdown-sec');

  if (daysEl && hrsEl && minEl && secEl) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);
    targetDate.setHours(targetDate.getHours() + 14);

    const updateCountdown = () => {
      const now = new Date();
      const diff = Math.max(0, targetDate.getTime() - now.getTime());
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / (1000 * 60)) % 60);
      const s = Math.floor((diff / 1000) % 60);

      daysEl.textContent = d < 10 ? `0${d}` : String(d);
      hrsEl.textContent = h < 10 ? `0${h}` : String(h);
      minEl.textContent = m < 10 ? `0${m}` : String(m);
      secEl.textContent = s < 10 ? `0${s}` : String(s);
    };

    updateCountdown();
    setInterval(updateCountdown, 1000);
  }

  // 8. Activity Heatmap (7 by 12 flat squares)
  const heatmapGrid = document.querySelector('.activity-heatmap-grid');
  const heatmapTooltip = document.querySelector('.heatmap-tooltip');
  if (heatmapGrid) {
    heatmapGrid.innerHTML = '';
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const totalCells = 7 * 12; // 84 cells

    for (let i = 0; i < totalCells; i++) {
      const cell = document.createElement('div');
      // Deterministic levels: 0 (white), 1 (light lime), 2 (solid lime), 3 (near-black)
      const level = (i * 7 + 3) % 4;
      cell.className = `heatmap-cell level-${level}`;
      const weekIdx = Math.floor(i / 7) + 1;
      const dayIdx = i % 7;
      const commits = level === 0 ? 0 : level === 1 ? 2 : level === 2 ? 5 : 9;

      cell.addEventListener('mouseenter', (e) => {
        if (!heatmapTooltip) return;
        heatmapTooltip.textContent = `Week ${weekIdx}, ${dayNames[dayIdx]}: ${commits} submissions`;
        heatmapTooltip.classList.remove('is-hidden');
        const rect = cell.getBoundingClientRect();
        heatmapTooltip.style.left = `${rect.left + rect.width / 2 - 60}px`;
        heatmapTooltip.style.top = `${rect.top - 36}px`;
      });

      cell.addEventListener('mouseleave', () => {
        if (heatmapTooltip) heatmapTooltip.classList.add('is-hidden');
      });

      heatmapGrid.appendChild(cell);
    }
  }

  // 9. Quick Actions row feedback
  const quickBtns = document.querySelectorAll('.quick-action-btn');
  const toastEl = document.querySelector('.dashboard-toast');

  function showDashboardToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.remove('is-hidden');
    clearTimeout(toastEl.__timer);
    toastEl.__timer = setTimeout(() => {
      toastEl.classList.add('is-hidden');
    }, 2400);
  }

  quickBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const label = btn.querySelector('.quick-action-label')?.textContent || 'Action';
      showDashboardToast(`${label} portal activated.`);
    });
  });

  // 10. Notification dropdown & Mark All Read
  const bellBtn = document.querySelector('.btn-notification-bell');
  const notifDropdown = document.querySelector('.notification-dropdown');
  const markReadBtn = document.querySelector('.btn-mark-all-read');
  const unreadBadge = document.querySelector('.unread-count-badge');
  const notifItems = document.querySelectorAll('.notif-dropdown-item');

  if (bellBtn && notifDropdown) {
    bellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !notifDropdown.classList.contains('is-closed');
      notifDropdown.classList.toggle('is-closed', isOpen);
      bellBtn.setAttribute('aria-expanded', String(!isOpen));
    });

    document.addEventListener('click', (e) => {
      if (!notifDropdown.contains(e.target) && e.target !== bellBtn) {
        notifDropdown.classList.add('is-closed');
        bellBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  if (markReadBtn) {
    markReadBtn.addEventListener('click', () => {
      if (unreadBadge) unreadBadge.style.display = 'none';
      notifItems.forEach((item) => {
        item.classList.remove('is-unread');
        item.classList.add('is-read');
      });
      showDashboardToast('All notifications marked as read.');
    });
  }

  // 11. Command Palette (Ctrl+K or Cmd+K)
  const paletteModal = document.querySelector('.dashboard-cmd-palette');
  const paletteTrigger = document.querySelector('.btn-cmd-palette-trigger');
  const paletteInput = document.querySelector('.palette-search-input');
  const paletteList = document.querySelector('.palette-results-list');
  const paletteBackdrop = document.querySelector('.palette-backdrop');

  if (paletteModal && paletteInput && paletteList) {
    const paletteItems = siteContent?.dashboard?.commandPalette?.items || [
      { title: 'Overview', category: 'Navigation', icon: '✦', href: 'dashboard.html' },
      { title: 'Events', category: 'Navigation', icon: '◈', href: 'dashboard.html' },
      { title: 'My Events', category: 'Navigation', icon: '◒', href: 'dashboard.html' },
      { title: 'HackMate AI', category: 'AI Tools', icon: '⚡', href: 'dashboard.html' },
      { title: 'IdeaCheck AI', category: 'AI Tools', icon: '◎', href: 'dashboard.html' },
      { title: 'Certificates', category: 'Credentials', icon: '★', href: 'dashboard.html' },
      { title: 'RuleBot AI', category: 'AI Tools', icon: '⚙', href: 'dashboard.html' },
      { title: 'Join Event', category: 'Quick Action', icon: '↗', action: 'action-join' },
      { title: 'Submit Project', category: 'Quick Action', icon: '⬆', action: 'action-submit' },
      { title: 'Find Teammates', category: 'Quick Action', icon: '👥', action: 'action-teammates' },
      { title: 'Download Certificate', category: 'Quick Action', icon: '📥', action: 'action-cert' },
    ];

    let selectedIndex = 0;
    let filteredItems = [...paletteItems];

    const renderPaletteItems = () => {
      paletteList.innerHTML = '';
      if (filteredItems.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'palette-result-item';
        empty.textContent = 'No matching pages or actions found';
        empty.style.color = 'var(--text-muted)';
        paletteList.appendChild(empty);
        return;
      }

      filteredItems.forEach((item, idx) => {
        const li = document.createElement('li');
        li.className = `palette-result-item ${idx === selectedIndex ? 'is-selected' : ''}`;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(idx === selectedIndex));

        li.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <span>${item.icon}</span>
            <span>${item.title}</span>
          </div>
          <small style="font-size: 10px; font-weight: 800; opacity: 0.6;">${item.category}</small>
        `;

        li.addEventListener('click', () => {
          executePaletteItem(item);
        });

        paletteList.appendChild(li);
      });
    };

    const executePaletteItem = (item) => {
      closePalette();
      if (item.href) {
        window.location.href = item.href;
      } else if (item.action) {
        showDashboardToast(`Executed: ${item.title}`);
      }
    };

    const openPalette = () => {
      paletteModal.classList.remove('is-palette-closed');
      paletteModal.setAttribute('aria-hidden', 'false');
      paletteInput.value = '';
      filteredItems = [...paletteItems];
      selectedIndex = 0;
      renderPaletteItems();
      paletteInput.focus();
    };

    const closePalette = () => {
      paletteModal.classList.add('is-palette-closed');
      paletteModal.setAttribute('aria-hidden', 'true');
    };

    if (paletteTrigger) {
      paletteTrigger.addEventListener('click', openPalette);
    }
    if (paletteBackdrop) {
      paletteBackdrop.addEventListener('click', closePalette);
    }

    paletteInput.addEventListener('input', () => {
      const query = paletteInput.value.trim().toLowerCase();
      filteredItems = paletteItems.filter((item) =>
        item.title.toLowerCase().includes(query) || item.category.toLowerCase().includes(query)
      );
      selectedIndex = 0;
      renderPaletteItems();
    });

    paletteInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (filteredItems.length > 0) {
          selectedIndex = (selectedIndex + 1) % filteredItems.length;
          renderPaletteItems();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (filteredItems.length > 0) {
          selectedIndex = (selectedIndex - 1 + filteredItems.length) % filteredItems.length;
          renderPaletteItems();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          executePaletteItem(filteredItems[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closePalette();
      }
    });

    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (paletteModal.classList.contains('is-palette-closed')) {
          openPalette();
        } else {
          closePalette();
        }
      } else if (e.key === 'Escape' && !paletteModal.classList.contains('is-palette-closed')) {
        closePalette();
      }
    });
  }
}

/**
 * Updates the live Chennai time in the navbar status strip every second.
 */
function initLiveStatusClock() {
  const clockEl = document.querySelector('.status-strip-clock');
  if (!clockEl) return;

  const updateClock = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    clockEl.textContent = `${timeStr} IST`;
  };

  updateClock();
  setInterval(updateClock, 1000);
}

/**
 * Tracks the current visible section and highlights the corresponding navbar link with a lime underline.
 */
function initActiveNavLinkTracking() {
  const navButtons = document.querySelectorAll('.nav-links button[data-target]');
  if (navButtons.length === 0) return;

  const sections = Array.from(navButtons).map((btn) => {
    const targetClass = btn.getAttribute('data-target');
    const el = document.querySelector(`.${targetClass}`);
    return { btn, el };
  }).filter((item) => item.el !== null);

  sections.forEach(({ btn, el }) => {
    ScrollTrigger.create({
      trigger: el,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) => {
        if (self.isActive) {
          navButtons.forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
        }
      },
    });
  });
}

/**
 * Handles the flat accessible modal for guides, rules, faq, support, terms, and privacy.
 */
/**
 * Accessible Modal with Escape key listener and Tab key focus trapping.
 */
function initAccessibleModal() {
  const modal = document.querySelector('.flat-accessible-modal');
  if (!modal) return;

  const openBtns = document.querySelectorAll('.btn-open-modal');
  const closeBtn = modal.querySelector('.modal-close-btn');
  const doneBtn = modal.querySelector('.modal-done-btn');
  const backdrop = modal.querySelector('.modal-backdrop');
  const titleEl = modal.querySelector('.modal-card-title');
  const subEl = modal.querySelector('.modal-card-sub');
  const bodyEl = modal.querySelector('.modal-card-body');
  let previouslyFocusedElement = null;

  const closeModal = () => {
    modal.classList.add('is-modal-closed');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
      previouslyFocusedElement.focus();
    }
  };

  const openModal = (key) => {
    previouslyFocusedElement = document.activeElement;
    const modalData = siteContent?.landing?.modals?.[key];
    if (modalData) {
      if (titleEl) titleEl.textContent = modalData.title;
      if (subEl) subEl.textContent = modalData.sub || '';
      if (bodyEl) bodyEl.textContent = modalData.content || modalData.body || '';
    } else {
      if (titleEl) titleEl.textContent = key.toUpperCase();
      if (bodyEl) bodyEl.textContent = `Information for ${key}`;
    }
    modal.classList.remove('is-modal-closed');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    if (closeBtn) closeBtn.focus();
  };

  openBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const modalKey = btn.getAttribute('data-modal');
      if (modalKey) openModal(modalKey);
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (doneBtn) doneBtn.addEventListener('click', closeModal);
  if (backdrop) backdrop.addEventListener('click', closeModal);

  // Focus trap on Tab / Shift+Tab and Escape to close
  window.addEventListener('keydown', (e) => {
    if (modal.classList.contains('is-modal-closed')) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
      return;
    }

    if (e.key === 'Tab') {
      const focusableEls = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusableEls.length === 0) return;
      const firstFocusable = focusableEls[0];
      const lastFocusable = focusableEls[focusableEls.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    }
  });
}

/**
 * Checks for any bounding box intersections in Section 03 (How It Works).
 */
export function checkHowItWorksOverlaps(step = 1) {
  const header = document.querySelector('.section-how .section-header-strip');
  const xpBar = document.querySelector('.how-quest-hud');
  const cards = Array.from(document.querySelectorAll('.how-step-card'));
  const badges = Array.from(document.querySelectorAll('.how-step-card .quest-badge-hex'));
  const terminal = document.querySelector('.how-terminal-strip');

  const elements = [
    { name: 'Header Strip', el: header },
    { name: 'XP Bar', el: xpBar },
    ...cards.map((c, i) => ({ name: `Card 0${i + 1}`, el: c })),
    ...badges.map((b, i) => ({ name: `Badge 0${i + 1}`, el: b })),
    { name: 'Terminal Strip', el: terminal },
  ].filter((item) => item.el && window.getComputedStyle(item.el).display !== 'none');

  const intersections = [];
  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      const a = elements[i];
      const b = elements[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;

      const rA = a.el.getBoundingClientRect();
      const rB = b.el.getBoundingClientRect();

      if (rA.width === 0 || rA.height === 0 || rB.width === 0 || rB.height === 0) continue;

      const intersects = !(
        rA.right <= rB.left ||
        rA.left >= rB.right ||
        rA.bottom <= rB.top ||
        rA.top >= rB.bottom
      );

      if (intersects) {
        intersections.push({
          step,
          pair: `${a.name} <-> ${b.name}`,
          elementA: a.name,
          elementB: b.name,
          rectA: { top: Math.round(rA.top), bottom: Math.round(rA.bottom), left: Math.round(rA.left), right: Math.round(rA.right) },
          rectB: { top: Math.round(rB.top), bottom: Math.round(rB.bottom), left: Math.round(rB.left), right: Math.round(rB.right) },
        });
      }
    }
  }
  return intersections;
}

if (typeof window !== 'undefined') {
  window.checkHowItWorksOverlaps = checkHowItWorksOverlaps;
}

/**
 * Runs debug audit if debug=1 query parameter is set:
 * Outlines each section, labels its name, and logs its top, height and computed background.
 * Checks for gaps longer than 30vh and white layers covering the canvas.
 * Continuously tracks elements under viewport center during scroll.
 * Runs automated overlap check on Section 03.
 */
function initDebugMode() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('debug') !== '1') return;

  document.body.classList.add('debug-active');

  const runAudit = () => {
    const sections = Array.from(document.querySelectorAll('[data-section-name]'));
    const rows = [];
    let previousBottom = 0;
    const vh30 = window.innerHeight * 0.3;

    sections.forEach((sec, idx) => {
      const name = sec.getAttribute('data-section-name');
      const rect = sec.getBoundingClientRect();
      const top = Math.round(rect.top + window.scrollY);
      const height = Math.round(rect.height);
      const bottom = top + height;
      const computedBg = window.getComputedStyle(sec).backgroundColor;

      let gapWarning = 'NONE';
      if (idx > 0) {
        const gap = top - previousBottom;
        if (gap > vh30) {
          gapWarning = `GAP ${gap}px (> 30vh)`;
        } else if (gap < -2) {
          gapWarning = `OVERLAP ${Math.abs(gap)}px`;
        }
      }

      let canvasCoverWarning = 'OK';
      const isEarlySection = ['PRELUDE', 'HERO', '01 ABOUT', '02 EXPERIENCE', '03 HOW IT WORKS', '04 ARENA'].includes(name);
      if (isEarlySection && (computedBg === 'rgb(255, 255, 255)' || computedBg === 'white')) {
        canvasCoverWarning = 'WHITE BACKGROUND COVERS CANVAS';
      }

      rows.push({
        Section: name,
        Top: `${top}px`,
        Height: `${height}px`,
        Background: computedBg,
        GapStatus: gapWarning,
        CanvasSafety: canvasCoverWarning,
      });

      previousBottom = bottom;
    });

    console.table(rows);
    window.__ccDebugSections = rows;

    // Overlap check for Section 03
    const overlapResults = [];
    [1, 2, 3, 4].forEach((step) => {
      const overlaps = checkHowItWorksOverlaps(step);
      overlapResults.push({
        Step: `Step 0${step}`,
        Viewport: `${window.innerWidth}x${window.innerHeight}`,
        Intersections: overlaps.length,
        Status: overlaps.length === 0 ? 'PASS (0 intersections)' : `FAIL (${overlaps.length} overlaps)`,
      });
    });
    console.log('HOW IT WORKS OVERLAP CHECK:');
    console.table(overlapResults);
    window.__ccOverlapResults = overlapResults;
  };

  // Real-time element inspection on scroll for debug mode
  let lastLoggedCenterElement = null;
  window.addEventListener('scroll', () => {
    const midX = Math.floor(window.innerWidth / 2);
    const midY = Math.floor(window.innerHeight / 2);
    const midEl = document.elementFromPoint(midX, midY);
    if (midEl && midEl !== lastLoggedCenterElement) {
      lastLoggedCenterElement = midEl;
      const bg = window.getComputedStyle(midEl).backgroundColor;
      if (bg === 'rgb(255, 255, 255)' || bg === 'white') {
        const sectionAncestor = midEl.closest('[data-section-name]');
        const secName = sectionAncestor ? sectionAncestor.getAttribute('data-section-name') : 'UNKNOWN';
        if (['01 ABOUT', '02 EXPERIENCE', '03 HOW IT WORKS', '04 ARENA'].includes(secName)) {
          console.warn('DEBUG INSPECTOR: White background detected under center:', midEl.className || midEl.tagName, 'in', secName);
        }
      }
    }
  }, { passive: true });

  setTimeout(runAudit, 600);
  window.addEventListener('resize', runAudit);
}

/**
 * Global initialization on DOM ready or immediately if already loaded.
 */
function initCampusCodeApp() {
  initAudioSystem();
  initMobileMenu();
  initMagneticButtons();
  initCountUpAnimations();
  initTextScramble();
  initPageTransitions();
  initLoginPage();
  initRegisterPage();
  initDashboardPage();
  initLiveStatusClock();
  initAccessibleModal();
  initDebugMode();

  // If on landing page
  if (document.querySelector('.opening-stage-overlay')) {
    initOpeningLanding();

    // Silently preload JPG frames in background; render frame 1 immediately
    startSilentPreload(() => {
      const canvas = document.querySelector('.cinematic-canvas');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        renderSmoothFrame(canvas, ctx, 0);
      }
      ScrollTrigger.refresh();
    });

    initPreludeScroll();
    initFullPageVideoScroll();
    initGlobalScrollProgress();
    initAboutOrbitInteraction();
    initAboutScatterHeading();
    initExperienceVideoSection();
    initVerticalStepperHowItWorks();
    initArenaLeaderboard();
    initMissionTextReveal();
    initNetworkDraggableNodes();
    initReadyConfetti();
    initHorizontalColorWipes();
    initNavScroll();
    initActiveNavLinkTracking();

    // Refresh ScrollTrigger once web fonts are fully rendered
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        ScrollTrigger.refresh();
      });
    }

    // Refresh ScrollTrigger on window resize to ensure no sections overlap
    window.addEventListener('resize', () => {
      ScrollTrigger.refresh();
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCampusCodeApp);
} else {
  initCampusCodeApp();
}
