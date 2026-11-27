/*
 * game.js — controle do jogo: estados, teclado/toque, HUD, cálculos ao vivo e resultado.
 * Física em physics.js (stepJump), desenho em scene.js.
 * Estados: menu → plane (no avião) → jump (salto) → end (resultado)
 */
(function () {
  'use strict';
  const P = window.Physics;
  const $ = (id) => document.getElementById(id);

  // ---------- formatação pt-BR ----------
  const nf = {};
  function fmt(x, d) {
    d = d || 0;
    if (!Number.isFinite(x)) return '—';
    if (Math.abs(x) < 0.5 * Math.pow(10, -d)) x = 0;
    return (nf[d] || (nf[d] = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }))).format(x);
  }
  const kmh = (v) => fmt(v * 3.6, 0) + ' km/h';

  // ---------- configuração ----------
  const SLIDES = Object.assign({}, P.DEFAULTS, { deployMode: 'manual', deployTime: null, aad: true });
  const cfg = { p: Object.assign({}, SLIDES), wind: true };
  const SPEEDS = ['auto', 1, 2, 4];
  const SAFE_V = 7, SOFT_V = 4, IMPACT_V = 12;

  const G = {
    mode: 'menu', paused: false, speedIdx: 0,
    jp: Object.assign({}, cfg.p), st: null, planeX: -1700, jumpPlaneX: 0, wind: 0,
    input: { steer: 0, flare: false, open: false },
    held: { left: false, right: false, down: false, action: false }, actionIsFlare: false,
    acc: 0, last: 0, time: 0, landClock: null, hist: [], flags: {},
    toast: { text: '', cls: '', until: 0 }, calcTick: 0, endShown: false
  };

  // ---------- estados ----------
  const deployed = () => !!(G.st && G.st.tDeploy !== null);
  const canopyOpen = () => deployed() && P.deployFraction(G.st.t - G.st.tDeploy).fill > 0.5;
  function greenLight() {
    const shift = -G.wind * 60; // com vento, salta mais "contra o vento"
    return G.planeX >= -900 + shift && G.planeX <= -200 + shift;
  }
  function timeScale() {
    const s = SPEEDS[G.speedIdx];
    if (s !== 'auto') return s;
    if (G.mode === 'jump' && canopyOpen() && G.st.y > 120) return 3; // descida longa sob o velame
    return 1;
  }

  function newRound() {
    G.mode = 'plane';
    G.jp = Object.assign({}, cfg.p);
    G.wind = cfg.wind ? Math.round((Math.random() * 2 - 1) * 4 * 2) / 2 : 0;
    G.planeX = -1700;
    G.st = null; G.landClock = null; G.hist = []; G.flags = {}; G.acc = 0; G.endShown = false;
    releaseAll();
    $('ov-end').hidden = true; $('ov-start').hidden = true;
    setPaused(false);
    showToast(G.wind ? 'Vento de ' + fmt(Math.abs(G.wind), 1) + ' m/s ' + (G.wind > 0 ? '→' : '←') + '. Espere a luz verde para saltar.' : 'Espere a luz verde para saltar.', '', 4);
  }
  function jump() {
    if (G.mode !== 'plane' || G.paused) return;
    G.st = P.createJump(G.jp, G.planeX, G.wind);
    G.jumpPlaneX = G.planeX;
    G.mode = 'jump';
    G.hist = [{ t: 0, v: 0 }];
    showToast(greenLight() ? 'Saltou na luz verde! Queda livre…' : 'Saltou fora da luz verde: o alvo pode ficar longe.', greenLight() ? 'good' : '', 3);
  }
  function actionDown() {
    if (G.paused) return;
    if (G.mode === 'menu') { start(); return; }
    if (G.mode === 'end') { newRound(); return; }
    if (G.mode === 'plane') { jump(); return; }
    if (G.mode === 'jump' && !G.st.landed) {
      if (!deployed()) { G.input.open = true; G.actionIsFlare = false; }
      else G.actionIsFlare = true;
      G.held.action = true;
    }
  }
  function actionUp() { G.held.action = false; G.actionIsFlare = false; }
  function releaseAll() {
    G.held.left = G.held.right = G.held.down = G.held.action = false;
    G.actionIsFlare = false; G.input.open = false;
    document.querySelectorAll('.pressed').forEach((el) => el.classList.remove('pressed'));
  }
  function start() { $('ov-start').hidden = true; newRound(); }
  function setPaused(v) {
    G.paused = v && (G.mode === 'jump' || G.mode === 'plane');
    $('ov-pause').hidden = !G.paused;
    $('btn-pause').textContent = G.paused ? '▶' : '❚❚';
    if (G.paused) releaseAll();
  }

  // ---------- mensagens ----------
  function showToast(text, cls, secs) { G.toast = { text, cls: cls || '', until: G.time + (secs || 3) }; }
  function once(key, fn) { if (!G.flags[key]) { G.flags[key] = true; fn(); } }
  function events() {
    const st = G.st, p = G.jp;
    if (!st || st.landed) return;
    const vt = P.terminalVelocity(p), imp = P.vacuumImpact(p);
    if (!deployed() && st.vy >= 0.99 * vt) once('vt', () => showToast('Velocidade terminal: peso = arrasto ⇒ v ≈ ' + fmt(vt, 1) + ' m/s', '', 3.5));
    if (st.t >= imp.t) once('vac', () => showToast('Sem resistência do ar, você já teria batido no chão a ' + fmt(imp.v, 0) + ' m/s!', 'danger', 4));
    if (!deployed() && st.y < 1500 && st.y >= 900) once('alt', () => showToast('Altitude de abertura! Aperte Espaço para abrir', 'good', 3));
    if (!deployed() && st.y < 900 && G.toast.text !== '⚠ ABRA O PARAQUEDAS!') showToast('⚠ ABRA O PARAQUEDAS!', 'danger', 60);
    if (deployed() && G.toast.text === '⚠ ABRA O PARAQUEDAS!') G.toast.until = 0;
    if (deployed() && st.deployBy === 'aad') once('aad', () => showToast('O AAD abriu o paraquedas sozinho a ' + P.AAD_ALT + ' m!', 'danger', 3.5));
    if (canopyOpen()) once('canopy', () => showToast('Velame aberto! Use ← → para ir até o alvo', 'good', 4));
    if (canopyOpen() && st.y < 60) once('flare', () => showToast('Perto do chão: segure ↓ a 3–5 m para frear', '', 4));
  }

  // ---------- laço principal ----------
  function frame(ts) {
    const dtReal = G.last ? Math.min(0.05, Math.max(0, (ts - G.last) / 1000)) : 0;
    G.last = ts;
    if (!G.paused) {
      G.time += dtReal;
      if (G.mode === 'menu' || G.mode === 'plane') {
        G.planeX += P.GAME.planeSpeed * dtReal;
        if (G.planeX > 1500) { G.planeX = -1700; if (G.mode === 'plane') showToast('O avião passou do ponto. Nova passagem…', '', 3); }
      }
      if (G.mode === 'jump' && !G.st.landed) {
        G.input.steer = (G.held.right ? 1 : 0) - (G.held.left ? 1 : 0);
        G.input.flare = G.held.down || (G.held.action && G.actionIsFlare);
        G.acc += dtReal * timeScale();
        let n = 0;
        while (G.acc >= P.GAME.dt && n < 2000 && !G.st.landed) {
          P.stepJump(G.st, G.jp, G.input, P.GAME.dt);
          G.input.open = false;
          G.acc -= P.GAME.dt; n++;
          const last = G.hist[G.hist.length - 1];
          if (G.st.t - last.t >= 0.1 || G.st.landed) G.hist.push({ t: G.st.t, v: G.st.vy });
        }
        if (G.st.landed) { G.landClock = G.time; G.acc = 0; releaseAll(); }
        events();
      }
      if (G.mode === 'jump' && G.st.landed && !G.endShown && G.time - G.landClock > 2.6) showEnd();
    }
    render();
    updateHud();
    requestAnimationFrame(frame);
  }

  // ---------- desenho ----------
  const cv = { el: null, ctx: null, w: 0, h: 0, dpr: 1 };
  function resize() {
    const r = cv.el.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.w = r.width; cv.h = r.height; cv.dpr = dpr;
    const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (cv.el.width !== W || cv.el.height !== H) { cv.el.width = W; cv.el.height = H; }
  }
  function render() {
    if (cv.w < 2 || cv.h < 2) return;
    const p = G.jp, st = G.st;
    const inJump = G.mode === 'jump' || (G.mode === 'end' && st);
    const S = {
      p, st: inJump ? st : null, mode: G.mode, wind: G.wind, time: G.time, fmt,
      camX: inJump ? st.x : G.planeX - 10,
      camAlt: inJump ? st.y : p.h0 - 8,
      planeX: inJump ? (st.t < 60 ? G.jumpPlaneX + P.GAME.planeSpeed * st.t : null) : G.planeX,
      planeSpeed: inJump ? 0 : P.GAME.planeSpeed,
      greenLight: greenLight(),
      frac: inJump && st.tDeploy !== null ? P.deployFraction(st.t - st.tDeploy) : null,
      collapse: inJump && st.landed && st.landed.vy <= IMPACT_V ? Math.min(1, (G.time - G.landClock) / 2.5) : 0,
      danger: inJump && !st.landed && st.tDeploy === null && st.y < 900
    };
    cv.ctx.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
    Scene.draw(cv.ctx, cv.w, cv.h, S);
  }

  // ---------- HUD ----------
  function setText(el, txt) { if (el._t !== txt) { el.textContent = txt; el._t = txt; } }
  function setHtml(el, html) { if (el._h !== html) { el.innerHTML = html; el._h = html; } }
  function setClass(el, cls) { if (el.className !== cls) el.className = cls; }

  function updateHud() {
    const st = G.st, p = G.jp;
    const inJump = (G.mode === 'jump' || G.mode === 'end') && st;
    const y = inJump ? st.y : p.h0, v = inJump && !st.landed ? st.vy : 0;
    setText($('hud-alt'), fmt(y, 0));
    setText($('hud-v'), '▼ ' + fmt(v, 1) + ' m/s');
    setText($('hud-kmh'), kmh(v));
    $('altimeter').classList.toggle('danger', !!(inJump && !st.landed && !deployed() && st.y < 900));

    setText($('hud-wind'), G.wind ? 'Vento ' + (G.wind > 0 ? '→ ' : '← ') + fmt(Math.abs(G.wind), 1) + ' m/s' : 'Sem vento');
    const tgt = $('hud-target');
    if (G.mode === 'plane' || G.mode === 'menu') {
      const gl = greenLight();
      setText(tgt, gl ? '● Luz verde: salte!' : '● Luz vermelha: aguarde');
      setClass(tgt, 'chip' + (gl ? ' good' : ''));
    } else if (st) {
      const d = Math.abs(st.x);
      setText(tgt, d < 2 ? 'Alvo: bem em cima! ✓' : 'Alvo: ' + fmt(d, 0) + ' m ' + (st.x < 0 ? '→' : '←'));
      setClass(tgt, 'chip' + (d < 10 ? ' good' : ''));
    }

    // botão principal
    const b = $('btn-action');
    let label = 'SALTAR', cls = 'ctl action', dis = false;
    if (G.mode === 'menu') label = 'COMEÇAR';
    else if (G.mode === 'plane') { label = greenLight() ? 'SALTAR!' : 'SALTAR'; cls += greenLight() ? ' go' : ''; }
    else if (G.mode === 'jump' && !st.landed) {
      if (!deployed()) { label = 'ABRIR PARAQUEDAS'; cls += st.y < 1000 ? ' urgent' : ' open'; }
      else if (!canopyOpen()) { label = 'ABRINDO…'; dis = true; }
      else { label = st.flaring ? 'FREANDO…' : 'FREAR (segure)'; cls += ' flare'; }
    } else { label = G.mode === 'end' ? 'SALTAR DE NOVO' : '…'; dis = G.mode !== 'end'; }
    setText(b, label); setClass(b, cls + (G.held.action ? ' pressed' : '')); if (b.disabled !== dis) b.disabled = dis;
    const steer = G.mode === 'jump' && canopyOpen() && !st.landed;
    $('btn-left').hidden = !steer; $('btn-right').hidden = !steer;
    $('btn-left').classList.toggle('pressed', G.held.left);
    $('btn-right').classList.toggle('pressed', G.held.right);
    const hideControls = G.mode === 'menu' || G.mode === 'end' || G.paused;
    document.querySelector('.controls').hidden = hideControls;

    let hint = '';
    if (G.mode === 'plane') hint = 'Espaço = saltar';
    else if (G.mode === 'jump' && !st.landed) hint = !deployed() ? 'Espaço = abrir o paraquedas' : canopyOpen() ? '← → pilotar · segure ↓ ou Espaço = frear' : '';
    $('keyhint').hidden = hideControls || !hint;
    setText($('keyhint'), hint);

    const sp = SPEEDS[G.speedIdx];
    setText($('btn-speed'), sp === 'auto' ? (timeScale() > 1 ? 'A' + timeScale() + '×' : 'Auto') : sp + '×');

    const t = $('toast');
    const show = G.time < G.toast.until && G.mode !== 'end' && G.mode !== 'menu';
    if (show) setText(t, G.toast.text);
    setClass(t, 'toast' + (show ? ' show' : '') + (G.toast.cls ? ' ' + G.toast.cls : ''));

    if (G.time - G.calcTick > 0.1 || G.paused) { G.calcTick = G.time; updateCalc(); }
  }

  // ---------- cálculos essenciais (ao vivo) ----------
  function updateCalc() {
    if ($('calc').hidden) return;
    const p = G.jp, st = G.mode === 'jump' || G.mode === 'end' ? G.st : null;
    const t = st ? st.t : 0;
    // 1 — sem ar
    const imp = P.vacuumImpact(p);
    if (t < imp.t) {
      const vv = p.g * t, yy = p.h0 - 0.5 * p.g * t * t;
      setHtml($('c1'), 't = ' + fmt(t, 1) + ' s ⇒ v = ' + fmt(p.g, 1) + '·' + fmt(t, 1) + ' = <b>' + fmt(vv, 1) + ' m/s</b> · y = <b>' + fmt(yy, 0) + ' m</b>');
    } else {
      setHtml($('c1'), '<span class="hl">Já teria batido no chão:</span> t = √(2h₀/g) = <b>' + fmt(imp.t, 1) + ' s</b>, v = <b>' + fmt(imp.v, 0) + ' m/s</b> (' + kmh(imp.v) + ')');
    }
    // 2 — altímetro
    const h = st ? st.y : p.h0, H = P.scaleHeight(p.g), Pa = P.pressureAt(h, p.g) / 100;
    setHtml($('c2'), 'P = <b>' + fmt(Pa, 1) + ' hPa</b> ⇒ h = −' + fmt(H, 0) + '·ln(' + fmt(Pa, 1) + '/1013,25) = <b>' + fmt(h, 0) + ' m</b>');
    // 3 — com ar
    const vt = P.terminalVelocity(p);
    if (!st || st.tDeploy === null) {
      const x = (p.g * t) / vt, v = vt * Math.tanh(x);
      setHtml($('c3'), 'v<sub>t</sub> = √(2·' + fmt(p.m, 0) + '·' + fmt(p.g, 1) + ' / (' + fmt(p.rho, 3) + '·' + fmt(p.cd, 1) + '·' + fmt(p.area, 2) + ')) = <b>' + fmt(vt, 2) + ' m/s</b><br>v(' + fmt(t, 1) + ') = ' + fmt(vt, 2) + '·tanh(' + fmt(x, 2) + ') = <b>' + fmt(v, 1) + ' m/s</b> (' + fmt((100 * v) / vt, 0) + '% de v<sub>t</sub>)');
      $('c3-bar').style.width = ((100 * v) / vt).toFixed(1) + '%';
    } else {
      const cda = p.canopyCd * p.canopyArea, vtc = P.terminalVelocity(p, cda);
      setHtml($('c3'), 'Velame aberto: A = ' + fmt(p.canopyArea, 0) + ' m², C<sub>d</sub> = ' + fmt(p.canopyCd, 1) + '<br>v<sub>t</sub> = √(2·' + fmt(p.m, 0) + '·' + fmt(p.g, 1) + ' / (' + fmt(p.rho, 3) + '·' + fmt(cda, 0) + ')) = <b>' + fmt(vtc, 2) + ' m/s</b> · agora: <b>' + fmt(st.landed ? st.landed.vy : st.vy, 1) + ' m/s</b>');
      $('c3-bar').style.width = Math.min(100, (100 * (st.landed ? 0 : st.vy)) / vt).toFixed(1) + '%';
    }
  }

  // ---------- resultado ----------
  function showEnd() {
    G.endShown = true; G.mode = 'end';
    const st = G.st, p = G.jp, L = st.landed;
    const vy = L.vy, dist = Math.abs(L.x);
    const imp = P.vacuumImpact(p), vt = P.terminalVelocity(p), vtc = P.terminalVelocity(p, p.canopyCd * p.canopyArea);
    let stars = 0, title, sub;
    if (vy > IMPACT_V) {
      title = '💥 Impacto!';
      sub = 'Você chegou ao chão a ' + fmt(vy, 1) + ' m/s (' + kmh(vy) + '). ' + (st.tDeploy === null ? 'O paraquedas não abriu.' : 'Abriu tarde demais.');
    } else {
      stars = (vy <= SAFE_V ? 1 : 0) + (dist <= 10 ? 1 : 0) + (vy <= SOFT_V ? 1 : 0);
      if (stars === 3) title = 'Pouso perfeito!';
      else if (vy > SAFE_V) title = 'Pouso duro';
      else if (dist > 10) title = 'Pouso seguro, mas longe do alvo';
      else title = 'Pouso seguro!';
      sub = vy > SOFT_V ? 'Dica: segure ↓ a 3–5 m do chão para frear e pousar abaixo de ' + SOFT_V + ' m/s.' : 'Ótimo flare: o arrasto extra do velame reduziu a velocidade de descida.';
      if (dist > 10) sub += ' Use ← → sob o velame para chegar ao alvo.';
    }
    $('end-stars').innerHTML = [0, 1, 2].map((i) => '<span class="' + (i < stars ? '' : 'off') + '">★</span>').join('');
    $('end-title').textContent = title;
    $('end-sub').textContent = sub;
    const openTxt = st.tDeploy === null ? 'não abriu' : fmt(st.deployY, 0) + ' m' + (st.deployBy === 'aad' ? ' (AAD)' : '');
    $('end-stats').innerHTML = [
      ['Do alvo', fmt(dist, 1) + ' m'], ['Pouso', fmt(vy, 1) + ' m/s'], ['Abertura', openTxt], ['Tempo', fmt(L.t, 0) + ' s']
    ].map(([k, v]) => '<div class="stat"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>').join('');
    $('end-math').innerHTML =
      'Queda livre: v<sub>t</sub> = √(2·' + fmt(p.m, 0) + '·' + fmt(p.g, 1) + ' / (' + fmt(p.rho, 3) + '·' + fmt(p.cd, 1) + '·' + fmt(p.area, 2) + ')) = <b>' + fmt(vt, 2) + ' m/s</b>, o limite de v(t) = v<sub>t</sub>·tanh(gt/v<sub>t</sub>) quando t → ∞.<br>' +
      'Paraquedas aberto: v<sub>t</sub> = √(2mg / ρC<sub>d</sub>A<sub>velame</sub>) = <b>' + fmt(vtc, 2) + ' m/s</b>.<br>' +
      'Sem ar: v = √(2·g·h₀) = <b>' + fmt(imp.v, 0) + ' m/s</b> (' + kmh(imp.v) + ') em ' + fmt(imp.t, 1) + ' s.';
    $('ov-end').hidden = false;
    requestAnimationFrame(drawEndChart);
  }
  function drawEndChart() {
    const c = $('end-chart'), r = c.getBoundingClientRect();
    if (r.width < 2) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
    const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = r.width, H = r.height, m = { l: 40, r: 10, t: 12, b: 24 };
    const p = G.jp, vt = P.terminalVelocity(p), imp = P.vacuumImpact(p);
    const tMax = Math.max(G.hist[G.hist.length - 1].t, 1), vMax = Math.max(vt * 1.6, 60);
    const X = (t) => m.l + (t / tMax) * (W - m.l - m.r), Y = (v) => m.t + (1 - v / vMax) * (H - m.t - m.b);
    ctx.font = '11px ' + getComputedStyle(document.body).fontFamily; ctx.fillStyle = '#5b6472'; ctx.strokeStyle = 'rgba(18,48,90,.12)';
    for (let v = 0; v <= vMax; v += 20) { ctx.beginPath(); ctx.moveTo(m.l, Y(v)); ctx.lineTo(W - m.r, Y(v)); ctx.stroke(); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(fmt(v, 0), m.l - 6, Y(v)); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText('tempo (s) → ' + fmt(tMax, 0), W / 2, H - 4);
    ctx.save(); ctx.beginPath(); ctx.rect(m.l, m.t, W - m.l - m.r, H - m.t - m.b); ctx.clip();
    ctx.setLineDash([6, 5]); ctx.strokeStyle = '#e8701a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(m.l, Y(vt)); ctx.lineTo(W - m.r, Y(vt)); ctx.stroke();
    ctx.strokeStyle = '#c8283a'; ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(Math.min(imp.t, tMax)), Y(p.g * Math.min(imp.t, tMax))); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#12305a'; ctx.lineWidth = 2.5; ctx.beginPath();
    G.hist.forEach((h, i) => (i ? ctx.lineTo(X(h.t), Y(h.v)) : ctx.moveTo(X(h.t), Y(h.v))));
    ctx.stroke(); ctx.restore();
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.font = '700 11px ' + getComputedStyle(document.body).fontFamily;
    ctx.fillStyle = '#e8701a'; ctx.fillText('v terminal ' + fmt(vt, 1) + ' m/s', m.l + 6, Y(vt) - 3);
    const tc = Math.min(vMax / p.g, imp.t, tMax); // onde a reta v = g·t sai do gráfico
    ctx.fillStyle = '#c8283a'; ctx.textBaseline = 'top'; ctx.fillText('sem ar: v = g·t ↑', X(tc) + 6, m.t + 2); ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#12305a'; ctx.fillText('seu salto: v(t)', X(tMax * 0.45), Y(vt) + 16);
  }

  // ---------- ajustes ----------
  const RANGES = { m: [0, ' kg'], h0: [0, ' m'], area: [2, ' m²'], canopyArea: [0, ' m²'] };
  function syncSettings() {
    for (const k in RANGES) { $('s-' + k).value = String(cfg.p[k]); $('o-' + k).textContent = fmt(cfg.p[k], RANGES[k][0]) + RANGES[k][1]; }
    $('s-aad').checked = cfg.p.aad; $('s-wind').checked = cfg.wind;
  }
  function applySettings() {
    if (G.mode === 'plane' || G.mode === 'menu') G.jp = Object.assign({}, cfg.p);
    syncSettings();
  }

  // ---------- entrada ----------
  function bind() {
    const isField = (e) => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT');
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      if (k === 'Escape') { if (!$('settings').hidden) { $('settings').hidden = true; return; } setPaused(!G.paused); return; }
      if (isField(e)) return;
      if (k === ' ' || k === 'Spacebar') { e.preventDefault(); if (!e.repeat) actionDown(); return; }
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') { e.preventDefault(); G.held.left = true; return; }
      if (k === 'ArrowRight' || k === 'd' || k === 'D') { e.preventDefault(); G.held.right = true; return; }
      if (k === 'ArrowDown' || k === 's' || k === 'S') { e.preventDefault(); G.held.down = true; return; }
      if (k === 'ArrowUp') { e.preventDefault(); return; }
      if (e.repeat) return;
      if (k === 'x' || k === 'X') cycleSpeed();
      else if (k === 'm' || k === 'M') toggleCalc();
      else if (k === 'f' || k === 'F') toggleFull();
      else if (k === 'r' || k === 'R') { if (G.mode !== 'menu') newRound(); }
      else if (k === 'Enter' && (G.mode === 'menu' || G.mode === 'end')) actionDown();
    });
    document.addEventListener('keyup', (e) => {
      const k = e.key;
      if (k === ' ' || k === 'Spacebar') { e.preventDefault(); actionUp(); }
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') G.held.left = false;
      if (k === 'ArrowRight' || k === 'd' || k === 'D') G.held.right = false;
      if (k === 'ArrowDown' || k === 's' || k === 'S') G.held.down = false;
    });
    window.addEventListener('blur', () => { releaseAll(); if (G.mode === 'jump') setPaused(true); });

    const hold = (el, down, up) => {
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (_) { /* ok */ } down(); });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => el.addEventListener(ev, up));
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    hold($('btn-action'), actionDown, actionUp);
    hold($('btn-left'), () => { G.held.left = true; }, () => { G.held.left = false; });
    hold($('btn-right'), () => { G.held.right = true; }, () => { G.held.right = false; });

    const click = (id, fn) => $(id).addEventListener('click', (e) => { fn(e); e.currentTarget.blur(); });
    click('btn-start', start);
    click('btn-again', newRound);
    click('btn-resume', () => setPaused(false));
    click('btn-pause', () => setPaused(!G.paused));
    click('btn-speed', cycleSpeed);
    click('btn-calc', toggleCalc);
    click('btn-full', toggleFull);
    click('btn-settings', () => { $('settings').hidden = !$('settings').hidden; });
    click('btn-settings-close', () => { $('settings').hidden = true; });
    click('btn-defaults', () => { cfg.p = Object.assign({}, SLIDES); cfg.wind = true; applySettings(); });
    for (const k in RANGES) $('s-' + k).addEventListener('input', (e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) { cfg.p[k] = v; applySettings(); } });
    $('s-aad').addEventListener('change', (e) => { cfg.p.aad = e.target.checked; applySettings(); });
    $('s-wind').addEventListener('change', (e) => { cfg.wind = e.target.checked; if (G.mode === 'plane') G.wind = cfg.wind ? G.wind || 2 : 0; applySettings(); });

    window.addEventListener('resize', resize);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(cv.el);
  }
  function cycleSpeed() { G.speedIdx = (G.speedIdx + 1) % SPEEDS.length; G.acc = 0; }
  function toggleCalc() {
    const c = $('calc'); c.hidden = !c.hidden;
    $('btn-calc').setAttribute('aria-pressed', String(!c.hidden));
    document.body.classList.toggle('calc-open', !c.hidden);
    updateCalc();
  }
  function toggleFull() {
    try { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); } catch (_) { /* sem suporte */ }
  }

  // ---------- início ----------
  function init() {
    if (!P || !window.Scene) {
      document.body.insertAdjacentHTML('afterbegin', '<p class="noscript">Erro ao carregar os scripts. Mantenha as pastas js/ e css/ junto do index.html.</p>');
      return;
    }
    cv.el = $('world'); cv.ctx = cv.el.getContext('2d');
    resize();
    bind();
    syncSettings();
    if (window.innerWidth <= 900) toggleCalc(); else document.body.classList.add('calc-open');
    requestAnimationFrame(frame);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
