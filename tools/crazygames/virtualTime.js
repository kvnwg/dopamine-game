// Injected before the game loads (Playwright addInitScript): a virtual clock for frame-perfect capture.
// Once window.__vt.start() runs, requestAnimationFrame, timers, performance.now and Date.now only move when
// window.__vt.step(ms) is called, and CSS / Web animations are advanced by hand on the same clock. Each
// recorded frame is then exactly 1/30 s of game time, however slowly the browser renders it.
(() => {
  const real = {
    raf: window.requestAnimationFrame.bind(window),
    caf: window.cancelAnimationFrame.bind(window),
    now: performance.now.bind(performance),
    dateNow: Date.now,
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    setInterval: window.setInterval.bind(window),
    clearInterval: window.clearInterval.bind(window),
  };
  const vt = { on: false, t: 0, dateBase: 0, next: 1e9, rafs: new Map(), timers: new Map() };
  const RealDate = Date;
  window.__vt = vt;

  performance.now = () => (vt.on ? vt.t : real.now());
  Date.now = () => (vt.on ? Math.round(vt.dateBase + vt.t) : real.dateNow());
  window.Date = class extends RealDate {
    constructor(...a) {
      if (a.length === 0 && vt.on) super(Math.round(vt.dateBase + vt.t));
      else super(...a);
    }
    static now() {
      return Date.now();
    }
  };
  window.Date.now = () => (vt.on ? Math.round(vt.dateBase + vt.t) : real.dateNow());

  window.requestAnimationFrame = (cb) => {
    if (!vt.on) return real.raf(cb);
    const id = vt.next++;
    vt.rafs.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    if (id >= 1e9) vt.rafs.delete(id);
    else real.caf(id);
  };
  const addTimer = (fn, ms, args, every) => {
    const id = vt.next++;
    const d = Math.max(0, Number(ms) || 0);
    vt.timers.set(id, { at: vt.t + d, fn, args, every: every ? Math.max(1, d) : 0 });
    return id;
  };
  window.setTimeout = (fn, ms, ...args) => (vt.on ? addTimer(fn, ms, args, false) : real.setTimeout(fn, ms, ...args));
  window.setInterval = (fn, ms, ...args) => (vt.on ? addTimer(fn, ms, args, true) : real.setInterval(fn, ms, ...args));
  window.clearTimeout = (id) => (id >= 1e9 ? vt.timers.delete(id) : real.clearTimeout(id));
  window.clearInterval = (id) => (id >= 1e9 ? vt.timers.delete(id) : real.clearInterval(id));

  const call = (fn, args) => {
    try {
      typeof fn === 'function' ? fn(...(args || [])) : 0;
    } catch (e) {
      console.error(e);
    }
  };

  vt.start = () => {
    if (vt.on) return;
    vt.t = real.now();
    vt.dateBase = real.dateNow() - vt.t;
    vt.on = true;
  };
  /** Moves the clock `ms` forward: due timers in order, then one animation frame, then CSS animations. */
  vt.step = (ms) => {
    const end = vt.t + ms;
    for (let guard = 0; guard < 10000; guard++) {
      let id = null;
      let due = null;
      for (const [k, tm] of vt.timers) if (tm.at <= end && (!due || tm.at < due.at)) [id, due] = [k, tm];
      if (!due) break;
      vt.t = Math.max(vt.t, due.at);
      if (due.every) due.at += due.every;
      else vt.timers.delete(id);
      call(due.fn, due.args);
    }
    vt.t = end;
    const cbs = [...vt.rafs.values()];
    vt.rafs.clear();
    for (const cb of cbs) call(cb, [vt.t]);
    for (const a of document.getAnimations()) {
      try {
        if (a.playState === 'finished') continue;
        if (a.playState !== 'paused') a.pause();
        a.currentTime = (Number(a.currentTime) || 0) + ms;
      } catch {
        /* ignore */
      }
    }
  };
})();
