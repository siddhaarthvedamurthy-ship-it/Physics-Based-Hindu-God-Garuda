/**
 * PROJECT GARUDA — Application Engine
 * Principal Creative Technologist · Frontend Architect
 * Vedic Biomechanical Engineering Framework
 *
 * Modules:
 *   1. TabController        — Tab navigation state management
 *   2. ChapterAccordion     — Collapsible chapter panels
 *   3. GarudaHologram       — Three.js 3D holographic viewer
 *   4. DynamicsEngine       — Physics simulation & live metrics
 *   5. SimulationLog        — Scrolling readout console
 */

'use strict';

/* ─────────────────────────────────────────────────────────────
   UTILITY HELPERS
───────────────────────────────────────────────────────────── */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp  = (a, b, t)   => a + (b - a) * t;

function formatNum(n, decimals = 1) {
  return n.toFixed(decimals);
}

/* ─────────────────────────────────────────────────────────────
   1. TAB CONTROLLER
───────────────────────────────────────────────────────────── */

class TabController {
  constructor() {
    this.buttons = document.querySelectorAll('.tab-btn');
    this.panels  = document.querySelectorAll('.tab-panel');
    this.current = '1';
    this._bind();
  }

  _bind() {
    this.buttons.forEach(btn => {
      btn.addEventListener('click', () => this._switchTo(btn.dataset.tab));
    });
  }

