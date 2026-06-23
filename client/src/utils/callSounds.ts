let outgoingInterval: ReturnType<typeof setInterval> | null = null;
let incomingInterval: ReturnType<typeof setInterval> | null = null;
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function createBeep(frequency: number, duration: number, volume = 0.3): void {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.value = volume;

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    osc.start(now);
    osc.stop(now + duration);
  } catch {
    // Audio not available
  }
}

function playRingBurst(): void {
  try {
    const ctx = getAudioContext();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.value = 440;
    osc2.type = 'sine';
    osc2.frequency.value = 480;

    gain.gain.value = 0;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 1.2);
    osc2.start(ctx.currentTime);
    osc2.stop(ctx.currentTime + 1.2);
  } catch {
    // Audio not available
  }
}

function playIncomingBurst(): void {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = 600;

    gain.gain.value = 0;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime + 0.3);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.3, ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.3, ctx.currentTime + 0.7);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.75);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1);
  } catch {
    // Audio not available
  }
}

export function playOutgoingRing(): void {
  stopAllSounds();
  playRingBurst();
  outgoingInterval = setInterval(() => playRingBurst(), 4000);
}

export function playIncomingRing(): void {
  stopAllSounds();
  playIncomingBurst();
  incomingInterval = setInterval(() => playIncomingBurst(), 2000);
}

export function playCallAccepted(): void {
  stopAllSounds();
  createBeep(800, 0.15);
  setTimeout(() => createBeep(1000, 0.15), 150);
  setTimeout(() => createBeep(1200, 0.2), 300);
}

export function playCallEnded(): void {
  stopAllSounds();
  createBeep(400, 0.1);
  setTimeout(() => createBeep(300, 0.15), 100);
  setTimeout(() => createBeep(200, 0.2), 200);
}

export function playCallRejected(): void {
  stopAllSounds();
  createBeep(300, 0.1);
  setTimeout(() => createBeep(200, 0.1), 150);
}

export function stopAllSounds(): void {
  if (outgoingInterval) {
    clearInterval(outgoingInterval);
    outgoingInterval = null;
  }
  if (incomingInterval) {
    clearInterval(incomingInterval);
    incomingInterval = null;
  }
}
