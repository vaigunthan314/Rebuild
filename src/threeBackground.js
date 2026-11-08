// ==============================================================================
// LIVE 3D BACKGROUND SCENE (THREE.JS)
// Replaces video frames after prelude. Active behind Hero and sections 01 to 04.
// Flat lavender clear colour rgb(233, 233, 247) (E9E9F7), never white.
// MeshToonMaterial with 2-step gradient map + black outlines.
// Objects: rounded cube with skewed logo bars, 3 orbit rings, 3 orbiting spheres,
// drifting outlined squares.
// Choreography: Hero (right) -> 01 About (left 1/3, larger) -> 02 Experience (scaled down & pushed back)
// -> 03 How it works (explodes in 4 steps then reassembles with bounce) -> 04 Arena (large, right).
// Always alive: slow rotation, orbit, bobbing, mouse parallax, scroll velocity spin.
// Strict Rule: No hash symbols anywhere in this file.
// Plain comment above every function.
// ==============================================================================

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let scene, camera, renderer;
let mainGroup, cubeCoreGroup, ringsGroup, satellitesGroup, driftingSquaresGroup;
let cubeFaces = [];
let logoBarsGroup;
let orbitRings = [];
let satellites = [];
let driftingBoxes = [];

let isRendering = false;
let animationFrameId = null;
let isTabHidden = false;
let isSceneActive = false;

let mouseX = 0;
let mouseY = 0;
let targetCameraX = 0;
let targetCameraY = 0;

let lastScrollY = 0;
let scrollVelocity = 0;
let extraSpinY = 0;
let exposedMaterials = {
  cubeFaces: [],
  bars: [],
  rings: null,
  sphere: null,
  sphereHighlight: null,
  sphereWhite: null,
};

let choreoTimeline = null;
let choreoState = {
  groupX: 2.4,
  groupY: 0,
  groupZ: 0,
  groupScale: 1.0,
  explosion: 0,
  ringTilt: 0,
  orbitSpeedMult: 1.0,
};

/**
 * Checks if device is a mobile viewport.
 */
function isMobile() {
  return typeof window !== 'undefined' && window.innerWidth < 768;
}

/**
 * Checks if user prefers reduced motion.
 */
function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Generates a 2-pixel 1D DataTexture for 2-step flat toon banding.
 */
function createTwoStepToonGradient() {
  const colors = new Uint8Array([190, 195, 215, 255, 255, 255]);
  const texture = new THREE.DataTexture(colors, 2, 1, THREE.RGBFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates black outline edges for a given mesh geometry.
 */
function createEdgesOutline(geometry, colorRgb = 'rgb(11, 11, 18)') {
  const edges = new THREE.EdgesGeometry(geometry, 28);
  const line = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: new THREE.Color(colorRgb), linewidth: 2 })
  );
  return line;
}

/**
 * Creates a 3px black inverted hull outline mesh.
 */
function createInvertedHullOutline(geometry, scaleFactor = 1.035) {
  const outlineMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('rgb(11, 11, 18)'),
    side: THREE.BackSide,
  });
  const outlineMesh = new THREE.Mesh(geometry, outlineMat);
  outlineMesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
  return outlineMesh;
}

/**
 * Builds the 6 individual face plates of the white cube so it can explode cleanly in Section 03.
 * Each face has its own explicit flat tone (MeshBasicMaterial) so it reads as 3D without lights.
 */