  _switchTo(id) {
    if (id === this.current) return;
    this.current = id;

    this.buttons.forEach(b => {
      const active = b.dataset.tab === id;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', active);
    });

    this.panels.forEach(p => {
      const active = p.id === `panel-${id}`;
      p.classList.toggle('active', active);
    });

    // Trigger hologram resize if switching to tab 1
    if (id === '1' && window.garudaHologram) {
      window.garudaHologram.onResize();
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   2. CHAPTER ACCORDION
───────────────────────────────────────────────────────────── */

class ChapterAccordion {
  constructor() {
    this.headers = document.querySelectorAll('.chapter-header');
    this._bind();
  }

  _bind() {
    this.headers.forEach(header => {
      header.addEventListener('click', () => this._toggle(header));
    });
  }

  _toggle(header) {
    const bodyId = header.dataset.chapter;
    const body   = document.getElementById(bodyId);
    if (!body) return;

    const isOpen = header.classList.contains('open');

    if (isOpen) {
      header.classList.remove('open');
      header.setAttribute('aria-expanded', 'false');
      body.classList.remove('open');
    } else {
      header.classList.add('open');
      header.setAttribute('aria-expanded', 'true');
      body.classList.add('open');
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   3. GARUDA HOLOGRAM — Three.js 3D Engine
───────────────────────────────────────────────────────────── */

class GarudaHologram {
  constructor(canvasId) {
    this.canvas    = document.getElementById(canvasId);
    this.container = document.getElementById('viewport-container');

    // Mode state: 'flight' | 'cape'
    this.mode      = 'flight';
    this.capeAlpha = 0.0;
    this.wingAlpha = 1.0;

    // Orbit controls state
    this.isDragging   = false;
    this.lastMouseX   = 0;
    this.lastMouseY   = 0;
    this.orbitTheta   = 0.4;   // horizontal angle
    this.orbitPhi     = 0.35;  // vertical angle
    this.orbitRadius  = 18.0;

    // Flight mode for wing animation ('cruising' | 'subsonic' | 'extreme')
    this.flightMode   = 'cruising';
    this.clock        = 0;

    this._init();
    this._buildScene();
    this._bindControls();
    this._startLoop();

    window.garudaHologram = this;
  }

  /* ── Scene Initialisation ──────────────────────────────── */

  _init() {
    const W = this.container.clientWidth;
    const H = this.container.clientHeight;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(W, H);
    this.renderer.setClearColor(0x000000, 0);

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 200);
    this._updateCamera();

    // Ambient
    const ambient = new THREE.AmbientLight(0x442211, 0.6);
    this.scene.add(ambient);

    // Saffron key light
    const saffronLight = new THREE.PointLight(0xFF9933, 2.5, 40);
    saffronLight.position.set(8, 6, 8);
    this.scene.add(saffronLight);

    // Crimson fill light
    const crimsonLight = new THREE.PointLight(0x990000, 1.8, 35);
    crimsonLight.position.set(-8, 2, -6);
    this.scene.add(crimsonLight);

    // Lavender rim light
    const lavenderLight = new THREE.PointLight(0xB0B0F0, 1.2, 30);
    lavenderLight.position.set(0, 12, -10);
    this.scene.add(lavenderLight);

    // Gold floor bounce
    const goldBounce = new THREE.PointLight(0xFFD700, 0.8, 20);
    goldBounce.position.set(0, -8, 4);
    this.scene.add(goldBounce);
  }

  /* ── Materials Factory ─────────────────────────────────── */

  _makeMaterial(color, emissive, opacity, wireframe = false) {
    return new THREE.MeshPhongMaterial({
      color:       color,
      emissive:    emissive,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity:     opacity,
      wireframe:   wireframe,
      side:        THREE.DoubleSide,
      shininess:   120,
      specular:    new THREE.Color(0xFFCCA0),
      depthWrite:  false,
    });
  }

  _makeEdgeMaterial(color) {
    return new THREE.LineBasicMaterial({
      color:       color,
      transparent: true,
      opacity:     0.65,
      linewidth:   1,
    });
  }

  /* ── Scene Build ───────────────────────────────────────── */

  _buildScene() {
    // Root pivot group (entire hologram)
    this.holoRoot = new THREE.Group();
    this.scene.add(this.holoRoot);

    // ── Spine (primary load-bearing cylinder) ──
    const spineGeo = new THREE.CylinderGeometry(0.09, 0.09, 5.2, 12);
    const spineMat = new THREE.MeshPhongMaterial({
      color:     0xE6E6FA,
      emissive:  0x9999FF,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity:   0.92,
      shininess: 200,
      specular:  new THREE.Color(0xFFFFFF),
    });
    this.spine = new THREE.Mesh(spineGeo, spineMat);
    this.spine.position.y = 0.4;
    this.holoRoot.add(this.spine);

    // ── Torso Matrix (semi-transparent cylinder shell) ──
    const torsoGeo = new THREE.CylinderGeometry(0.72, 0.6, 3.0, 24, 1, true);
    const torsoMat = this._makeMaterial(0x4A2E2B, 0xFF9933, 0.22);
    this.torso = new THREE.Mesh(torsoGeo, torsoMat);
    this.torso.position.y = 0.9;
    this.holoRoot.add(this.torso);

    // Torso edge outline
    const torsoEdge = new THREE.EdgesGeometry(
      new THREE.CylinderGeometry(0.72, 0.6, 3.0, 24)
    );
    const torsoLine = new THREE.LineSegments(torsoEdge, this._makeEdgeMaterial(0xFF9933));
    torsoLine.position.y = 0.9;
    this.holoRoot.add(torsoLine);

    // Inner rib rings (structural framing detail)
    for (let i = 0; i < 5; i++) {
      const ribGeo = new THREE.TorusGeometry(0.71 - i * 0.006, 0.012, 6, 24);
      const ribMat = new THREE.MeshPhongMaterial({
        color: 0xFF9933,
        emissive: 0xFF5500,
        emissiveIntensity: 0.7,
        transparent: true,
        opacity: 0.55,
      });
      const rib = new THREE.Mesh(ribGeo, ribMat);
      rib.position.y = -0.3 + i * 0.7;
      rib.rotation.x = Math.PI / 2;
      this.holoRoot.add(rib);
    }

    // ── Pelvis / Hip Band ──
    const pelvisGeo = new THREE.CylinderGeometry(0.82, 0.68, 0.28, 20);
    const pelvisMat = this._makeMaterial(0xD9A05B, 0xFF6600, 0.35);
    const pelvis = new THREE.Mesh(pelvisGeo, pelvisMat);
    pelvis.position.y = -0.7;
    this.holoRoot.add(pelvis);

    // ── Shoulder Brace ──
    const shoulderGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.9, 10);
    const shoulderMat = this._makeMaterial(0xE6E6FA, 0x8888FF, 0.45);
    this.shoulderBar = new THREE.Mesh(shoulderGeo, shoulderMat);
    this.shoulderBar.rotation.z = Math.PI / 2;
    this.shoulderBar.position.y = 1.8;
    this.holoRoot.add(this.shoulderBar);

    // Shoulder caps
    const capGeo = new THREE.SphereGeometry(0.18, 12, 12);
    const capMat = this._makeMaterial(0xFF9933, 0xFF6600, 0.7);
    for (const x of [-0.98, 0.98]) {
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(x, 1.8, 0);
      this.holoRoot.add(cap);
    }

    // ── Head Core (telemetry node sphere) ──
    const headGeo = new THREE.SphereGeometry(0.48, 24, 24);
    const headMat = this._makeMaterial(0xFFD700, 0xFF9900, 0.28);
    this.head = new THREE.Mesh(headGeo, headMat);
    this.head.position.y = 3.1;
    this.holoRoot.add(this.head);

    // Head edge wire
    const headEdge = new THREE.EdgesGeometry(new THREE.SphereGeometry(0.48, 14, 10));
    const headLine = new THREE.LineSegments(headEdge, this._makeEdgeMaterial(0xFFD700));
    headLine.position.y = 3.1;
    this.holoRoot.add(headLine);

    // Cranial crown ring
    const crownGeo = new THREE.TorusGeometry(0.5, 0.025, 6, 28);
    const crownMat = new THREE.MeshPhongMaterial({
      color: 0xFFD700, emissive: 0xFF9933,
      emissiveIntensity: 1.2,
      transparent: true, opacity: 0.85,
    });
    const crown = new THREE.Mesh(crownGeo, crownMat);
    crown.position.y = 3.18;
    this.holoRoot.add(crown);

    // ── Legs ──
    for (const side of [-1, 1]) {
      // Upper leg
      const ulGeo = new THREE.CylinderGeometry(0.14, 0.11, 1.3, 10);
      const ulMat = this._makeMaterial(0x4A2E2B, 0xFF5500, 0.32);
      const ul = new THREE.Mesh(ulGeo, ulMat);
      ul.position.set(side * 0.35, -1.45, 0.04);
      this.holoRoot.add(ul);

      // Lower leg
      const llGeo = new THREE.CylinderGeometry(0.1, 0.08, 1.3, 10);
      const ll = new THREE.Mesh(llGeo, ulMat.clone());
      ll.position.set(side * 0.38, -2.7, 0.08);
      this.holoRoot.add(ll);

      // Foot
      const footGeo = new THREE.BoxGeometry(0.18, 0.12, 0.42);
      const footMat = this._makeMaterial(0xD9A05B, 0xFF6600, 0.5);
      const foot = new THREE.Mesh(footGeo, footMat);
      foot.position.set(side * 0.38, -3.42, 0.15);
      this.holoRoot.add(foot);
    }

    // ── WING GROUPS ──
    this.wingGroupLeft  = new THREE.Group();
    this.wingGroupRight = new THREE.Group();
    this.wingGroupLeft.position.set(-0.98, 1.8, 0);
    this.wingGroupRight.position.set( 0.98, 1.8, 0);
    this.holoRoot.add(this.wingGroupLeft);
    this.holoRoot.add(this.wingGroupRight);

    this._buildWing(this.wingGroupLeft,  -1);
    this._buildWing(this.wingGroupRight,  1);

    // ── CAPE GEOMETRY ──
    this._buildCape();
  }

  _buildWing(group, side) {
    // Primary spar (thin cylinder along wing span)
    const sparGeo = new THREE.CylinderGeometry(0.04, 0.025, 8.2, 8);
    const sparMat = new THREE.MeshPhongMaterial({
      color:     0xE6E6FA,
      emissive:  0xAAAAAA,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.85,
    });
    const spar = new THREE.Mesh(sparGeo, sparMat);
    spar.rotation.z = side * Math.PI / 2;
    spar.position.set(side * 4.2, 0, 0);
    group.add(spar);

    // Wing blade surface (thin tapered box geometry simulating blade planform)
    const bladeGeo = new THREE.BoxGeometry(8.0, 0.04, 1.0);
    const bladeMat = this._makeMaterial(0x8888CC, 0xB0B0F0, 0.18);
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(side * 4.0, 0, 0);
    // Slight taper and twist via scale
    blade.scale.set(1, 1, 1);
    group.add(blade);

    // Blade edge highlight
    const bladeEdge = new THREE.EdgesGeometry(new THREE.BoxGeometry(8.0, 0.04, 1.0));
    const bladeEdgeLine = new THREE.LineSegments(
      bladeEdge,
      this._makeEdgeMaterial(0xB0B0FF)
    );
    bladeEdgeLine.position.set(side * 4.0, 0, 0);
    group.add(bladeEdgeLine);

    // Secondary rib lines along wing chord
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const ribGeo = new THREE.BoxGeometry(0.03, 0.06, 1.0 - t * 0.5);
      const ribMat = this._makeMaterial(0xE6E6FA, 0x9999FF, 0.5);
      const rib = new THREE.Mesh(ribGeo, ribMat);
      rib.position.set(side * (0.6 + t * 7.4), 0, 0);
      group.add(rib);
    }

    // Wingtip glow sphere
    const tipGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const tipMat = new THREE.MeshPhongMaterial({
      color:    0xE6E6FA,
      emissive: 0xAAAAAA,
      emissiveIntensity: 1.5,
      transparent: true, opacity: 0.9,
    });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.set(side * 8.6, 0, 0);
    group.add(tip);

    // Store reference so we can target opacity
    group.userData.blade = blade;
    group.userData.bladeMat = bladeMat;
    group.userData.spar  = spar;
  }

  _buildCape() {
    // Cape: swept cone-like geometry along the rear spine
    this.capeGroup = new THREE.Group();
    this.holoRoot.add(this.capeGroup);

    // Main cape drape — tapered cylinder (open-ended, DoubleSide)
    const capeGeo = new THREE.CylinderGeometry(0.18, 1.45, 4.2, 20, 1, true);
    const capeMat = new THREE.MeshPhongMaterial({
      color:      0xFFD700,
      emissive:   0xCC7700,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity:    0.0,   // starts hidden
      side:       THREE.DoubleSide,
      shininess:  80,
      specular:   new THREE.Color(0xFFEE88),
      depthWrite: false,
    });
    this.capeMesh = new THREE.Mesh(capeGeo, capeMat);
    this.capeMesh.position.set(0, -0.6, -0.55);
    this.capeMesh.rotation.x = -0.22;
    this.capeGroup.add(this.capeMesh);

    // Cape edge wireframe for structural line definition
    const capeEdge = new THREE.EdgesGeometry(
      new THREE.CylinderGeometry(0.18, 1.45, 4.2, 20, 1, true)
    );
    this.capeEdgeMat = new THREE.LineBasicMaterial({
      color: 0xFFD700,
      transparent: true,
      opacity: 0.0,
    });
    this.capeLines = new THREE.LineSegments(capeEdge, this.capeEdgeMat);
    this.capeLines.position.set(0, -0.6, -0.55);
    this.capeLines.rotation.x = -0.22;
    this.capeGroup.add(this.capeLines);

    // Cape inner surface
    const innerGeo = new THREE.CylinderGeometry(0.15, 1.38, 4.0, 20, 1, true);
    const innerMat = new THREE.MeshPhongMaterial({
      color:      0xCC8800,
      emissive:   0x884400,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity:    0.0,
      side:       THREE.BackSide,
      depthWrite: false,
    });
    this.capeInner = new THREE.Mesh(innerGeo, innerMat);
    this.capeInner.position.set(0, -0.6, -0.55);
    this.capeInner.rotation.x = -0.22;
    this.capeGroup.add(this.capeInner);

    // Store materials for alpha tweening
    this._capeMaterials = [capeMat, innerMat];
  }

  /* ── Camera Orbit Update ───────────────────────────────── */

  _updateCamera() {
    const phi   = clamp(this.orbitPhi, 0.05, Math.PI * 0.9);
    const x = this.orbitRadius * Math.sin(phi) * Math.sin(this.orbitTheta);
    const y = this.orbitRadius * Math.cos(phi);
    const z = this.orbitRadius * Math.sin(phi) * Math.cos(this.orbitTheta);
    this.camera.position.set(x, y + 0.5, z);
    this.camera.lookAt(0, 0.5, 0);

    // Update coords display
    const coordEl = document.getElementById('viewport-coords');
    if (coordEl) {
      coordEl.textContent =
        `CAM: θ=${this.orbitTheta.toFixed(2)} φ=${phi.toFixed(2)} r=${this.orbitRadius.toFixed(1)}`;
    }
  }

  /* ── Controls Binding ──────────────────────────────────── */

  _bindControls() {
    const canvas = this.canvas;

    // ─ Mouse drag orbit ─
    canvas.addEventListener('mousedown', e => {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    window.addEventListener('mousemove', e => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.orbitTheta -= dx * 0.008;
      this.orbitPhi   += dy * 0.008;
      this.orbitPhi    = clamp(this.orbitPhi, 0.1, Math.PI * 0.85);
      this.lastMouseX  = e.clientX;
      this.lastMouseY  = e.clientY;
      this._updateCamera();
    });

    window.addEventListener('mouseup', () => { this.isDragging = false; });

    // ─ Touch orbit ─
    canvas.addEventListener('touchstart', e => {
      this.isDragging = true;
      this.lastMouseX = e.touches[0].clientX;
      this.lastMouseY = e.touches[0].clientY;
    }, { passive: true });

    canvas.addEventListener('touchmove', e => {
      if (!this.isDragging) return;
      const dx = e.touches[0].clientX - this.lastMouseX;
      const dy = e.touches[0].clientY - this.lastMouseY;
      this.orbitTheta -= dx * 0.01;
      this.orbitPhi   += dy * 0.01;
      this.orbitPhi    = clamp(this.orbitPhi, 0.1, Math.PI * 0.85);
      this.lastMouseX  = e.touches[0].clientX;
      this.lastMouseY  = e.touches[0].clientY;
      this._updateCamera();
    }, { passive: true });

    canvas.addEventListener('touchend', () => { this.isDragging = false; });

    // ─ Scroll wheel zoom ─
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.orbitRadius = clamp(this.orbitRadius + e.deltaY * 0.018, 6, 40);
      this._updateCamera();
    }, { passive: false });

    // ─ Mode toggle button ─
    const toggleBtn = document.getElementById('btn-toggle-mode');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this._toggleMode());
    }

    // ─ Resize ─
    window.addEventListener('resize', () => this.onResize());
  }

