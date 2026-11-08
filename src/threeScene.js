// ==============================================================================
// 3D OPENING SCENE (THREE.JS)
// Full-screen near-black opening stage with tiny drifting dust specks,
// 3D CampusCode emblem drop with squash-and-stretch bounces, floor shockwaves,
// letter-by-letter flat wordmark reveal, and seamless crossfade into video frame 1.
// Strict Rule: No hash symbols anywhere.
// ==============================================================================

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { gsap } from 'gsap';

let scene, camera, renderer, objectGroup, satelliteMesh, ring1, ring2;
let isAnimating = true;
let isLandingFinished = false;
let floatTween = null;
let hasTransitioned = false;

/**
 * Creates subtle drifting dust particles in the opening stage (tiny 1 to 3 px).
 */
function initDustParticles() {
  const dustContainer = document.querySelector('.opening-dust-container');
  if (!dustContainer) return;

  dustContainer.innerHTML = '';
  const colors = ['rgb(255, 255, 255)', 'rgb(118, 101, 255)', 'rgb(168, 230, 46)'];

  for (let i = 0; i < 34; i++) {
    const dot = document.createElement('span');
    dot.className = 'opening-dust-speck';
    const left = Math.random() * 100;
    const top = Math.random() * 100;
    const size = Math.random() * 2 + 1; // 1 to 3 px
    const duration = Math.random() * 9 + 7;
    const delay = Math.random() * 5;
    const color = colors[i % colors.length];

    dot.style.left = `${left}%`;
    dot.style.top = `${top}%`;
    dot.style.width = `${size.toFixed(1)}px`;
    dot.style.height = `${size.toFixed(1)}px`;
    dot.style.backgroundColor = color;
    dot.style.animationDuration = `${duration.toFixed(1)}s`;
    dot.style.animationDelay = `${delay.toFixed(1)}s`;

    dustContainer.appendChild(dot);
  }
}

/**
 * Builds the 3D Three.js CampusCode emblem (cube, skewed logo bars, orbit rings, satellite sphere).
 * Orbit path is calculated outside the cube so the satellite sphere never crosses the front logo bars.
 */
function buildEmblemGroup() {
  objectGroup = new THREE.Group();

  // (a) Rounded White Cube Core
  const cubeGeo = new RoundedBoxGeometry(2.3, 2.3, 2.3, 6, 0.35);
  const cubeMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('rgb(255, 255, 255)'),
    roughness: 0.12,
    metalness: 0.04,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
  });
  const cubeMesh = new THREE.Mesh(cubeGeo, cubeMat);
  objectGroup.add(cubeMesh);

  // (b) Three Skewed Logo Bars on Front Face (z = 1.18)
  const barGeo = new RoundedBoxGeometry(0.24, 1.25, 0.08, 4, 0.04);

  // Bar 1: Black
  const barMatBlack = new THREE.MeshStandardMaterial({
    color: new THREE.Color('rgb(11, 11, 15)'),
    roughness: 0.2,
    metalness: 0.1,
  });
  const bar1 = new THREE.Mesh(barGeo, barMatBlack);
  bar1.position.set(-0.42, 0, 1.18);
  bar1.rotation.z = 0.28;
  objectGroup.add(bar1);

  // Bar 2: Violet
  const barMatViolet = new THREE.MeshStandardMaterial({
    color: new THREE.Color('rgb(118, 101, 255)'),
    roughness: 0.15,
    metalness: 0.2,
  });
  const bar2 = new THREE.Mesh(barGeo, barMatViolet);
  bar2.position.set(0, 0, 1.18);
  bar2.rotation.z = 0.28;
  objectGroup.add(bar2);

  // Bar 3: Lime
  const barMatLime = new THREE.MeshStandardMaterial({
    color: new THREE.Color('rgb(168, 230, 46)'),
    roughness: 0.15,
    metalness: 0.2,
  });
  const bar3 = new THREE.Mesh(barGeo, barMatLime);
  bar3.position.set(0.42, 0, 1.18);
  bar3.rotation.z = 0.28;
  objectGroup.add(bar3);

  // (c) Two Metallic Orbit Rings
  const ringGeo = new THREE.TorusGeometry(2.7, 0.05, 16, 90);
  const ringMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('rgb(222, 230, 240)'),
    metalness: 0.9,
    roughness: 0.18,
  });

  ring1 = new THREE.Mesh(ringGeo, ringMat);
  ring1.rotation.x = Math.PI / 3.2;
  ring1.rotation.y = Math.PI / 6;
  objectGroup.add(ring1);

  ring2 = new THREE.Mesh(ringGeo, ringMat);
  ring2.rotation.x = -Math.PI / 3.5;
  ring2.rotation.y = -Math.PI / 5;
  objectGroup.add(ring2);

  // (d) One Glossy Violet Satellite Sphere (orbits safely outside the cube core)
  const sphereGeo = new THREE.SphereGeometry(0.3, 32, 32);
  const sphereMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('rgb(118, 101, 255)'),
    roughness: 0.1,
    metalness: 0.3,
    clearcoat: 1,
  });
  satelliteMesh = new THREE.Mesh(sphereGeo, sphereMat);
  // Initial position to the right side of the cube, fully outside logo bars
  satelliteMesh.position.set(3.5, 0, 0);
  objectGroup.add(satelliteMesh);

  // Initial group position above viewport
  objectGroup.position.set(0, 11, 0);
  objectGroup.rotation.set(-0.25, 0.35, 0);

  scene.add(objectGroup);
}

