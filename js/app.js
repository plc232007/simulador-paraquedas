/*
 * app.js — interface: abas, controles, animação do salto, réguas e gráficos.
 * Toda a matemática fica em physics.js.
 */
(function () {
  'use strict';
  const P = window.Physics;
  const $ = (id) => document.getElementById(id);

  // ---------------- Formatação pt-BR ----------------
  const nfCache = {};
  function fmt(x, d) {
    d = d || 0;
    if (!Number.isFinite(x)) return '—';
    if (Math.abs(x) < 0.5 * Math.pow(10, -d)) x = 0; // evita "-0,0"
    const f = nfCache[d] || (nfCache[d] = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));
    return f.format(x);
  }
  const kmh = (v) => fmt(v * 3.6, 0) + ' km/h';
  function niceStep(range, target) {
    const raw = range / target;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  }
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  const COLOR = {
    vac: cssVar('--red') || '#c8283a',
    real: cssVar('--navy') || '#12305a',
    orange: cssVar('--orange') || '#e8701a',
    green: cssVar('--green') || '#1f8a4c',
    muted: cssVar('--muted') || '#5b6472'
  };

  // ---------------- Estado ----------------
  const state = {
    p: Object.assign({}, P.DEFAULTS),
    sim: null, vac: null, tEnd: 1,
    t: 0, playing: false, speed: 5, last: 0, raf: 0
  };

  // ---------------- Controles ----------------
  const RANGES = {
    m: { unit: ' kg', d: 0 },
    h0: { unit: ' m', d: 0 },
    area: { unit: ' m²', d: 2 },
    cd: { unit: '', d: 2 },
    deployAlt: { unit: ' m', d: 0 },
    canopyArea: { unit: ' m²', d: 0 }
  };
  const CHECKS = ['parachute', 'varyDensity'];

  function clampDeploy() {
    const inp = $('in-deployAlt');
    const max = state.p.h0 - 200;
    inp.max = String(max);
    if (state.p.deployAlt > max) state.p.deployAlt = max;
    if (state.p.deployAlt < +inp.min) state.p.deployAlt = +inp.min;
  }
  function syncControls() {
    clampDeploy();
    for (const k in RANGES) {
      $('in-' + k).value = String(state.p[k]);
      $('out-' + k).textContent = fmt(state.p[k], RANGES[k].d) + RANGES[k].unit;
    }
    for (const k of CHECKS) $('in-' + k).checked = !!state.p[k];
    document.querySelectorAll('[data-needs="parachute"]').forEach((el) => {
      el.classList.toggle('disabled', !state.p.parachute);
      el.querySelectorAll('input').forEach((i) => { i.disabled = !state.p.parachute; });
    });
  }
  function bindControls() {
    for (const k in RANGES) {
      $('in-' + k).addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        if (!Number.isFinite(v)) return;
        state.p[k] = v;
        syncControls();
        recompute();
      });
    }
    for (const k of CHECKS) {
      $('in-' + k).addEventListener('change', (e) => {
        state.p[k] = e.target.checked;
        syncControls();
        recompute();
      });
    }
    $('btn-defaults').addEventListener('click', () => {
      state.p = Object.assign({}, P.DEFAULTS);
      syncControls();
      recompute();
    });
    $('btn-play').addEventListener('click', togglePlay);
    $('btn-reset').addEventListener('click', reset);
    $('sel-speed').addEventListener('change', (e) => { state.speed = parseFloat(e.target.value) || 1; });
    const scrub = $('scrub');
    scrub.addEventListener('input', () => {
      pause();
      const v = Math.max(0, parseFloat(scrub.value) || 0);
      // o navegador arredonda o valor do controle; perto do fim = fim exato
      state.t = v >= state.tEnd - 1e-3 ? state.tEnd : v;
      renderFrame();
    });
  }

  // ---------------- Recalcular tudo ----------------
  function recompute() {
    const p = state.p;
    state.sim = P.simulate(p);
    state.vac = P.vacuumTrajectory(p);
    state.tEnd = Math.max(state.sim.tEnd, state.vac.tEnd);
    $('scrub').max = String(state.tEnd);
    if (state.t > state.tEnd) state.t = state.tEnd;

    document.querySelectorAll('.pv').forEach((el) => {
      const k = el.dataset.k;
      if (k === 'g') el.textContent = fmt(p.g, 1);
      else if (k === 'h0') el.textContent = fmt(p.h0, 0);
      else if (k === 'H') el.textContent = fmt(P.scaleHeight(p.g), 0);
    });

    updateSimCharts();
    updateSummary();
    setupReguas();
    renderFrame();
  }

  // ---------------- Reprodução ----------------
  function togglePlay() { state.playing ? pause() : play(); }
  function play() {
    if (state.t >= state.tEnd - 1e-9) state.t = 0;
    state.playing = true;
    state.last = performance.now();
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = requestAnimationFrame(tick);
    updatePlayBtn();
  }
  function pause() {
    state.playing = false;
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
    updatePlayBtn();
  }
  function reset() { pause(); state.t = 0; renderFrame(); }
  function tick(ts) {
    state.raf = 0;
    if (!state.playing) return;
    const dt = Math.min(0.1, Math.max(0, (ts - state.last) / 1000)); // evita saltos ao trocar de janela
    state.last = ts;
    state.t = Math.min(state.tEnd, state.t + dt * state.speed);
    if (state.t >= state.tEnd) { state.playing = false; }
    renderFrame();
    if (state.playing) state.raf = requestAnimationFrame(tick);
    else updatePlayBtn();
  }
  function updatePlayBtn() {
    const b = $('btn-play');
    if (state.playing) b.textContent = '❚❚ Pausar';
    else if (state.t >= state.tEnd - 1e-9) b.textContent = '▶ Saltar de novo';
    else if (state.t > 0) b.textContent = '▶ Continuar';
    else b.textContent = '▶ Saltar';
  }

  // ---------------- Quadro atual (canvas + mostradores + marcadores) ----------------
  function renderFrame() {
    const t = state.t;
    drawSky();
    updateReadouts();
    charts.simV.setMarker(t);
    charts.simY.setMarker(t);
    $('clock').textContent = 't = ' + fmt(t, 1) + ' s';
    const scrub = $('scrub');
    if (Math.abs(parseFloat(scrub.value) - t) > 1e-6) scrub.value = String(t);
    updatePlayBtn();
  }

  function setStatus(el, cls, html) {
    el.className = 'status' + (cls ? ' ' + cls : '');
    el.innerHTML = html;
  }

  function updateReadouts() {
    const p = state.p, t = state.t, sim = state.sim, vac = state.vac;

    // --- sem resistência ---
    const sv = P.sampleAt(vac, t);
    const vacLanded = t >= vac.tEnd - 1e-6;
    $('ro-vac-y').innerHTML = fmt(sv.y, 0) + ' m';
    $('ro-vac-v').innerHTML = fmt(sv.v, 1) + ' m/s<small>' + kmh(sv.v) + '</small>';
    $('ro-vac-a').innerHTML = vacLanded ? '—' : fmt(p.g, 2) + ' m/s²<small>constante · 1,0 g</small>';
    const stv = $('st-vac');
    if (t === 0) setStatus(stv, '', 'Pronto para saltar.');
    else if (vacLanded) setStatus(stv, 'danger', '💥 Impacto a ' + fmt(vac.landing.v, 0) + ' m/s (' + kmh(vac.landing.v) + ') em ' + fmt(vac.tEnd, 1) + ' s. Sem o ar, ninguém sobreviveria.');
    else setStatus(stv, 'warn', 'A velocidade aumenta ' + fmt(p.g, 1) + ' m/s a cada segundo, sem limite.');

    // --- com resistência ---
    const sr = P.sampleAt(sim, t);
    const landed = t >= sim.tEnd - 1e-6;
    $('ro-real-y').innerHTML = fmt(sr.y, 0) + ' m';
    $('ro-real-v').innerHTML = fmt(sr.v, 1) + ' m/s<small>' + kmh(sr.v) + '</small>';
    if (landed) $('ro-real-a').innerHTML = '—';
    else {
      const a = sr.a;
      const sub = a >= 0 ? 'acelerando · ' + fmt(a / p.g, 2) + ' g' : 'freando · ' + fmt(-a / p.g, 1) + ' g';
      $('ro-real-a').innerHTML = fmt(a, 2) + ' m/s²<small>' + sub + '</small>';
    }
    const pres = P.pressureAt(Math.max(0, sr.y), p.g);
    $('ro-real-p').innerHTML = fmt(pres / 100, 1) + ' hPa<small>altímetro lê ' + fmt(P.altitudeFromPressure(pres, p.g), 0) + ' m</small>';

    const st = $('st-real');
    const dep = sim.deploy;
    if (t === 0) setStatus(st, '', 'Pronto para saltar.');
    else if (landed) {
      const v = sim.landing ? sim.landing.v : sr.v;
      if (v <= 7) setStatus(st, 'ok', '✓ Pouso seguro a ' + fmt(v, 1) + ' m/s (' + kmh(v) + ') em ' + fmt(sim.tEnd, 1) + ' s.');
      else if (v <= 12) setStatus(st, 'warn', 'Pouso duro a ' + fmt(v, 1) + ' m/s (' + kmh(v) + '). Velame pequeno demais.');
      else setStatus(st, 'danger', '💥 Impacto a ' + fmt(v, 1) + ' m/s (' + kmh(v) + '). ' + (p.parachute ? '' : 'O paraquedas não foi aberto!'));
    } else if (dep && t >= dep.t) {
      if (t < dep.t + sim.inflate) setStatus(st, 'warn', 'Velame inflando: o arrasto cresce e o paraquedista freia.');
      else setStatus(st, 'ok', 'Paraquedas aberto: nova velocidade terminal ≈ ' + fmt(sim.vtCanopy, 1) + ' m/s.');
    } else if (sr.a < 0.02 * p.g) {
      setStatus(st, 'info', 'Velocidade terminal: peso = arrasto, logo a aceleração ≈ 0.');
    } else {
      setStatus(st, 'info', 'Queda livre: o arrasto (∝ v²) cresce e a aceleração diminui.');
    }
  }

  function updateSummary() {
    const p = state.p, sim = state.sim, vac = state.vac;
    const items = [];
    items.push('Velocidade terminal: <b>' + fmt(sim.vtBody, 2) + ' m/s</b> (' + kmh(sim.vtBody) + ')');
    if (sim.t99) items.push('99% de v<sub>t</sub> em <b>' + fmt(sim.t99.t, 2) + ' s</b>, a ' + fmt(sim.t99.y, 0) + ' m');
    if (sim.deploy) items.push('Paraquedas abre em <b>' + fmt(sim.deploy.t, 1) + ' s</b>, a ' + fmt(sim.deploy.y, 0) + ' m');
    if (sim.deploy) items.push('Desaceleração máxima: <b>' + fmt(sim.maxDecel / p.g, 1) + ' g</b>');
    if (sim.landing) items.push('Solo em <b>' + fmt(sim.landing.t, 1) + ' s</b> a <b>' + fmt(sim.landing.v, 1) + ' m/s</b>');
    items.push('Sem ar: solo em <b>' + fmt(vac.tEnd, 1) + ' s</b> a <b>' + fmt(vac.landing.v, 0) + ' m/s</b>');
    $('summary').innerHTML = '<h3>Resumo do salto</h3><ul><li>' + items.join('</li><li>') + '</li></ul>';
  }

  // ---------------- Gráficos ----------------
  const charts = {};
  function initCharts() {
    charts.simV = new LineChart($('ch-sim-v'), { xLabel: 'tempo (s)', yLabel: 'velocidade (m/s)', yMin: 0, xMin: 0 });
    charts.simY = new LineChart($('ch-sim-y'), { xLabel: 'tempo (s)', yLabel: 'altitude (m)', yMin: 0, xMin: 0 });
    charts.r1y = new LineChart($('ch-r1-y'), { xLabel: 'tempo (s)', yLabel: 'altitude y(t) (m)', yMin: 0, xMin: 0, legend: false });
    charts.r1v = new LineChart($('ch-r1-v'), { xLabel: 'tempo (s)', yLabel: 'velocidade |v(t)| (m/s)', yMin: 0, xMin: 0, legend: false });
    charts.r2 = new LineChart($('ch-r2'), { xLabel: 'altitude (m)', yLabel: 'pressão (hPa)', xMin: 0, legend: false });
    charts.r3 = new LineChart($('ch-r3'), { xLabel: 'tempo (s)', yLabel: 'velocidade (m/s)', yMin: 0, xMin: 0, legend: 'tr' });
  }
  function updateSimCharts() {
    const sim = state.sim, vac = state.vac, p = state.p;
    const vLines = sim.deploy ? [{ x: sim.deploy.t, label: 'abre o paraquedas', color: COLOR.orange }] : [];
    charts.simV.setData({
      xMax: state.tEnd,
      series: [
        { x: vac.T, y: vac.V, color: COLOR.vac, label: 'Sem resistência do ar', dash: [7, 5] },
        { x: sim.T, y: sim.V, color: COLOR.real, label: 'Com resistência do ar' }
      ],
      hLines: [{ y: sim.vtBody, label: 'v terminal = ' + fmt(sim.vtBody, 2) + ' m/s', color: COLOR.orange }],
      vLines
    });
    charts.simY.setData({
      xMax: state.tEnd,
      series: [
        { x: vac.T, y: vac.Y, color: COLOR.vac, label: 'Sem resistência do ar', dash: [7, 5] },
        { x: sim.T, y: sim.Y, color: COLOR.real, label: 'Com resistência do ar' }
      ],
      hLines: p.parachute ? [{ y: p.deployAlt, label: 'abertura · ' + fmt(p.deployAlt, 0) + ' m', color: COLOR.orange }] : [],
      vLines
    });
  }

  // ---------------- Régua (componente vertical) ----------------
  function buildRuler(el, maxAlt, title) {
    el.innerHTML = '';
    el._max = maxAlt;
    const step = niceStep(maxAlt, 8);
    const frag = document.createDocumentFragment();
    const t = document.createElement('div'); t.className = 'title'; t.textContent = title; frag.appendChild(t);
    for (let a = 0; a <= maxAlt + 1e-9; a += step / 2) {
      const major = Math.abs(a / step - Math.round(a / step)) < 1e-6;
      const top = (1 - a / maxAlt) * 100 + '%';
      const tk = document.createElement('div');
      tk.className = 'tick' + (major ? '' : ' minor');
      tk.style.top = top;
      frag.appendChild(tk);
      if (major) {
        const lb = document.createElement('div');
        lb.className = 'tick-label'; lb.style.top = top; lb.textContent = fmt(a, 0);
        frag.appendChild(lb);
      }
    }
    const g = document.createElement('div'); g.className = 'ground'; frag.appendChild(g);
    el._pin = document.createElement('div'); el._pin.className = 'pin';
    el._lbl = document.createElement('div'); el._lbl.className = 'pin-label';
    frag.appendChild(el._pin); frag.appendChild(el._lbl);
    el.appendChild(frag);
  }
  function setRuler(el, alt, label) {
    const f = Math.min(1, Math.max(0, 1 - alt / el._max));
    el._pin.style.top = f * 100 + '%';
    el._lbl.style.top = f * 100 + '%';
    el._lbl.textContent = label;
  }

  // ---------------- Réguas 1, 2 e 3 ----------------
  function row(lbl, math) { return '<div class="row"><div class="lbl">' + lbl + '</div><div class="math">' + math + '</div></div>'; }

  function setupReguas() {
    const p = state.p;
    // Régua 1
    const imp = P.vacuumImpact(p);
    const r1 = $('r1-t');
    r1.max = String(Math.floor(imp.t * 100) / 100);
    r1.step = '0.01';
    if (+r1.value > +r1.max) r1.value = r1.max;
    buildRuler($('r1-ruler'), p.h0, 'ALTITUDE (m)');
    const vt = P.vacuumTrajectory(p);
    charts.r1y.setData({ series: [{ x: vt.T, y: vt.Y, color: COLOR.vac }], hLines: [] });
    charts.r1v.setData({ series: [{ x: vt.T, y: vt.V, color: COLOR.vac }], hLines: [] });
    $('r1-impact').innerHTML =
      '<h4>Quando chega ao solo?</h4>' +
      '<div class="math">y(t) = 0 ⇒ t = √(2·h₀/g) = √(2·' + fmt(p.h0, 0) + '/' + fmt(p.g, 1) + ') = <b>' + fmt(imp.t, 2) + ' s</b></div>' +
      '<div class="math">v = g·t = ' + fmt(p.g, 1) + '·' + fmt(imp.t, 2) + ' = <b>' + fmt(imp.v, 0) + ' m/s</b> (' + kmh(imp.v) + ')</div>' +
      '<p class="note">⚠ Mais rápido que um carro de Fórmula 1. Na vida real o ar impede isso (Régua 3).</p>';
    renderR1();

    // Régua 2
    const H_MAX = 10000; // até 10 km (acima do Everest) para a curva exponencial ficar visível
    if (!state.r2Init) { $('r2-h').value = String(p.h0); state.r2Init = true; }
    buildRuler($('r2-ruler'), H_MAX, 'ALTITUDE (m)');
    const hs = [], ps = [];
    for (let i = 0; i <= 250; i++) { const h = (H_MAX * i) / 250; hs.push(h); ps.push(P.pressureAt(h, p.g) / 100); }
    const r2v = [{ x: p.h0, label: 'saída do avião', color: COLOR.real }];
    if (p.parachute) r2v.push({ x: p.deployAlt, label: 'abertura', color: COLOR.orange });
    charts.r2.setData({ xMax: H_MAX, yMin: 0, series: [{ x: hs, y: ps, color: COLOR.real }], hLines: [], vLines: r2v });
    renderR2();

    // Régua 3
    const tg = P.dragGroundTime(p);
    const r3 = $('r3-t');
    r3.max = String(Math.floor(Math.min(40, tg) * 20) / 20);
    if (+r3.value > +r3.max) r3.value = r3.max;
    buildRuler($('r3-ruler'), p.h0, 'ALTITUDE (m)');
    const tMax = +r3.max;
    const xs = [], vd = [], xv = [], vv = [];
    for (let i = 0; i <= 400; i++) {
      const t = (tMax * i) / 400;
      xs.push(t); vd.push(P.dragAt(t, p).v);
      if (t <= imp.t) { xv.push(t); vv.push(p.g * t); }
    }
    const t99 = P.timeToFraction(0.99, p);
    const vT = P.terminalVelocity(p);
    charts.r3.setData({
      xMax: tMax,
      yMax: Math.min(Math.max(vT * 3, 150), p.g * Math.min(tMax, imp.t)),
      series: [
        { x: xv, y: vv, color: COLOR.vac, label: 'Sem resistência: v = g·t', dash: [7, 5] },
        { x: xs, y: vd, color: COLOR.real, label: 'Com resistência: v = vt·tanh(g·t/vt)' }
      ],
      hLines: [{ y: vT, label: 'v terminal = ' + fmt(vT, 2) + ' m/s', color: COLOR.orange }],
      vLines: t99 <= tMax ? [{ x: t99, label: '99% de v terminal · ' + fmt(t99, 2) + ' s', color: COLOR.green }] : []
    });
    const s99 = P.dragAt(t99, p);
    const vac99 = P.vacuumAt(t99, p);
    $('r3-results').innerHTML =
      '<h4>Resultados</h4><ul>' +
      '<li>Velocidade terminal: <b>' + fmt(vT, 2) + ' m/s</b> (' + kmh(vT) + ')</li>' +
      '<li>Tempo para 99% de v<sub>t</sub>: <b>' + fmt(t99, 2) + ' s</b></li>' +
      '<li>Distância percorrida até lá: <b>' + fmt(s99.s, 1) + ' m</b></li>' +
      '<li>Altitude restante: <b>' + fmt(s99.y, 1) + ' m</b></li>' +
      '<li>Sem ar, no mesmo instante: ' + fmt(vac99.v, 1) + ' m/s (' + fmt(vac99.v / vT, 1) + '× mais rápido)</li>' +
      '</ul>';
    renderR3();
  }

  function renderR1() {
    const p = state.p;
    const t = parseFloat($('r1-t').value) || 0;
    const st = P.vacuumAt(t, p);
    $('r1-t-out').textContent = 't = ' + fmt(t, 2) + ' s';
    $('r1-calc').innerHTML =
      row('Velocidade', 'v(' + fmt(t, 2) + ') = −' + fmt(p.g, 1) + '·' + fmt(t, 2) + ' = <b>−' + fmt(st.v, 1) + ' m/s</b> &nbsp;(' + kmh(st.v) + ')') +
      row('Posição', 'y(' + fmt(t, 2) + ') = ' + fmt(p.h0, 0) + ' − ½·' + fmt(p.g, 1) + '·(' + fmt(t, 2) + ')² = <b>' + fmt(st.y, 1) + ' m</b>') +
      row('Distância já percorrida', 'h₀ − y = <b>' + fmt(st.s, 1) + ' m</b>') +
      row('Aceleração', 'a(t) = v′(t) = <b>−' + fmt(p.g, 1) + ' m/s²</b> (não muda)');
    setRuler($('r1-ruler'), st.y, fmt(st.y, 0) + ' m');
    charts.r1y.setMarker(t);
    charts.r1v.setMarker(t);
  }

  function renderR2() {
    const p = state.p;
    const h = parseFloat($('r2-h').value) || 0;
    const H = P.scaleHeight(p.g);
    const Pa = P.pressureAt(h, p.g);
    const rho = P.densityAt(h, p.rho, p.g);
    const hRead = P.altitudeFromPressure(Pa, p.g);
    $('r2-h-out').textContent = 'h = ' + fmt(h, 0) + ' m';
    $('r2-display').textContent = fmt(hRead, 0);
    $('r2-display-p').textContent = fmt(Pa / 100, 1) + ' hPa · ' + fmt((100 * Pa) / P.P0, 1) + '% do nível do mar';
    $('r2-calc').innerHTML =
      row('Pressão', 'P = 1013,25·e<sup>−' + fmt(h, 0) + '/' + fmt(H, 0) + '</sup> = <b>' + fmt(Pa / 100, 1) + ' hPa</b>') +
      row('Densidade do ar', 'ρ = ' + fmt(p.rho, 3) + '·e<sup>−h/H</sup> = <b>' + fmt(rho, 3) + ' kg/m³</b>') +
      row('Altímetro (função inversa)', 'h = −' + fmt(H, 0) + '·ln(' + fmt(Pa / 100, 1) + '/1013,25) = <b>' + fmt(hRead, 0) + ' m</b>');
    const vt = P.terminalVelocity(p);
    const rate = P.pressureRate(h, vt, p.g) / 100;
    $('r2-chain').innerHTML =
      '<h4>Regra da cadeia durante a queda</h4>' +
      '<div class="math">dP/dt = (dP/dh)·(dh/dt) = (−P/H)·(−v)</div>' +
      '<p class="note">Caindo a v<sub>t</sub> = ' + fmt(vt, 1) + ' m/s nesta altitude, a pressão sobe <b>' + fmt(rate, 2) + ' hPa por segundo</b>. É essa variação que o altímetro acompanha.</p>';
    setRuler($('r2-ruler'), h, fmt(Pa / 100, 0) + ' hPa');
    charts.r2.setMarker(h);
  }

  function renderR3() {
    const p = state.p;
    const t = parseFloat($('r3-t').value) || 0;
    const st = P.dragAt(t, p);
    const k = P.dragK(p);
    const x = (p.g * t) / st.vt;
    const frac = st.vt > 0 ? st.v / st.vt : 0;
    $('r3-t-out').textContent = 't = ' + fmt(t, 2) + ' s';
    $('r3-progress').style.width = (frac * 100).toFixed(2) + '%';
    $('r3-progress-txt').textContent = 'v = ' + fmt(frac * 100, 1) + '% da velocidade terminal';
    $('r3-calc').innerHTML =
      row('Constante de arrasto', 'k = ½·' + fmt(p.rho, 3) + '·' + fmt(p.cd, 2) + '·' + fmt(p.area, 2) + ' = <b>' + fmt(k, 3) + ' kg/m</b>') +
      row('Velocidade terminal', 'v<sub>t</sub> = √(2·' + fmt(p.m, 0) + '·' + fmt(p.g, 1) + ' / (' + fmt(p.rho, 3) + '·' + fmt(p.cd, 2) + '·' + fmt(p.area, 2) + ')) = <b>' + fmt(st.vt, 2) + ' m/s</b>') +
      row('Velocidade', 'v(' + fmt(t, 2) + ') = ' + fmt(st.vt, 2) + '·tanh(' + fmt(x, 3) + ') = <b>' + fmt(st.v, 2) + ' m/s</b>') +
      row('Distância e altitude', 's = ' + fmt(st.s, 1) + ' m &nbsp;⇒&nbsp; y = <b>' + fmt(st.y, 1) + ' m</b>') +
      row('Aceleração', 'a = g·(1 − (v/v<sub>t</sub>)²) = <b>' + fmt(st.a, 2) + ' m/s²</b>');
    setRuler($('r3-ruler'), st.y, fmt(st.y, 0) + ' m');
    charts.r3.setMarker(t);
  }

  function bindReguas() {
    $('r1-t').addEventListener('input', renderR1);
    $('r2-h').addEventListener('input', renderR2);
    $('r3-t').addEventListener('input', renderR3);
  }

  // ---------------- Céu animado (canvas) ----------------
  const sky = { c: null, ctx: null, w: 0, h: 0, dpr: 1, clouds: [] };
  function initSky() {
    sky.c = $('sky');
    sky.ctx = sky.c.getContext('2d');
    // nuvens fixas (gerador pseudoaleatório com semente → sempre iguais)
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 11; i++) sky.clouds.push({ x: 0.12 + rnd() * 0.9, y: 0.08 + rnd() * 0.8, s: 0.6 + rnd() * 0.8 });
    const onResize = () => { resizeSky(); drawSky(); };
    sky.c.addEventListener('click', togglePlay); // clicar no céu também inicia/pausa
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(onResize).observe(sky.c);
    window.addEventListener('resize', onResize);
    resizeSky();
  }
  function resizeSky() {
    const r = sky.c.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (sky.c.width !== W || sky.c.height !== H) { sky.c.width = W; sky.c.height = H; }
    sky.w = r.width; sky.h = r.height; sky.dpr = dpr;
    return true;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function pill(ctx, x, y, text, bg, fg, align) {
    ctx.font = '700 12px ' + (cssVar('--font-ui') || 'sans-serif');
    const w = ctx.measureText(text).width + 16, h = 22;
    const x0 = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
    ctx.fillStyle = bg; roundRect(ctx, x0, y - h / 2, w, h, 11); ctx.fill();
    ctx.fillStyle = fg || '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x0 + 8, y + 0.5);
    return w;
  }
  function drawCloud(ctx, x, y, s) {
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.beginPath();
    for (const [cx, cy, rx, ry] of [[0, 0, 34, 12], [-16, -6, 16, 11], [10, -10, 20, 14]]) {
      ctx.moveTo(x + (cx + rx) * s, y + cy * s); // sub-caminho separado: sem "fiapos" entre as elipses
      ctx.ellipse(x + cx * s, y + cy * s, rx * s, ry * s, 0, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  // paraquedista: canopy = 0 (queda livre, de barriga) até 1 (velame cheio, em pé)
  function drawDiver(ctx, x, y, s, canopy, accent) {
    const suit = '#e7ebf0', dark = '#2b3440';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (canopy <= 0) {
      // posição "barriga para baixo", braços e pernas abertos
      ctx.strokeStyle = dark; ctx.lineWidth = 3.2 * s;
      ctx.beginPath(); ctx.moveTo(x - 9 * s, y); ctx.lineTo(x - 18 * s, y - 9 * s); ctx.stroke();   // braço
      ctx.beginPath(); ctx.moveTo(x + 9 * s, y); ctx.lineTo(x + 16 * s, y - 9 * s); ctx.lineTo(x + 22 * s, y - 12 * s); ctx.stroke(); // perna
      ctx.fillStyle = suit; ctx.strokeStyle = dark; ctx.lineWidth = 1.6 * s;
      roundRect(ctx, x - 12 * s, y - 4 * s, 24 * s, 9 * s, 4 * s); ctx.fill(); ctx.stroke(); // tronco
      ctx.fillStyle = accent; roundRect(ctx, x - 7 * s, y - 8 * s, 13 * s, 5 * s, 2 * s); ctx.fill(); // mochila
      ctx.fillStyle = '#9aa6b5'; ctx.beginPath(); ctx.arc(x - 16 * s, y + 1 * s, 5 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); // capacete
      return;
    }
    // velame
    const cw = 44 * s * (0.35 + 0.65 * canopy), ch = 15 * s * (0.4 + 0.6 * canopy);
    const cy = y - 44 * s;
    ctx.strokeStyle = 'rgba(40,50,60,.55)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const f of [-1, -0.45, 0.45, 1]) { ctx.moveTo(x + f * cw, cy + 2 * s); ctx.lineTo(x + f * 3 * s, y - 12 * s); }
    ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.ellipse(x, cy, cw, ch, 0, Math.PI, 0); ctx.closePath(); ctx.clip();
    const cells = 6;
    for (let i = 0; i < cells; i++) {
      ctx.fillStyle = i % 2 ? '#f3f4f6' : accent;
      ctx.fillRect(x - cw + (2 * cw * i) / cells, cy - ch - 1, (2 * cw) / cells + 0.5, ch + 2);
    }
    ctx.restore();
    ctx.strokeStyle = dark; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(x, cy, cw, ch, 0, Math.PI, 0); ctx.closePath(); ctx.stroke();
    // corpo em pé
    ctx.strokeStyle = dark; ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.moveTo(x - 3 * s, y - 10 * s); ctx.lineTo(x - 5 * s, y - 16 * s); ctx.moveTo(x + 3 * s, y - 10 * s); ctx.lineTo(x + 5 * s, y - 16 * s); ctx.stroke(); // braços
    ctx.beginPath(); ctx.moveTo(x - 2 * s, y + 2 * s); ctx.lineTo(x - 3 * s, y + 10 * s); ctx.moveTo(x + 2 * s, y + 2 * s); ctx.lineTo(x + 3 * s, y + 10 * s); ctx.stroke(); // pernas
    ctx.fillStyle = suit; ctx.lineWidth = 1.6 * s;
    roundRect(ctx, x - 5 * s, y - 11 * s, 10 * s, 15 * s, 4 * s); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9aa6b5'; ctx.beginPath(); ctx.arc(x, y - 15 * s, 4.5 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  function drawBurst(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2, rr = i % 2 ? r * 0.5 : r;
      ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.7);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffb020'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.42, r * 0.3, 0, 0, Math.PI * 2); ctx.fillStyle = '#e2401c'; ctx.fill();
  }
  function speedLines(ctx, x, y, v, color) {
    if (v < 3) return;
    const L = Math.min(46, 6 + v * 0.45);
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.globalAlpha = 0.55;
    ctx.beginPath();
    for (const dx of [-12, 0, 12]) { ctx.moveTo(x + dx, y - 16 - (dx === 0 ? 6 : 0)); ctx.lineTo(x + dx, y - 16 - L - (dx === 0 ? 6 : 0)); }
    ctx.stroke(); ctx.globalAlpha = 1;
  }

  function drawSky() {
    if (!sky.ctx || !state.sim) return;
    if (!resizeSky()) return; // aba escondida
    const ctx = sky.ctx, W = sky.w, H = sky.h, p = state.p, t = state.t;
    const sim = state.sim, vac = state.vac;
    ctx.setTransform(sky.dpr, 0, 0, sky.dpr, 0, 0);

    const top = 64, groundH = 40, rulerW = 74;
    const plotH = H - top - groundH;
    const groundY = H - groundH;
    const yOf = (alt) => top + (1 - Math.max(0, alt) / p.h0) * plotH;
    const s = Math.min(1.5, Math.max(0.85, H / 620));

    // céu
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2f6fc4'); g.addColorStop(0.55, '#86bbea'); g.addColorStop(1, '#d9edfb');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const cs = Math.min(1.4, W / 700);
    for (const cl of sky.clouds) drawCloud(ctx, rulerW + cl.x * (W - rulerW), top + cl.y * plotH, cl.s * cs);

    // régua de altitude
    ctx.fillStyle = 'rgba(255,255,255,0.62)'; ctx.fillRect(0, 0, rulerW, groundY);
    ctx.strokeStyle = '#0b0b0c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(rulerW - 1, top); ctx.lineTo(rulerW - 1, groundY); ctx.stroke();
    const step = niceStep(p.h0, 8);
    ctx.font = '700 11px ' + (cssVar('--font-ui') || 'sans-serif');
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#1f2a37';
    for (let a = 0; a <= p.h0 + 1e-9; a += step / 2) {
      const y = Math.round(yOf(a)) + 0.5;
      const major = Math.abs(a / step - Math.round(a / step)) < 1e-6;
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(rulerW - (major ? 12 : 7), y); ctx.lineTo(rulerW, y); ctx.stroke();
      if (major && a > 0) ctx.fillText(fmt(a, 0) + ' m', rulerW - 16, y); // 0 m = faixa do solo
    }

    // faixas e títulos
    const xa = rulerW + (W - rulerW) * 0.3, xb = rulerW + (W - rulerW) * 0.72;
    pill(ctx, xa, 20, 'SEM RESISTÊNCIA DO AR', COLOR.vac);
    pill(ctx, xb, 20, 'COM RESISTÊNCIA DO AR', COLOR.real);

    // saída do avião
    ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(rulerW, yOf(p.h0)); ctx.lineTo(W, yOf(p.h0)); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '600 11px ' + (cssVar('--font-ui') || 'sans-serif'); ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText('saída do avião · ' + fmt(p.h0, 0) + ' m', W - 8, yOf(p.h0) - 3);

    // linha de abertura do paraquedas
    if (p.parachute) {
      const y = yOf(p.deployAlt);
      ctx.setLineDash([8, 6]); ctx.strokeStyle = COLOR.orange; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(xb - (W - rulerW) * 0.2, y); ctx.lineTo(W, y); ctx.stroke(); ctx.setLineDash([]);
      pill(ctx, W - 8, y - 14, 'abrir aos ' + fmt(p.deployAlt, 0) + ' m', COLOR.orange, '#fff', 'right');
    }

    // solo
    const gg = ctx.createLinearGradient(0, groundY, 0, H);
    gg.addColorStop(0, '#5aa35a'); gg.addColorStop(1, '#2f6e34');
    ctx.fillStyle = gg; ctx.fillRect(0, groundY, W, groundH);
    ctx.font = '800 12px ' + (cssVar('--font-ui') || 'sans-serif'); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('SOLO · 0 m', 10, groundY + groundH / 2);

    // rastro (trajetória já percorrida)
    const sv = P.sampleAt(vac, t), sr = P.sampleAt(sim, t);
    ctx.lineWidth = 3; ctx.globalAlpha = 0.35;
    ctx.strokeStyle = COLOR.vac; ctx.beginPath(); ctx.moveTo(xa, yOf(p.h0)); ctx.lineTo(xa, yOf(sv.y)); ctx.stroke();
    ctx.strokeStyle = COLOR.real; ctx.beginPath(); ctx.moveTo(xb, yOf(p.h0)); ctx.lineTo(xb, yOf(sr.y)); ctx.stroke();
    ctx.globalAlpha = 1;

    // --- paraquedista A: sem resistência ---
    if (t >= vac.tEnd - 1e-6) {
      drawBurst(ctx, xa, groundY, 30 * s);
      pill(ctx, xa, groundY - 44 * s, 'IMPACTO · ' + fmt(vac.landing.v, 0) + ' m/s', COLOR.vac);
    } else {
      const y = yOf(sv.y) - 6 * s;
      speedLines(ctx, xa, y, sv.v, '#ffffff');
      drawDiver(ctx, xa, y, s, 0, COLOR.vac);
      pill(ctx, xa + 30 * s, y, fmt(sv.v, 1) + ' m/s', 'rgba(11,11,12,.82)', '#fff', 'left');
    }

    // --- paraquedista B: com resistência ---
    const dep = sim.deploy;
    const canopy = dep && t >= dep.t ? Math.min(1, (t - dep.t) / sim.inflate) : 0;
    const landed = t >= sim.tEnd - 1e-6;
    const vLand = sim.landing ? sim.landing.v : sr.v;
    if (landed && vLand > 12) {
      drawBurst(ctx, xb, groundY, 26 * s);
      pill(ctx, xb, groundY - 44 * s, 'IMPACTO · ' + fmt(vLand, 1) + ' m/s', COLOR.vac);
    } else {
      const y = yOf(sr.y) - (canopy > 0 ? 10 * s : 6 * s);
      speedLines(ctx, xb, canopy > 0 ? y - 60 * s : y, sr.v, '#ffffff');
      drawDiver(ctx, xb, y, s, canopy, COLOR.orange);
      if (landed) pill(ctx, xb + 26 * s, y - 4 * s, (vLand <= 7 ? '✓ POUSO · ' : 'POUSO DURO · ') + fmt(vLand, 1) + ' m/s', vLand <= 7 ? COLOR.green : COLOR.orange, '#fff', 'left');
      else pill(ctx, xb + 30 * s, y, fmt(sr.v, 1) + ' m/s', 'rgba(11,11,12,.82)', '#fff', 'left');
    }
  }

  // ---------------- Abas e atalhos ----------------
  const TABS = ['sim', 'r1', 'r2', 'r3'];
  function selectTab(name, focus) {
    for (const n of TABS) {
      const btn = $('tabbtn-' + n), panel = $('tab-' + n), on = n === name;
      btn.setAttribute('aria-selected', String(on));
      btn.tabIndex = on ? 0 : -1;
      panel.hidden = !on;
      panel.classList.toggle('active', on);
      if (on && focus) btn.focus();
    }
    if (name !== 'sim') pause();
    // canvases que estavam escondidos precisam medir o tamanho de novo
    requestAnimationFrame(() => {
      Object.values(charts).forEach((c) => c.resize());
      if (name === 'sim') renderFrame();
    });
  }
  function bindTabs() {
    document.querySelectorAll('.tab').forEach((btn) => {
      btn.addEventListener('click', () => selectTab(btn.dataset.tab));
      btn.addEventListener('keydown', (e) => {
        const i = TABS.indexOf(btn.dataset.tab);
        if (e.key === 'ArrowRight') { e.preventDefault(); selectTab(TABS[(i + 1) % TABS.length], true); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); selectTab(TABS[(i + TABS.length - 1) % TABS.length], true); }
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target && e.target.tagName) || '';
      const isRange = tag === 'INPUT' && e.target.type === 'range';
      const typing = (tag === 'INPUT' && !isRange) || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON';
      const simActive = !$('tab-sim').hidden;
      if (e.key === ' ' && !typing && simActive) { e.preventDefault(); togglePlay(); }
      else if ((e.key === 'r' || e.key === 'R') && simActive && tag !== 'INPUT') { reset(); }
      else if (/^[1-4]$/.test(e.key) && !(tag === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox')) { selectTab(TABS[+e.key - 1]); }
      else if ((e.key === 'f' || e.key === 'F') && tag !== 'INPUT') {
        try {
          if (!document.fullscreenElement) document.documentElement.requestFullscreen();
          else document.exitFullscreen();
        } catch (_) { /* navegador sem suporte: ignora */ }
      }
    });
    // ao voltar para a janela, não "pula" o tempo
    document.addEventListener('visibilitychange', () => { state.last = performance.now(); });
  }

  // ---------------- Início ----------------
  function init() {
    if (!P || !window.LineChart) {
      document.body.insertAdjacentHTML('afterbegin', '<p class="noscript">Erro ao carregar os scripts. Verifique se as pastas js/ e css/ estão junto do index.html.</p>');
      return;
    }
    initCharts();
    initSky();
    syncControls();
    bindControls();
    bindReguas();
    bindTabs();
    $('sel-speed').value = String(state.speed);
    recompute();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