  _toggleMode() {
    this.mode = this.mode === 'flight' ? 'cape' : 'flight';

    const labelEl    = document.getElementById('toggle-mode-label');
    const modeLabel  = document.getElementById('mode-label');
    const indicator  = document.getElementById('mode-indicator');

    if (this.mode === 'flight') {
      if (labelEl)   labelEl.textContent   = 'SWITCH TO CAPE MODE';
      if (modeLabel) modeLabel.textContent = '⊕ WING FLIGHT MODE';
      if (indicator) { indicator.classList.remove('cape'); }
    } else {
      if (labelEl)   labelEl.textContent   = 'SWITCH TO FLIGHT MODE';
      if (modeLabel) modeLabel.textContent = '⊕ CAPE SOAR MODE';
      if (indicator) { indicator.classList.add('cape'); }
    }
  }

  /* ── Resize Handler ────────────────────────────────────── */

  onResize() {
    const W = this.container.clientWidth;
    const H = this.container.clientHeight;
    if (!W || !H) return;
    this.renderer.setSize(W, H);
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
  }

  /* ── Animation Loop ────────────────────────────────────── */

  _startLoop() {
    const animate = () => {
      requestAnimationFrame(animate);
      this._update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  _update() {
    this.clock += 0.016; // ~60fps tick
    const t = this.clock;

    // ── Wing / Cape alpha tween ──
    const targetWingAlpha = this.mode === 'flight' ? 1.0 : 0.0;
    const targetCapeAlpha = this.mode === 'cape'   ? 1.0 : 0.0;
    this.wingAlpha = lerp(this.wingAlpha, targetWingAlpha, 0.06);
    this.capeAlpha = lerp(this.capeAlpha, targetCapeAlpha, 0.06);

    // Apply wing alpha
    [this.wingGroupLeft, this.wingGroupRight].forEach(grp => {
      grp.traverse(obj => {
        if (obj.material) {
          obj.material.opacity = clamp(obj.material.opacity +
            (this.wingAlpha > 0.5 ? 0.05 : -0.05) *
            (obj.material.opacity < this.wingAlpha ? 1 : 1), 0, 0.92);
          // Simpler approach: direct set
        }
      });
      grp.visible = this.wingAlpha > 0.02;
    });

    // Apply cape alpha
    this._capeMaterials.forEach(mat => {
      mat.opacity = lerp(mat.opacity, this.capeAlpha * (mat === this._capeMaterials[0] ? 0.38 : 0.22), 0.06);
    });
    this.capeEdgeMat.opacity = lerp(this.capeEdgeMat.opacity, this.capeAlpha * 0.5, 0.06);

    // ── Wing Animation by flight mode ──
    if (this.mode === 'flight') {
      this._animateWings(t);
    }

    // ── Hologram gentle hover bob ──
    this.holoRoot.position.y = Math.sin(t * 0.6) * 0.12;

    // ── Head gentle pulse ──
    if (this.head) {
      const pulse = 1.0 + Math.sin(t * 2.2) * 0.025;
      this.head.scale.setScalar(pulse);
    }

    // ── Cape subtle sway when visible ──
    if (this.capeAlpha > 0.1) {
      this.capeGroup.rotation.z = Math.sin(t * 0.8) * 0.04;
      this.capeGroup.rotation.x = Math.sin(t * 0.55) * 0.02;
    }
  }

  _animateWings(t) {
    let freq, amplitude, cross;

    switch (this.flightMode) {
      case 'cruising':
        freq      = 0.8;
        amplitude = 0.42;
        cross     = 0;
        break;
      case 'subsonic':
        freq      = 2.8;
        amplitude = 0.55;
        cross     = 0.08;
        break;
      case 'extreme':
        freq      = 12.0;
        amplitude = 0.28;
        cross     = 0.35;
        break;
      default:
        freq      = 0.8;
        amplitude = 0.42;
        cross     = 0;
    }

    // Left wing: flap up-down on Z axis, micro-twist on X in extreme mode
    const leftFlap  = Math.sin(t * freq) * amplitude;
    const leftTwist = cross > 0 ? Math.cos(t * freq * 1.1) * cross : 0;

    this.wingGroupLeft.rotation.z  =  leftFlap;
    this.wingGroupLeft.rotation.x  =  leftTwist;

    // Right wing: mirror
    const rightFlap  = Math.sin(t * freq + Math.PI) * amplitude;
    const rightTwist = cross > 0 ? Math.cos(t * freq * 1.1 + Math.PI * 0.6) * cross : 0;

    this.wingGroupRight.rotation.z  = -rightFlap;
    this.wingGroupRight.rotation.x  =  rightTwist;

    // In extreme mode: add Y-axis micro-vibration
    if (this.flightMode === 'extreme') {
      const vib = Math.sin(t * 24) * 0.018;
      this.wingGroupLeft.rotation.y  =  vib;
      this.wingGroupRight.rotation.y = -vib;
    } else {
      this.wingGroupLeft.rotation.y  = 0;
      this.wingGroupRight.rotation.y = 0;
    }
  }

  setFlightMode(mode) {
    this.flightMode = mode;
  }
}

/* ─────────────────────────────────────────────────────────────
   4. DYNAMICS ENGINE — Physics Simulation & Live Metrics
───────────────────────────────────────────────────────────── */

class DynamicsEngine {
  constructor() {
    // State
    this.payload     = 0;       // metric tons
    this.flightMode  = 'cruising';
    this.capacitor   = 100.0;   // %
    this.ticking     = false;

    // Computed metrics
    this.powerMW     = 0;
    this.metabolic   = 0;
    this.jointStress = 0;
    this.wingFreq    = 0.25;

    // Drain rate per second at each flight mode
    this.DRAIN = {
      cruising: 0.04,
      subsonic: 0.16,
      extreme:  0.42,
    };

    // Base values per mode (before payload scaling)
    this.BASE = {
      cruising: { power: 1.4,  metabolic: 3200,  stress: 12.0, freq: 0.25 },
      subsonic: { power: 8.6,  metabolic: 14800, stress: 41.0, freq: 1.40 },
      extreme:  { power: 22.4, metabolic: 38400, stress: 84.0, freq: 2.80 },
    };

    this._bindUI();
    this._startTick();
  }

  _bindUI() {
    // Payload slider
    const payloadSlider = document.getElementById('payload-slider');
    const payloadDisplay = document.getElementById('payload-display');
    if (payloadSlider) {
      payloadSlider.addEventListener('input', () => {
        this.payload = parseInt(payloadSlider.value, 10);
        if (payloadDisplay) payloadDisplay.textContent = `${this.payload} MT`;
        this._computeMetrics();
      });
    }

    // Flight mode buttons
    const modeBtns = document.querySelectorAll('.flight-mode-btn');
    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        modeBtns.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');
        this.flightMode = btn.dataset.mode;
        this._computeMetrics();
        // Sync with hologram
        if (window.garudaHologram) {
          window.garudaHologram.setFlightMode(this.flightMode);
        }
        SimulationLog.push(
          `Flight mode changed → ${this.flightMode.toUpperCase()}`,
          this.flightMode === 'extreme' ? 'warn' : ''
        );
      });
    });

    // Replenish button
    const replenishBtn = document.getElementById('btn-replenish');
    if (replenishBtn) {
      replenishBtn.addEventListener('click', () => {
        if (this.capacitor >= 100) return;
        this.capacitor = 100.0;
        this._updateCapacitorUI();
        SimulationLog.push('⚡ Energy reserves replenished to 100%', 'warn');
        replenishBtn.disabled = true;
        setTimeout(() => { replenishBtn.disabled = false; }, 3000);
      });
    }
  }

  _computeMetrics() {
    const base = this.BASE[this.flightMode] || this.BASE.cruising;
    const payloadFactor = 1 + (this.payload / 250) * 2.8;
    const capFactor     = clamp(this.capacitor / 100, 0.1, 1.0);

    this.powerMW     = base.power     * payloadFactor * capFactor;
    this.metabolic   = base.metabolic * payloadFactor * capFactor;
    this.jointStress = clamp(base.stress * payloadFactor, 0, 100);
    this.wingFreq    = base.freq * clamp(capFactor + 0.05, 0.1, 1.2);
  }

  _startTick() {
    this._computeMetrics();
    this._updateUI();

    setInterval(() => {
      // Drain capacitor under load
      if (this.capacitor > 0) {
        const drain = this.DRAIN[this.flightMode] || 0.04;
        const payloadExtra = (this.payload / 250) * drain * 1.5;
        this.capacitor = clamp(this.capacitor - (drain + payloadExtra), 0, 100);
        if (this.capacitor <= 0) {
          SimulationLog.push('⚠ CAPACITOR DEPLETED — Replenish reserves immediately', 'crit');
        } else if (this.capacitor <= 15 && Math.random() < 0.15) {
          SimulationLog.push('Low energy reserve: ' + this.capacitor.toFixed(1) + '%', 'warn');
        }
      }

      this._computeMetrics();
      this._updateUI();
    }, 300);

    // Occasional random simulation log entries
    setInterval(() => {
      this._randomLog();
    }, 4200);
  }

  _updateUI() {
    // Power
    const powerEl = document.getElementById('metric-power');
    const barPower = document.getElementById('bar-power');
    if (powerEl) {
      powerEl.textContent = formatNum(this.powerMW, 1);
      const pct = clamp((this.powerMW / 80) * 100, 0, 100);
      this._setMetricColor(powerEl, this.powerMW, 12, 25);
      if (barPower) barPower.style.width = pct + '%';
    }

    // Metabolic
    const metaEl = document.getElementById('metric-metabolic');
    const barMeta = document.getElementById('bar-metabolic');
    if (metaEl) {
      metaEl.textContent = Math.round(this.metabolic).toLocaleString();
      const pct = clamp((this.metabolic / 120000) * 100, 0, 100);
      this._setMetricColor(metaEl, this.metabolic, 20000, 60000);
      if (barMeta) barMeta.style.width = pct + '%';
    }

    // Joint Stress
    const stressEl = document.getElementById('metric-stress');
    const barStress = document.getElementById('bar-stress');
    if (stressEl) {
      stressEl.textContent = formatNum(this.jointStress, 1);
      const pct = clamp(this.jointStress, 0, 100);
      this._setMetricColor(stressEl, this.jointStress, 50, 80);
      if (barStress) barStress.style.width = pct + '%';
    }

    // Wing Frequency
    const freqEl = document.getElementById('metric-freq');
    const barFreq = document.getElementById('bar-freq');
    if (freqEl) {
      freqEl.textContent = formatNum(this.wingFreq, 2);
      const pct = clamp((this.wingFreq / 3.5) * 100, 0, 100);
      if (barFreq) barFreq.style.width = pct + '%';
    }

    // Capacitor
    this._updateCapacitorUI();
  }

  _updateCapacitorUI() {
    const pctEl  = document.getElementById('cap-pct');
    const barEl  = document.getElementById('cap-bar');
    const statEl = document.getElementById('cap-status');

    if (pctEl)  pctEl.textContent  = Math.round(this.capacitor) + '%';
    if (barEl) {
      barEl.style.width = this.capacitor + '%';
      if (this.capacitor <= 10) {
        barEl.classList.add('depleted');
      } else {
        barEl.classList.remove('depleted');
      }
    }
    if (statEl) {
      if (this.capacitor >= 80) {
        statEl.textContent = 'Reserve status: FULLY CHARGED · All systems nominal';
      } else if (this.capacitor >= 40) {
        statEl.textContent = `Reserve status: NOMINAL (${Math.round(this.capacitor)}%) · Monitoring depletion rate`;
      } else if (this.capacitor >= 15) {
        statEl.textContent = `⚠ Reserve status: LOW (${Math.round(this.capacitor)}%) · Consider replenishment`;
      } else if (this.capacitor > 0) {
        statEl.textContent = `⛔ CRITICAL: ${Math.round(this.capacitor)}% — REPLENISH IMMEDIATELY`;
      } else {
        statEl.textContent = '⛔ CAPACITOR DEPLETED — Performance severely degraded';
      }
    }
  }

  _setMetricColor(el, val, warnThreshold, critThreshold) {
    el.classList.remove('warning', 'critical');
    if (val >= critThreshold) {
      el.classList.add('critical');
    } else if (val >= warnThreshold) {
      el.classList.add('warning');
    }
  }

  _randomLog() {
    const messages = {
      cruising: [
        'Aerodynamic trim nominal · L/D ratio: 24.8',
        'Capillary buffer: pre-loaded · Substrate delivery optimal',
        'AVS transducers: standby · Acoustic signature: minimal',
        'Shoulder joint temp: 34.2°C · Within nominal range',
        'Neural routing cortex: baseline activity',
        'Spinal fluid pressure: 2.31 kPa · Nominal',
        'Carbon-weave actuators: 847 groups active · Load: ' + Math.round(8 + Math.random()*5) + '%',
      ],
      subsonic: [
        'AVS transducers: ACTIVE · Wing vortex seeding engaged',
        'Leading-edge vortex coherence: HIGH',
        'Metabolic substrate delivery: accelerated',
        'Bearing race lubrication: recirculating at 0.8 MPa',
        'Nitinol morphing arrays: active · Camber profile transitioning',
        'Wing root bending moment: ' + formatNum(0.8 + Math.random() * 0.3, 2) + ' × 10⁶ N·m',
        'Anti-friction coils: ENGAGED at GSJ-1 and GSJ-2',
      ],
      extreme: [
        '⚠ EXTREME MODE: AVS output 184 dB SPL — standoff distance enforced',
        '⚠ Wing root bending moment approaching design limit (safety factor 1.35)',
        'Drone-frequency propulsion augmentation: +14.7% thrust active',
        'Acoustic streaming: internal metabolite convection ACCELERATED',
        '⚠ Joint stress level elevated · Monitoring fatigue accumulation',
        'Mk-IV SynMito arrays: maximum ATP flux · ' + Math.round(35000 + Math.random()*3000) + ' W output',
        'Phosphocreatine buffer: DEPLETING · Lipid mobilization: MAX RATE',
      ],
    };

    const pool = messages[this.flightMode] || messages.cruising;
    const msg  = pool[Math.floor(Math.random() * pool.length)];
    const type = this.flightMode === 'extreme' ? 'warn' : '';
    SimulationLog.push(msg, type);
  }
}

