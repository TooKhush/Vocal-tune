const startBtn = document.getElementById("start-btn");
const pitchFeedback = document.getElementById("pitchFeedback");
const paceFeedback = document.getElementById("paceFeedback");

let pitchData = [];
let paceData = [];
let wordsSpoken = 0;
let startTime = null;
let sessionId = Date.now(); // use timestamp as session ID

// --- Chart setup remains same ---
const pitchChart = new Chart(document.getElementById("pitchChart"), {
  type: 'line',
  data: {
    labels: [],
    datasets: [{
      label: 'Pitch (Hz)',
      data: [],
      borderColor: 'lime',
      fill: false,
      tension: 0.3
    }]
  },
  options: { animation: false }
});

const paceChart = new Chart(document.getElementById("paceChart"), {
  type: 'line',
  data: {
    labels: [],
    datasets: [{
      label: 'Pace (WPM)',
      data: [],
      borderColor: 'skyblue',
      fill: false,
      tension: 0.3
    }]
  },
  options: { animation: false }
});

// --- API Calls ---
async function sendSessionData(pitch, pace) {
  try {
    await fetch("https://yourapi.com/api/session-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sessionId,
        timestamp: new Date().toISOString(),
        pitch,
        pace
      })
    });
  } catch (err) {
    console.error("Failed to send session data", err);
  }
}

// --- Voice Tuning Logic ---
async function startTuning() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = audioCtx.createAnalyser();
  const micSource = audioCtx.createMediaStreamSource(stream);
  const processor = audioCtx.createScriptProcessor(2048, 1, 1);

  micSource.connect(analyser);
  analyser.connect(processor);
  processor.connect(audioCtx.destination);

  const buffer = new Float32Array(analyser.fftSize);
  startTime = Date.now();

  processor.onaudioprocess = async function () {
    analyser.getFloatTimeDomainData(buffer);
    const pitch = autoCorrelate(buffer, audioCtx.sampleRate);

    if (pitch > 80 && pitch < 1000) {
      pitchChart.data.labels.push('');
      pitchChart.data.datasets[0].data.push(pitch);
      pitchChart.update();
      pitchFeedback.textContent = `Pitch: ${pitch.toFixed(1)} Hz`;
    }

    // Simulated pace logic (could be refined)
    const elapsed = (Date.now() - startTime) / 60000;
    const pace = (wordsSpoken / (elapsed || 1)).toFixed(2);
    paceChart.data.labels.push('');
    paceChart.data.datasets[0].data.push(pace);
    paceChart.update();
    paceFeedback.textContent = `Pace: ${pace} WPM`;

    // Save to backend
    await sendSessionData(pitch, pace);
  };
}

// --- Auto Correlator stays same ---
function autoCorrelate(buffer, sampleRate) {
  let size = buffer.length;
  let rms = 0;
  for (let i = 0; i < size; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / size);
  if (rms < 0.01) return -1;

  let r1 = 0, r2 = size - 1, thres = 0.2;
  for (let i = 0; i < size / 2; i++) {
    if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
  }
  for (let i = 1; i < size / 2; i++) {
    if (Math.abs(buffer[size - i]) < thres) { r2 = size - i; break; }
  }

  buffer = buffer.slice(r1, r2);
  size = buffer.length;

  const c = new Array(size).fill(0);
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size - i; j++) {
      c[i] += buffer[j] * buffer[j + i];
    }
  }

  let d = 0;
  while (c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < size; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }

  return sampleRate / maxpos;
}

startBtn.addEventListener("click", startTuning);
