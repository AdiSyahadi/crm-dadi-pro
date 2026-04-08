let audioCtx: AudioContext | null = null;

/** Play a short two-tone beep using Web Audio API (no file needed). */
export function playNotificationSound() {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1046, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // audio not available
  }
}

/** Show a browser notification (only if tab is unfocused and permission granted). */
export function showBrowserNotification(title: string, body?: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (window.Notification.permission !== 'granted') return;
  if (document.hasFocus()) return;
  try {
    new window.Notification(title, {
      body: body || undefined,
      icon: '/favicon.ico',
      tag: 'crm-notif',
    });
  } catch {
    // not supported
  }
}

/** Request browser notification permission (call once on app mount). */
export function requestNotificationPermission() {
  if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'default') {
    window.Notification.requestPermission();
  }
}