/**
 * Initializes the Three.js canvas stage and begins the opening scene timeline.
 */
export function initThreeOpeningScene({ onLandingComplete, onShockwave }) {
  const container = document.querySelector('.opening-stage-overlay');
  const canvas = document.querySelector('.hero-three-canvas');
  if (!container || !canvas) return;

  hasTransitioned = false;
  initDustParticles();

  // 1. Scene setup
  scene = new THREE.Scene();

  const width = window.innerWidth;
  const height = window.innerHeight;

  // 2. Camera setup matching video frame 1 FOV and perspective
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 0, 9.4);

  // 3. WebGL Renderer
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
  } catch (err) {
    if (onLandingComplete) onLandingComplete();
    return;
  }

  // 4. Lighting setup
  const ambientLight = new THREE.AmbientLight(
    new THREE.Color('rgb(240, 244, 250)'),
    1.6
  );
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(
    new THREE.Color('rgb(255, 255, 255)'),
    2.4
  );
  mainLight.position.set(5, 8, 6);
  scene.add(mainLight);

  const violetLight = new THREE.PointLight(
    new THREE.Color('rgb(118, 101, 255)'),
    3.5,
    18
  );
  violetLight.position.set(-4, -2, 4);
  scene.add(violetLight);

  const limeLight = new THREE.PointLight(
    new THREE.Color('rgb(168, 230, 46)'),
    2.4,
    18
  );
  limeLight.position.set(4, -3, 3);
  scene.add(limeLight);

  // 5. Build Emblem
  buildEmblemGroup();

  // 6. Handle Window Resizing
  window.addEventListener('resize', () => {
    if (!renderer || !camera) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  // 7. Render Loop with Orbit Motion & Mouse Parallax
  let orbitAngle = 0;
  let mouseTargetX = 0;
  let mouseTargetY = 0;

  window.addEventListener('mousemove', (e) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = -(e.clientY / window.innerHeight) * 2 + 1;
    mouseTargetX = nx * 0.18;
    mouseTargetY = ny * 0.12;
  });

  function renderFrame() {
    if (!isAnimating) return;
    requestAnimationFrame(renderFrame);

    if (isLandingFinished && objectGroup) {
      // Subtle mouse tilt
      objectGroup.rotation.y += (mouseTargetX - objectGroup.rotation.y * 0.05) * 0.03 + 0.003;
      objectGroup.rotation.x += (mouseTargetY - objectGroup.rotation.x * 0.05) * 0.03;

      // Orbiting satellite motion: radius is 3.5 and tilted so it never passes across front logo bars
      orbitAngle += 0.022;
      if (satelliteMesh) {
        satelliteMesh.position.x = Math.cos(orbitAngle) * 3.5;
        satelliteMesh.position.z = Math.sin(orbitAngle) * 2.8;
        // When crossing the front face (z > 0), altitude y is well above or below the 1.15 cube boundary
        satelliteMesh.position.y = Math.sin(orbitAngle) * 2.2;
      }

      if (ring1) ring1.rotation.z += 0.0035;
      if (ring2) ring2.rotation.z -= 0.0035;
    }

    renderer.render(scene, camera);
  }
  requestAnimationFrame(renderFrame);

  // 8. Execute Opening Timeline
  runOpeningSequence(onLandingComplete, onShockwave);
}