function buildExplodableCube() {
  cubeCoreGroup = new THREE.Group();
  cubeFaces = [];

  const faceThickness = 0.22;
  const faceSize = 2.2;

  // Explicit face tones per D9 requirements:
  // Top: FFFFFF, Left: E4E6F2, Right: CDD1E3, Front: F0F2FA, Back: CDD1E3, Bottom: B5B9D0
  const matTop = new THREE.MeshBasicMaterial({ color: new THREE.Color('rgb(255, 255, 255)') });
  const matLeft = new THREE.MeshBasicMaterial({ color: new THREE.Color('rgb(228, 230, 242)') });
  const matRight = new THREE.MeshBasicMaterial({ color: new THREE.Color('rgb(205, 209, 227)') });
  const matFront = new THREE.MeshBasicMaterial({ color: new THREE.Color('rgb(240, 242, 250)') });
  const matBack = new THREE.MeshBasicMaterial({ color: new THREE.Color('rgb(205, 209, 227)') });
  const matBottom = new THREE.MeshBasicMaterial({ color: new THREE.Color('rgb(181, 185, 208)') });
  exposedMaterials.cubeFaces = [matTop, matLeft, matRight, matFront, matBack, matBottom];

  const geoXY = new RoundedBoxGeometry(faceSize, faceSize, faceThickness, 4, 0.12);
  const geoXZ = new RoundedBoxGeometry(faceSize, faceThickness, faceSize, 4, 0.12);
  const geoYZ = new RoundedBoxGeometry(faceThickness, faceSize, faceSize, 4, 0.12);

  // 1. Front face (+Z)
  const frontFace = new THREE.Mesh(geoXY, matFront);
  frontFace.position.set(0, 0, 1.0);
  frontFace.add(createInvertedHullOutline(geoXY, 1.03));
  frontFace.add(createEdgesOutline(geoXY));
  cubeCoreGroup.add(frontFace);
  cubeFaces.push({ mesh: frontFace, normal: new THREE.Vector3(0, 0, 1), rotAxis: new THREE.Vector3(1, 0, 0) });

  // 2. Back face (-Z)
  const backFace = new THREE.Mesh(geoXY, matBack);
  backFace.position.set(0, 0, -1.0);
  backFace.add(createInvertedHullOutline(geoXY, 1.03));
  backFace.add(createEdgesOutline(geoXY));
  cubeCoreGroup.add(backFace);
  cubeFaces.push({ mesh: backFace, normal: new THREE.Vector3(0, 0, -1), rotAxis: new THREE.Vector3(-1, 0, 0) });

  // 3. Right face (+X)
  const rightFace = new THREE.Mesh(geoYZ, matRight);
  rightFace.position.set(1.0, 0, 0);
  rightFace.add(createInvertedHullOutline(geoYZ, 1.03));
  rightFace.add(createEdgesOutline(geoYZ));
  cubeCoreGroup.add(rightFace);
  cubeFaces.push({ mesh: rightFace, normal: new THREE.Vector3(1, 0, 0), rotAxis: new THREE.Vector3(0, 1, 0) });

  // 4. Left face (-X)
  const leftFace = new THREE.Mesh(geoYZ, matLeft);
  leftFace.position.set(-1.0, 0, 0);
  leftFace.add(createInvertedHullOutline(geoYZ, 1.03));
  leftFace.add(createEdgesOutline(geoYZ));
  cubeCoreGroup.add(leftFace);
  cubeFaces.push({ mesh: leftFace, normal: new THREE.Vector3(-1, 0, 0), rotAxis: new THREE.Vector3(0, -1, 0) });

  // 5. Top face (+Y)
  const topFace = new THREE.Mesh(geoXZ, matTop);
  topFace.position.set(0, 1.0, 0);
  topFace.add(createInvertedHullOutline(geoXZ, 1.03));
  topFace.add(createEdgesOutline(geoXZ));
  cubeCoreGroup.add(topFace);
  cubeFaces.push({ mesh: topFace, normal: new THREE.Vector3(0, 1, 0), rotAxis: new THREE.Vector3(0, 0, 1) });

  // 6. Bottom face (-Y)
  const bottomFace = new THREE.Mesh(geoXZ, matBottom);
  bottomFace.position.set(0, -1.0, 0);
  bottomFace.add(createInvertedHullOutline(geoXZ, 1.03));
  bottomFace.add(createEdgesOutline(geoXZ));
  cubeCoreGroup.add(bottomFace);
  cubeFaces.push({ mesh: bottomFace, normal: new THREE.Vector3(0, -1, 0), rotAxis: new THREE.Vector3(0, 0, -1) });

  // Three Skewed Logo Bars on the Front Face (MeshBasicMaterial brand colours)
  logoBarsGroup = new THREE.Group();
  const barGeo = new RoundedBoxGeometry(0.24, 1.25, 0.08, 3, 0.04);

  // Near-black 0B0B12 bar
  const matBlack = new THREE.MeshBasicMaterial({ color: new THREE.Color('rgb(11, 11, 18)') });
  const bar1 = new THREE.Mesh(barGeo, matBlack);
  bar1.position.set(-0.42, 0, 0.15);
  bar1.rotation.z = 0.28;
  bar1.add(createEdgesOutline(barGeo, 'rgb(0, 0, 0)'));
  logoBarsGroup.add(bar1);

  // Violet 7367F5 bar
  const matViolet = new THREE.MeshBasicMaterial({ color: new THREE.Color('rgb(115, 103, 245)') });
  const bar2 = new THREE.Mesh(barGeo, matViolet);
  bar2.position.set(0, 0, 0.15);
  bar2.rotation.z = 0.28;
  bar2.add(createEdgesOutline(barGeo, 'rgb(11, 11, 18)'));
  logoBarsGroup.add(bar2);

  // Lime B6E54F bar
  const matLime = new THREE.MeshBasicMaterial({ color: new THREE.Color('rgb(182, 229, 79)') });
  const bar3 = new THREE.Mesh(barGeo, matLime);
  bar3.position.set(0.42, 0, 0.15);
  bar3.rotation.z = 0.28;
  bar3.add(createEdgesOutline(barGeo, 'rgb(11, 11, 18)'));
  logoBarsGroup.add(bar3);
  exposedMaterials.bars = [matBlack, matViolet, matLime];

  frontFace.add(logoBarsGroup);
  mainGroup.add(cubeCoreGroup);
}