/* ─────────────────────────────────────────────────────────────
   5. SIMULATION LOG
───────────────────────────────────────────────────────────── */

const SimulationLog = {
  _el: null,
  _lines: [],
  _maxLines: 80,

  init() {
    this._el = document.getElementById('sim-readout');
    this.push('System initialised · Project GARUDA Biomechanical Framework Rev. IV', '');
    this.push('Three.js holographic renderer: ONLINE', '');
    this.push('Dynamics simulation engine: ACTIVE', '');
    this.push('All structural subsystems: NOMINAL', '');
  },

  push(msg, type = '') {
    this._lines.push({ msg, type });
    if (this._lines.length > this._maxLines) {
      this._lines.shift();
    }
    this._render();
  },

  _render() {
    if (!this._el) return;
    const now = new Date();
    const ts  = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

    // Only append last line for performance
    const lastEntry = this._lines[this._lines.length - 1];
    const line = document.createElement('div');
    line.className = 'readout-line';
    line.innerHTML = `
      <span class="readout-timestamp">${ts}</span>
      <span class="readout-msg ${lastEntry.type}">${lastEntry.msg}</span>
    `;
    this._el.appendChild(line);
    // Keep scroll at bottom
    this._el.scrollTop = this._el.scrollHeight;

    // Prune DOM if too many nodes
    while (this._el.children.length > this._maxLines) {
      this._el.removeChild(this._el.firstChild);
    }
  },
};

/* ─────────────────────────────────────────────────────────────
   BOOTSTRAP — Wait for Three.js to load
───────────────────────────────────────────────────────────── */

function bootGaruda() {
  // Check Three.js availability
  if (typeof THREE === 'undefined') {
    console.warn('Three.js not yet loaded. Retrying...');
    setTimeout(bootGaruda, 120);
    return;
  }

  // Modules
  const tabs       = new TabController();
  const accordion  = new ChapterAccordion();
  const hologram   = new GarudaHologram('garuda-canvas');
  const dynamics   = new DynamicsEngine();
  SimulationLog.init();

  // Initial hologram sizing
  setTimeout(() => hologram.onResize(), 200);
}

// Wait for DOM + scripts
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootGaruda);
} else {
  bootGaruda();
}