/**
 * Triggers camera shake on bounce impacts.
 */
function triggerCameraShake(intensity) {
  if (!camera) return;
  gsap.fromTo(
    camera.position,
    { y: -intensity },
    {
      y: 0,
      duration: 0.35,
      ease: 'elastic.out(1, 0.3)',
    }
  );
}

/**
 * Runs the opening sequence: drop, 3 bounces, rings settle,
 * wordmark drop-in, tagline sweep, and scroll cue reveal.
 */
function runOpeningSequence(onLandingComplete, onShockwave) {
  const wordmarkLetters = document.querySelectorAll('.wordmark-letter');
  const tagline = document.querySelector('.opening-tagline');
  const limeLine = document.querySelector('.opening-lime-line');
  const scrollPrompt = document.querySelector('.opening-scroll-prompt');
  const floorShadow = document.querySelector('.opening-floor-shadow');

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Reduced motion: immediate settle with calm fade
  if (prefersReduced) {
    if (floorShadow) floorShadow.style.opacity = '0.45';
    if (objectGroup) {
      objectGroup.position.set(0, 0, 0);
      objectGroup.scale.set(1, 1, 1);
    }
    revealWordmarkAndTagline(wordmarkLetters, tagline, limeLine, scrollPrompt, onLandingComplete);
    return;
  }

  const tl = gsap.timeline();

  // Object falls with slight spin (duration 0.75s)
  tl.to(
    objectGroup.position,
    {
      y: 0,
      duration: 0.75,
      ease: 'power3.in',
    },
    '0.3'
  )
    .to(
      objectGroup.rotation,
      {
        y: 0.25,
        x: -0.1,
        duration: 0.75,
        ease: 'power2.in',
      },
      '0.3'
    )
    // IMPACT 1: Shockwave ring, particle burst, camera shake, squash
    .add(() => {
      triggerCameraShake(0.24);
      if (floorShadow) {
        floorShadow.style.opacity = '0.45';
        floorShadow.style.transform = 'translate(-50%, -50%) scale(1.15)';
      }
      if (onShockwave) onShockwave(1);
    })
    .to(
      objectGroup.scale,
      {
        y: 0.65,
        x: 1.25,
        z: 1.25,
        duration: 0.12,
        ease: 'power2.out',
      },
      '<0.02'
    )
    .to(objectGroup.scale, {
      y: 1.2,
      x: 0.88,
      z: 0.88,
      duration: 0.16,
      ease: 'power2.out',
    })
    // REBOUND 1 (height 2.7)
    .to(
      objectGroup.position,
      {
        y: 2.7,
        duration: 0.42,
        ease: 'power2.out',
        onStart: () => {
          if (floorShadow) {
            floorShadow.style.opacity = '0.2';
            floorShadow.style.transform = 'translate(-50%, -50%) scale(0.7)';
          }
        },
      },
      '<'
    )
    // Fall back to ground
    .to(objectGroup.position, {
      y: 0,
      duration: 0.38,
      ease: 'power2.in',
    })
    // IMPACT 2: Secondary bounce
    .add(() => {
      triggerCameraShake(0.12);
      if (floorShadow) {
        floorShadow.style.opacity = '0.45';
        floorShadow.style.transform = 'translate(-50%, -50%) scale(1.05)';
      }
      if (onShockwave) onShockwave(2);
    })
    .to(objectGroup.scale, {
      y: 0.8,
      x: 1.15,
      z: 1.15,
      duration: 0.1,
      ease: 'power2.out',
    })
    .to(objectGroup.scale, {
      y: 1.08,
      x: 0.94,
      z: 0.94,
      duration: 0.14,
      ease: 'power2.out',
    })
    // REBOUND 2 (height 0.85)
    .to(
      objectGroup.position,
      {
        y: 0.85,
        duration: 0.28,
        ease: 'power2.out',
        onStart: () => {
          if (floorShadow) {
            floorShadow.style.opacity = '0.28';
            floorShadow.style.transform = 'translate(-50%, -50%) scale(0.85)';
          }
        },
      },
      '<'
    )
    // Fall to rest
    .to(objectGroup.position, {
      y: 0,
      duration: 0.25,
      ease: 'power2.in',
    })
    // Final settle
    .add(() => {
      if (floorShadow) {
        floorShadow.style.opacity = '0.45';
        floorShadow.style.transform = 'translate(-50%, -50%) scale(1)';
      }
      if (onShockwave) onShockwave(3);
    })
    .to(objectGroup.scale, {
      y: 1,
      x: 1,
      z: 1,
      duration: 0.28,
      ease: 'elastic.out(1, 0.4)',
    })
    // (d) Rings snap into orbit & object floats gently
    .add(() => {
      isLandingFinished = true;
      if (objectGroup) {
        floatTween = gsap.to(objectGroup.position, {
          y: 0.28,
          duration: 2.2,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      }
      // Reveal wordmark and cue
      revealWordmarkAndTagline(wordmarkLetters, tagline, limeLine, scrollPrompt, onLandingComplete);
    });
}

/**
 * Animates the CAMPUSCODE wordmark letters dropping in cleanly with no glow,
 * followed by HACKATHON ARENA and the lime underline sweep.
 */
function revealWordmarkAndTagline(letters, tagline, limeLine, scrollPrompt, onLandingComplete) {
  const brandLockup = document.querySelector('.opening-brand-lockup');
  if (brandLockup) {
    brandLockup.style.opacity = '1';
  }

  // Letters drop in one by one cleanly
  if (letters && letters.length) {
    gsap.to(letters, {
      opacity: 1,
      y: 0,
      duration: 0.45,
      stagger: 0.04,
      ease: 'back.out(1.7)',
    });
  }

  // Tagline and lime line
  const afterDelay = (letters ? letters.length * 0.04 : 0) + 0.25;
  if (tagline) {
    gsap.to(tagline, {
      opacity: 1,
      y: 0,
      duration: 0.5,
      delay: afterDelay,
      ease: 'power2.out',
    });
  }

  if (limeLine) {
    gsap.to(limeLine, {
      scaleX: 1,
      duration: 0.6,
      delay: afterDelay + 0.15,
      ease: 'power3.out',
    });
  }

  // Pulsing "SCROLL TO ENTER" cue
  if (scrollPrompt) {
    gsap.to(scrollPrompt, {
      opacity: 1,
      duration: 0.6,
      delay: afterDelay + 0.4,
      ease: 'power2.out',
      onComplete: () => {
        scrollPrompt.classList.add('is-pulsing');
        if (onLandingComplete) onLandingComplete();
      },
    });
  } else if (onLandingComplete) {
    onLandingComplete();
  }
}

/**
 * Triggers the 1.2s First-Scroll Transition:
 * Dissolves the black stage upward, crossfades Three.js object into video frame 1,
 * and calls onTransitionComplete.
 */
export function executeFirstScrollTransition(onTransitionComplete) {
  if (hasTransitioned) return;
  hasTransitioned = true;

  const overlay = document.querySelector('.opening-stage-overlay');
  const canvasWrapper = document.querySelector('.cinematic-canvas-wrapper');
  const brandLockup = document.querySelector('.opening-brand-lockup');
  const scrollPrompt = document.querySelector('.opening-scroll-prompt');
  const skipBtn = document.querySelector('.opening-skip-btn');
  const soundBtn = document.querySelector('.opening-sound-btn');

  // 1. Immediately fade out text cues
  if (brandLockup) brandLockup.style.opacity = '0';
  if (scrollPrompt) scrollPrompt.style.opacity = '0';
  if (skipBtn) skipBtn.style.opacity = '0';
  if (soundBtn) soundBtn.style.opacity = '0';

  // 2. Kill floating animation
  if (floatTween) floatTween.kill();

  // 3. Align Three.js group rotation to match video frame 1 exactly before crossfade
  if (objectGroup) {
    gsap.to(objectGroup.rotation, {
      x: 0,
      y: 0,
      z: 0,
      duration: 0.5,
      ease: 'power2.out',
    });
  }

  // 4. Fade in the video canvas (which holds frame 1) from 0 to 1
  if (canvasWrapper) {
    canvasWrapper.classList.remove('is-opening-hidden');
    gsap.to(canvasWrapper, {
      opacity: 1,
      duration: 0.9,
      ease: 'power2.inOut',
    });
  }

  // 5. Hard flat wipe of the black opening stage upward
  if (overlay) {
    gsap.to(overlay, {
      yPercent: -100,
      duration: 0.85,
      ease: 'expo.inOut',
      onComplete: () => {
        // HIDE THREE.JS COMPLETELY SO IT NEVER OVERLAPS FRAME 1
        overlay.style.display = 'none';
        isAnimating = false;
        if (onTransitionComplete) onTransitionComplete();
      },
    });
  } else {
    if (onTransitionComplete) onTransitionComplete();
  }
}

/**
 * Skips the entire opening stage immediately if the visitor has already seen it in this session.
 */
export function skipOpeningStageImmediately() {
  isAnimating = false;
  hasTransitioned = true;
  if (floatTween) floatTween.kill();
  const overlay = document.querySelector('.opening-stage-overlay');
  if (overlay) overlay.style.display = 'none';
  const enterScreen = document.querySelector('.enter-stage-screen');
  if (enterScreen) enterScreen.style.display = 'none';
  try {
    sessionStorage.setItem('campuscode_intro_done', 'true');
  } catch (e) {}
}

/**
 * Skips the bounce immediately and shows the settled idle state with wordmark.
 */
export function skipOpeningBounce(onLandingComplete) {
  gsap.killTweensOf(objectGroup?.position);
  gsap.killTweensOf(objectGroup?.scale);
  gsap.killTweensOf(objectGroup?.rotation);

  if (objectGroup) {
    objectGroup.position.set(0, 0, 0);
    objectGroup.scale.set(1, 1, 1);
    objectGroup.rotation.set(0, 0.2, 0);
  }

  const floorShadow = document.querySelector('.opening-floor-shadow');
  if (floorShadow) floorShadow.style.opacity = '0.45';

  isLandingFinished = true;
  floatTween = gsap.to(objectGroup.position, {
    y: 0.28,
    duration: 2.2,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut',
  });

  const wordmarkLetters = document.querySelectorAll('.wordmark-letter');
  const tagline = document.querySelector('.opening-tagline');
  const limeLine = document.querySelector('.opening-lime-line');
  const scrollPrompt = document.querySelector('.opening-scroll-prompt');

  revealWordmarkAndTagline(wordmarkLetters, tagline, limeLine, scrollPrompt, onLandingComplete);
}