/**
 * Builds 2 or 3 thin light silver orbit rings (C9CCD8) with black outline.
 */
function buildOrbitRings() {
  ringsGroup = new THREE.Group();
  orbitRings = [];

  const ringCount = isMobile() ? 2 : 3;
  const radii = [2.7, 3.2, 3.7];
  const ringGeo = new THREE.TorusGeometry(2.7, 0.045, 12, 72);
  const ringMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('rgb(201, 204, 216)'),
  });
  exposedMaterials.rings = ringMat;

  for (let i = 0; i < ringCount; i++) {
    const geo = i === 0 ? ringGeo : new THREE.TorusGeometry(radii[i], 0.045, 12, 72);
    const ring = new THREE.Mesh(geo, ringMat);
    ring.rotation.x = (Math.PI / 3.4) * (i + 1);
    ring.rotation.y = (Math.PI / 5) * (i * 2 + 1);
    ring.add(createEdgesOutline(geo, 'rgb(11, 11, 18)'));
    ringsGroup.add(ring);
    orbitRings.push({
      mesh: ring,
      speedX: 0.15 * (i % 2 === 0 ? 1 : -1),
      speedY: 0.22 * (i % 2 === 0 ? -1 : 1),
    });
  }

  mainGroup.add(ringsGroup);
}

/**
 * Builds orbiting sphere satellites: 1 violet sphere (7367F5) with highlight disc and 2 small white spheres (FFFFFF).
 */
function buildSatellites() {
  satellitesGroup = new THREE.Group();
  satellites = [];

  // Violet Sphere (7367F5) with lighter flat highlight disc (A59BFF)
  const sphereGeoViolet = new THREE.SphereGeometry(0.32, 24, 24);
  const sphereMatViolet = new THREE.MeshBasicMaterial({
    color: new THREE.Color('rgb(115, 103, 245)'),
  });
  const violetSphere = new THREE.Mesh(sphereGeoViolet, sphereMatViolet);
  violetSphere.add(createEdgesOutline(sphereGeoViolet, 'rgb(11, 11, 18)'));

  // Flat lighter highlight disc
  const highlightGeo = new THREE.CircleGeometry(0.1, 16);
  const highlightMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('rgb(165, 155, 255)'),
    side: THREE.DoubleSide,
  });
  const highlightDisc = new THREE.Mesh(highlightGeo, highlightMat);
  highlightDisc.position.set(0.16, 0.18, 0.24);
  highlightDisc.rotation.y = 0.4;
  violetSphere.add(highlightDisc);

  satellitesGroup.add(violetSphere);
  satellites.push({
    mesh: violetSphere,
    radius: 3.4,
    speed: 0.8,
    angle: 0,
    planeAngle: Math.PI / 6,
  });

  // 2 Small White (FFFFFF) Spheres with black outline
  const sphereGeoWhite = new THREE.SphereGeometry(0.18, 20, 20);
  const sphereMatWhite = new THREE.MeshBasicMaterial({
    color: new THREE.Color('rgb(255, 255, 255)'),
  });

  exposedMaterials.sphere = sphereMatViolet;
  exposedMaterials.sphereHighlight = highlightMat;
  exposedMaterials.sphereWhite = sphereMatWhite;

  for (let i = 0; i < 2; i++) {
    const whiteSphere = new THREE.Mesh(sphereGeoWhite, sphereMatWhite);
    whiteSphere.add(createEdgesOutline(sphereGeoWhite, 'rgb(11, 11, 18)'));
    satellitesGroup.add(whiteSphere);
    satellites.push({
      mesh: whiteSphere,
      radius: 2.8 + i * 0.9,
      speed: (i === 0 ? -1.1 : 0.95),
      angle: (i + 1) * Math.PI * 0.7,
      planeAngle: -(Math.PI / 4) * (i + 1),
    });
  }

  mainGroup.add(satellitesGroup);
}

