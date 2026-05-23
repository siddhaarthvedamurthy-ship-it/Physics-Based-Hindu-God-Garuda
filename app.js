// Global Routing Controls
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    if (event) event.currentTarget.classList.add('active');
}

// Global 3D Graphics Engine Variables
let scene, camera, renderer;
let skeletonCore, leftWingObject, rightWingObject, capeObject;
let isWingsExpanded = true;
let wingRotationAngle = 0;
let flightOutputSpeed = 1;

// Initialize the true 3D Environment Space
function init3DViewport() {
    const container = document.getElementById('canvas-container');
    if (!container) return;

    // Build the virtual environment setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06080c);

    // Camera perspective angles
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 2, 25);

    // Renderer core setting
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.innerHTML = ''; // Clean old housefly fragments completely
    container.appendChild(renderer.domElement);

    // High-tech environmental lighting overlays
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0x00e5ff, 0.8);
    directionalLight1.position.set(5, 10, 7);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xd4af37, 0.5);
    directionalLight2.position.set(-5, -5, 5);
    scene.add(directionalLight2);

    // Create the Core Chassis Group (15ft Dark Marble/Titanium Giant)
    const garudaGroup = new THREE.Group();

    // 1. Torso Center Mass
    const torsoGeom = new THREE.CylinderGeometry(0.8, 0.4, 4, 16);
    const darkMarbleMat = new THREE.MeshStandardMaterial({ color: 0x1a2230, roughness: 0.2, metalness: 0.8 });
    const torsoMesh = new THREE.Mesh(torsoGeom, darkMarbleMat);
    torsoMesh.position.y = 0;
    garudaGroup.add(torsoMesh);

    // 2. Head Piece (Cranial System Core)
    const headGeom = new THREE.SphereGeometry(0.6, 16, 16);
    const glowingBlueMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 0.4 });
    const headMesh = new THREE.Mesh(headGeom, glowingBlueMat);
    headMesh.position.y = 2.6;
    garudaGroup.add(headMesh);

    // 3. Titanium Internal Skeleton Line Anchor Tracking
    const spineGeom = new THREE.CylinderGeometry(0.1, 0.1, 4.5, 8);
    const titaniumMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 1, roughness: 0.1 });
    const spineMesh = new THREE.Mesh(spineGeom, titaniumMat);
    spineMesh.position.set(0, 0, -0.2);
    garudaGroup.add(spineMesh);

    // 4. Left 10-Meter Wing Blade (Carbon Fiber Array)
    leftWingObject = new THREE.Group();
    const wingBladeGeomL = new THREE.BoxGeometry(10, 1.5, 0.1);
    const carbonFiberMat = new THREE.MeshStandardMaterial({ color: 0x121620, roughness: 0.5, metalness: 0.6 });
    const wingBladeMeshL = new THREE.Mesh(wingBladeGeomL, carbonFiberMat);
    wingBladeMeshL.position.x = -5; // Pivot from shoulder socket boundary anchor
    leftWingObject.add(wingBladeMeshL);
    leftWingObject.position.set(-0.8, 1.5, 0);
    garudaGroup.add(leftWingObject);

    // 5. Right 10-Meter Wing Blade (Carbon Fiber Array)
    rightWingObject = new THREE.Group();
    const wingBladeGeomR = new THREE.BoxGeometry(10, 1.5, 0.1);
    const wingBladeMeshR = new THREE.Mesh(wingBladeGeomR, carbonFiberMat);
    wingBladeMeshR.position.x = 5; // Pivot from shoulder socket boundary anchor
    rightWingObject.add(wingBladeMeshR);
    rightWingObject.position.set(0.8, 1.5, 0);
    garudaGroup.add(rightWingObject);

    // 6. Impact-Resistant Cape Shell Overlay (Ground Trench Coat configuration)
    const capeGeom = new THREE.ConeGeometry(1.5, 5, 4, 1, true);
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.7, side: THREE.DoubleSide });
    capeObject = new THREE.Mesh(capeGeom, goldMat);
    capeObject.position.set(0, -1, -0.5);
    capeObject.rotation.x = Math.PI;
    capeObject.visible = false; // Hidden in initial flight output states
    garudaGroup.add(capeObject);

    scene.add(garudaGroup);
    skeletonCore = garudaGroup;

    // Mouse Interaction Event Listeners for True Drag Rotation Viewports
    let isDragging = false;
    let basePointerX = 0;
    let basePointerY = 0;

    container.addEventListener('mousedown', (e) => {
        isDragging = true;
        basePointerX = e.clientX;
        basePointerY = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - basePointerX;
        const deltaY = e.clientY - basePointerY;

        skeletonCore.rotation.y += deltaX * 0.01;
        skeletonCore.rotation.x += deltaY * 0.01;

        basePointerX = e.clientX;
        basePointerY = e.clientY;
    });

    window.addEventListener('mouseup', () => { isDragging = false; });

    // Handle Scroll Wheels for true depth zoom actions
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        camera.position.z += e.deltaY * 0.02;
        if (camera.position.z < 5) camera.position.z = 5;
        if (camera.position.z > 50) camera.position.z = 50;
    });

    // Execute Frame Engine Loops
    animate3DScene();
}

