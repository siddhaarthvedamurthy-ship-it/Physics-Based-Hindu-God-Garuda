function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
}

let wingsExpanded = true;
function toggleWings() {
    wingsExpanded = !wingsExpanded;
    const leftWing = document.getElementById('leftWing');
    const rightWing = document.getElementById('rightWing');
    const wrappedWings = document.getElementById('wrappedWings');
    const btn = document.getElementById('wingToggleBtn');

    if (wingsExpanded) {
        leftWing.style.display = 'block';
        rightWing.style.display = 'block';
        wrappedWings.style.display = 'none';
        btn.innerText = "Toggle Wing State: Flight Mode";
        btn.style.background = "var(--gold)";
    } else {
        leftWing.style.display = 'none';
        rightWing.style.display = 'none';
        wrappedWings.style.display = 'block';
        btn.innerText = "Toggle Wing State: Cape Mode";
        btn.style.background = "var(--danger)";
        btn.style.color = "#fff";
    }
}

let capacitorLevel = 100.0;
let activeInterval = null;

function updateSimulation() {
    const currentPayload = parseFloat(document.getElementById('loadSlider').value);
    const speedSetting = parseInt(document.getElementById('outputSlider').value);
    
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

    if(skeletalStress > 100) skeletalStress = 100;

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

window.onload = function() {
    updateSimulation();
}