/**
 * Builds 5 small outlined squares that drift in 3D space outside the cube.
 */
function buildDriftingSquares() {
  if (isMobile()) return;
  driftingSquaresGroup = new THREE.Group();
  driftingBoxes = [];

  const squareGeo = new THREE.BoxGeometry(0.4, 0.4, 0.02);
  const lineMatBlack = new THREE.LineBasicMaterial({ color: new THREE.Color('rgb(11, 11, 15)'), linewidth: 1.5 });
  const lineMatViolet = new THREE.LineBasicMaterial({ color: new THREE.Color('rgb(118, 101, 255)'), linewidth: 1.5 });
  const lineMatLime = new THREE.LineBasicMaterial({ color: new THREE.Color('rgb(168, 230, 46)'), linewidth: 1.5 });
  const mats = [lineMatBlack, lineMatViolet, lineMatLime];

  for (let i = 0; i < 5; i++) {
    const edges = new THREE.EdgesGeometry(squareGeo);
    const boxLine = new THREE.LineSegments(edges, mats[i % mats.length]);
    const radius = 4.2 + (i * 0.6);
    const angle = (i / 5) * Math.PI * 2;
    boxLine.position.set(Math.cos(angle) * radius, (i - 2) * 1.1, Math.sin(angle) * radius);
    boxLine.rotation.set(i * 0.4, i * 0.6, i * 0.3);
    driftingSquaresGroup.add(boxLine);
    driftingBoxes.push({
      mesh: boxLine,
      rotX: 0.3 + (i * 0.1),
      rotY: 0.2 + (i * 0.1),
      baseY: (i - 2) * 1.1,
      driftFreq: 0.8 + i * 0.3,
    });
  }

  mainGroup.add(driftingSquaresGroup);
}

/**
 * Updates the 3D scroll-driven choreography across Hero through 04 Arena.
 */