// True Dynamic Wing Vibration loop execution engine
function animate3DScene() {
    requestAnimationFrame(animate3DScene);

    if (isWingsExpanded) {
        // High-torque drone frequency calculation variables
        let frequencyFactor = 0.05;
        if (flightOutputSpeed === 2) frequencyFactor = 0.25;
        if (flightOutputSpeed === 3) frequencyFactor = 0.75;

        wingRotationAngle += frequencyFactor;
        
        // Simulates true mechanical physical flapping up-down oscillations
        leftWingObject.rotation.z = Math.sin(wingRotationAngle) * 0.2;
        rightWingObject.rotation.z = -Math.sin(wingRotationAngle) * 0.2;
        
        // Simulates high speed helicopter/drone vibration stability twisting micro angles
        leftWingObject.rotation.y = Math.cos(wingRotationAngle) * 0.05;
        rightWingObject.rotation.y = -Math.cos(wingRotationAngle) * 0.05;
    }

    renderer.render(scene, camera);
}

// Handles switching model layers completely when user switches layouts
function toggleWingState() {
    isWingsExpanded = !isWingsExpanded;
    const btn = document.getElementById('wingToggleBtn');

    if (isWingsExpanded) {
        leftWingObject.visible = true;
        rightWingObject.visible = true;
        capeObject.visible = false;
        btn.innerText = "Toggle Wing State: Flight Mode";
        btn.style.background = "var(--gold)";
    } else {
        leftWingObject.visible = false;
        rightWingObject.visible = false;
        capeObject.visible = true;
        
        // Structural lock variables initialization
        leftWingObject.rotation.set(0,0,0);
        rightWingObject.rotation.set(0,0,0);
        
        btn.innerText = "Toggle Wing State: Cape Mode";
        btn.style.background = "var(--danger)";
        btn.style.color = "#fff";
    }
}

// Interactive Simulation Engine Metric Drivers
let capacitorLevel = 100.0;
let activeInterval = null;

function updateSimulation() {
    const currentPayload = parseFloat(document.getElementById('loadSlider').value);
    const speedSetting = parseInt(document.getElementById('outputSlider').value);
    flightOutputSpeed = speedSetting;
    
    document.getElementById('loadVal').innerText = currentPayload;
    
    let speedText = "Cruising";
    let powerOutputBase = 0.45; 
    let metabolicBurn = 15000; 
    
    if (speedSetting === 2) {
        speedText = "Subsonic Dash";
        powerOutputBase = 4.2;
        metabolicBurn = 85000;
    } else if (speedSetting === 3) {
        speedText = "Extreme High-Torque Peak";
        powerOutputBase = 12.5;
        metabolicBurn = 2400000;
    }
    document.getElementById('outputVal').innerText = speedText;

    let totalPower = powerOutputBase + (currentPayload * 0.055);
    let totalBurn = metabolicBurn + (currentPayload * 15000);
    let skeletalStress = (currentPayload / 250) * 100;
    if (speedSetting === 3) skeletalStress += 15;

    if (skeletalStress > 100) skeletalStress = 100;

    document.getElementById('powerMetric').innerText = totalPower.toFixed(2) + " MW";
    document.getElementById('burnMetric').innerText = totalBurn.toLocaleString() + " kcal/hr equivalent";
    document.getElementById('stressMetric').innerText = skeletalStress.toFixed(1) + "% Max Limit";

    if (activeInterval) clearInterval(activeInterval);
    
    activeInterval = setInterval(() => {
        if (totalBurn > 50000) {
            let decayFactor = (totalBurn / 3000000);
            capacitorLevel -= decayFactor;
            if (capacitorLevel < 0) capacitorLevel = 0;
            document.getElementById('capacitorMetric').innerText = capacitorLevel.toFixed(2) + "%";
            
            if (capacitorLevel <= 0) {
                document.getElementById('capacitorMetric').style.color = "var(--danger)";
                document.getElementById('powerMetric').innerText = "0.00 MW (System Drained)";
            } else {
                document.getElementById('capacitorMetric').style.color = "var(--neon-blue)";
            }
        }
    }, 500);
}

function chargeCapacitor() {
    capacitorLevel = 100.0;
    document.getElementById('capacitorMetric').innerText = "100.0%";
    document.getElementById('capacitorMetric').style.color = "var(--neon-blue)";
    updateSimulation();
}

// Triggers execution configurations immediately upon view load setup