function setupScrollChoreography() {
  const heroSection = document.querySelector('.landing-hero');
  const arenaSection = document.querySelector('.section-hackathons');
  const missionSection = document.querySelector('.section-mission');

  if (!heroSection || !arenaSection) return;

  choreoTimeline = gsap.timeline({
    scrollTrigger: {
      trigger: heroSection,
      endTrigger: arenaSection,
      start: 'top top',
      end: 'bottom top',
      scrub: true,
      onUpdate: (self) => {
        // Timeline updates choreoState values
      },
    },
  });

  // State 0: HERO (Cube at right ~70% width, scale 1.0)
  // State 1: 01 ABOUT (progress ~0.26, Cube moves to left third, grows to 1.28, rings tilt)
  choreoTimeline
    .to(
      choreoState,
      {
        groupX: -2.4,
        groupY: 0.1,
        groupZ: 0,
        groupScale: 1.28,
        ringTilt: 0.5,
        orbitSpeedMult: 1.8,
        duration: 0.26,
        ease: 'power2.inOut',
      },
      0
    )
    // State 2: 02 EXPERIENCE (progress ~0.50, Cube shrinks to 0.78, moves back z = -4.2)
    .to(
      choreoState,
      {
        groupX: 0,
        groupY: -0.2,
        groupZ: -4.2,
        groupScale: 0.78,
        ringTilt: 0.2,
        orbitSpeedMult: 0.6,
        duration: 0.24,
        ease: 'power2.inOut',
      },
      0.26
    )
    // State 3: 03 HOW IT WORKS (progress 0.50 to 0.86, Cube EXPLODES in 4 steps then reassembles)
    .to(
      choreoState,
      {
        groupX: 0,
        groupY: 0,
        groupZ: 0,
        groupScale: 1.1,
        explosion: 0.6, // Step 1
        duration: 0.08,
        ease: 'power1.out',
      },
      0.50
    )
    .to(
      choreoState,
      {
        explosion: 1.2, // Step 2
        duration: 0.08,
        ease: 'power1.out',
      },
      0.58
    )
    .to(
      choreoState,
      {
        explosion: 1.9, // Step 3
        duration: 0.08,
        ease: 'power1.out',
      },
      0.66
    )
    .to(
      choreoState,
      {
        explosion: 0, // Step 4: Re-assembles with a bounce
        duration: 0.12,
        ease: 'back.out(2.2)',
      },
      0.74
    )
    // State 4: 04 ENTER THE ARENA (progress ~1.0, settles large, slightly right)
    .to(
      choreoState,
      {
        groupX: 1.6,
        groupY: 0,
        groupZ: 0,
        groupScale: 1.35,
        ringTilt: 0.3,
        orbitSpeedMult: 0.8,
        duration: 0.14,
        ease: 'power2.out',
      },
      0.86
    );

  // Hide 3D background once Section 05 (Mission) enters to save GPU resources
  if (missionSection) {
    ScrollTrigger.create({
      trigger: missionSection,
      start: 'top 30%',
      onEnter: () => {
        pauseLiveThreeScene();
      },
      onLeaveBack: () => {
        resumeLiveThreeScene();
      },
    });
  }
}

/**
 * Handles pointer movement to apply subtle camera parallax (max 0.15 rad).
 */
function handlePointerMove(e) {
  const normX = (e.clientX / window.innerWidth) * 2 - 1;
  const normY = -(e.clientY / window.innerHeight) * 2 + 1;
  targetCameraX = normX * 0.9;
  targetCameraY = normY * 0.6;
}

/**
 * Handles scroll velocity tracking to apply dynamic spin on scroll.
 */
function handleScrollVelocity() {
  const currentY = window.scrollY;
  const delta = currentY - lastScrollY;
  lastScrollY = currentY;
  scrollVelocity = delta;
  extraSpinY += delta * 0.001;
}

/**
 * Resizes the Three.js viewport and camera projection matrix.
 */
function handleResize() {
  if (!renderer || !camera) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

/**
 * The main Three.js animation tick loop running at target 60 fps.
 * Zero memory allocations occur inside this loop.
 */
function renderTick(nowMs) {
  if (!isRendering || isTabHidden || !isSceneActive) return;

  const timeSec = nowMs * 0.001;

  // 1. Scene gentle bobbing
  mainGroup.position.x = choreoState.groupX;
  mainGroup.position.y = choreoState.groupY + Math.sin(timeSec * 1.6) * 0.12;
  mainGroup.position.z = choreoState.groupZ;
  mainGroup.scale.set(choreoState.groupScale, choreoState.groupScale, choreoState.groupScale);

  // 2. Base slow rotation + scroll velocity spin easing back
  extraSpinY *= 0.92;
  mainGroup.rotation.y += 0.003 + extraSpinY * 0.05;
  mainGroup.rotation.x = Math.sin(timeSec * 0.8) * 0.08 + choreoState.ringTilt * 0.2;

  // 3. Exploding cube face offsets in Section 03
  const exp = choreoState.explosion;
  for (let i = 0; i < cubeFaces.length; i++) {
    const face = cubeFaces[i];
    const normal = face.normal;
    face.mesh.position.set(normal.x * (1.0 + exp), normal.y * (1.0 + exp), normal.z * (1.0 + exp));
    if (exp > 0.05) {
      face.mesh.rotation.z = Math.sin(timeSec * 2 + i) * exp * 0.15;
    } else {
      face.mesh.rotation.z = 0;
    }
  }

  // 4. Orbit rings rotation
  for (let i = 0; i < orbitRings.length; i++) {
    const ring = orbitRings[i];
    ring.mesh.rotation.z += ring.speedX * 0.04;
    ring.mesh.rotation.x += ring.speedY * 0.03;
  }

  // 5. Spheres orbiting outside the cube
  const speedMult = choreoState.orbitSpeedMult;
  for (let i = 0; i < satellites.length; i++) {
    const sat = satellites[i];
    sat.angle += sat.speed * 0.02 * speedMult;
    const r = sat.radius;
    const cosA = Math.cos(sat.angle) * r;
    const sinA = Math.sin(sat.angle) * r;
    // Rotate along inclined orbital plane
    sat.mesh.position.x = cosA * Math.cos(sat.planeAngle);
    sat.mesh.position.y = sinA;
    sat.mesh.position.z = cosA * Math.sin(sat.planeAngle);
  }

  // 6. Small drifting squares
  for (let i = 0; i < driftingBoxes.length; i++) {
    const box = driftingBoxes[i];
    box.mesh.rotation.x += 0.01 * box.rotX;
    box.mesh.rotation.y += 0.01 * box.rotY;
    box.mesh.position.y = box.baseY + Math.sin(timeSec * box.driftFreq) * 0.35;
  }

  // 7. Smooth mouse parallax on camera
  camera.position.x += (targetCameraX - camera.position.x) * 0.05;
  camera.position.y += (targetCameraY - camera.position.y) * 0.05;
  camera.lookAt(0, 0, 0);

  // Render frame
  renderer.render(scene, camera);

  animationFrameId = requestAnimationFrame(renderTick);
}

/**
 * Pauses the live Three.js scene rendering loop to conserve CPU and GPU power.
 */
export function pauseLiveThreeScene() {
  isSceneActive = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  const wrapper = document.querySelector('.live-three-canvas-wrapper');
  if (wrapper) {
    wrapper.style.display = 'none';
  }
}

/**
 * Resumes the live Three.js scene rendering loop when returning to the Hero -> 04 range.
 */
export function resumeLiveThreeScene() {
  const wrapper = document.querySelector('.live-three-canvas-wrapper');
  if (wrapper) {
    wrapper.style.display = 'block';
  }
  isSceneActive = true;
  if (!animationFrameId && isRendering && !isTabHidden) {
    animationFrameId = requestAnimationFrame(renderTick);
  }
}

/**
 * Initializes the live 3D background Three.js engine and mounts the scene.
 */
export function initLiveThreeBackground() {
  const canvas = document.querySelector('.live-three-canvas');
  const wrapper = document.querySelector('.live-three-canvas-wrapper');
  if (!canvas || !wrapper || renderer) return;

  // 1. Scene & Renderer setup with flat lavender background
  scene = new THREE.Scene();

  const width = window.innerWidth;
  const height = window.innerHeight;

  camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
  camera.position.set(0, 0, 10);

  const pixelRatioCap = isMobile() ? 1.0 : Math.min(1.5, window.devicePixelRatio || 1);
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(pixelRatioCap);
  renderer.setClearColor(new THREE.Color('rgb(233, 233, 247)'), 1.0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // 2. Object group & geometry construction (MeshBasicMaterial, no lights needed)
  mainGroup = new THREE.Group();
  scene.add(mainGroup);

  buildExplodableCube();
  buildOrbitRings();
  buildSatellites();
  buildDriftingSquares();

  // 4. Choreography and Interaction
  setupScrollChoreography();

  window.addEventListener('mousemove', handlePointerMove, { passive: true });
  window.addEventListener('scroll', handleScrollVelocity, { passive: true });
  window.addEventListener('resize', handleResize);

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      isTabHidden = document.hidden;
      if (isTabHidden && animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      } else if (!isTabHidden && isRendering && isSceneActive) {
        animationFrameId = requestAnimationFrame(renderTick);
      }
    });
  }

  if (typeof window !== 'undefined') {
    window.__ccThreeBg = {
      materials: exposedMaterials,
      scene,
      camera,
      renderer,
      mainGroup,
    };
  }

  // 5. Reduced motion static render
  if (prefersReducedMotion()) {
    renderer.render(scene, camera);
    return;
  }

  isRendering = true;
  isSceneActive = true;
  animationFrameId = requestAnimationFrame(renderTick);
}
