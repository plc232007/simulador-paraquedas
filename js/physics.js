/*
 * physics.js — toda a matemática do simulador (sem dependência de DOM).
 *
 * Convenções:
 *   y  = altitude em relação ao solo (m), positiva para cima
 *   s  = distância já percorrida na queda (m), s = h0 − y
 *   v  = velocidade de queda (m/s), positiva PARA BAIXO (módulo da velocidade)
 *   a  = aceleração (m/s²), positiva para baixo (a = dv/dt)
 *
 * Funciona no navegador (window.Physics) e no Node (module.exports) para os testes.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Physics = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- Constantes atmosféricas (atmosfera isotérmica) ----------
  const R = 8.314;        // constante universal dos gases (J/(mol·K))
  const M_AR = 0.02896;   // massa molar do ar (kg/mol)
  const T0 = 288.15;      // temperatura de referência (K) = 15 °C
  const P0 = 101325;      // pressão ao nível do mar (Pa)

  // Valores usados nos slides da apresentação
  const DEFAULTS = Object.freeze({
    m: 90,            // massa (kg)
    g: 9.8,           // gravidade (m/s²)
    h0: 4000,         // altitude de saída (m)
    rho: 1.225,       // densidade do ar ao nível do mar (kg/m³)
    cd: 1.0,          // coeficiente de arrasto do corpo
    area: 0.70,       // área frontal do corpo (m²)
    parachute: true,  // abrir paraquedas?
    deployAlt: 1200,  // altitude de abertura (m)
    canopyArea: 30,   // área do velame (m²)
    canopyCd: 1.5,    // coeficiente de arrasto do velame
    inflateTime: 3,   // tempo de inflagem do velame (s)
    varyDensity: false // densidade do ar varia com a altitude?
  });

  // ---------- Utilidades numéricas estáveis ----------
  // ln(cosh(x)) sem overflow para x grande
  function logCosh(x) {
    const ax = Math.abs(x);
    return ax + Math.log1p(Math.exp(-2 * ax)) - Math.LN2;
  }
  // acosh(e^L) sem overflow: L + ln(1 + sqrt(1 − e^{−2L}))
  function acoshExp(L) {
    return L + Math.log1p(Math.sqrt(-Math.expm1(-2 * L)));
  }

  // ---------- Régua 2: altímetro barométrico ----------
  // dP/dh = −ρg  e  ρ = PM/(RT)  ⇒  dP/dh = −P/H  ⇒  P(h) = P0·e^(−h/H)
  function scaleHeight(g) { return (R * T0) / (M_AR * g); }
  function pressureAt(h, g) { return P0 * Math.exp(-h / scaleHeight(g)); }
  function altitudeFromPressure(P, g) { return -scaleHeight(g) * Math.log(P / P0); }
  function densityAt(h, rho0, g) { return rho0 * Math.exp(-h / scaleHeight(g)); }
  // Regra da cadeia: dP/dt = (dP/dh)·(dh/dt) = (−P/H)·(−v) = P·v/H  (v para baixo ⇒ pressão sobe)
  function pressureRate(h, vDown, g) { return (pressureAt(h, g) * vDown) / scaleHeight(g); }

  // ---------- Régua 1: queda livre sem resistência ----------
  // a = g ;  v(t) = ∫a dt = g·t ;  y(t) = h0 − ∫v dt = h0 − ½·g·t²
  function vacuumAt(t, p) {
    const tc = Math.max(0, Math.min(t, vacuumImpact(p).t));
    return { t: tc, a: p.g, v: p.g * tc, s: 0.5 * p.g * tc * tc, y: p.h0 - 0.5 * p.g * tc * tc };
  }
  function vacuumImpact(p) {
    const t = Math.sqrt((2 * p.h0) / p.g);
    return { t, v: p.g * t };
  }

  // ---------- Régua 3: resistência do ar (arrasto quadrático) ----------
  // m·dv/dt = m·g − k·v² ,  k = ½·ρ·Cd·A
  function dragK(p) { return 0.5 * p.rho * p.cd * p.area; }
  // dv/dt = 0  ⇒  v_t = √(2mg / (ρ·Cd·A))
  function terminalVelocity(p, cdA) {
    const CdA = cdA === undefined ? p.cd * p.area : cdA;
    return Math.sqrt((2 * p.m * p.g) / (p.rho * CdA));
  }
  // Solução analítica (v0 = 0):  v(t) = v_t·tanh(g·t/v_t) ;  s(t) = (v_t²/g)·ln(cosh(g·t/v_t))
  function dragAt(t, p) {
    const vt = terminalVelocity(p);
    const tc = Math.max(0, Math.min(t, dragGroundTime(p)));
    const x = (p.g * tc) / vt;
    const v = vt * Math.tanh(x);
    const s = ((vt * vt) / p.g) * logCosh(x);
    const a = p.g * (1 - (v / vt) * (v / vt));
    return { t: tc, a, v, s, y: Math.max(0, p.h0 - s), vt };
  }
  // tempo até atingir uma fração f de v_t:  tanh(g·t/v_t) = f  ⇒  t = (v_t/g)·atanh(f)
  function timeToFraction(f, p) {
    return (terminalVelocity(p) / p.g) * Math.atanh(f);
  }
  // tempo até o solo SEM abrir paraquedas:  s(t) = h0
  function dragGroundTime(p) {
    const vt = terminalVelocity(p);
    const L = (p.h0 * p.g) / (vt * vt);
    return (vt / p.g) * acoshExp(L);
  }

  // ---------- Simulação completa (RK4) ----------
  // Inclui: arrasto do corpo, abertura e inflagem do paraquedas, densidade variável (opcional).
  function simulate(p) {
    const dt = 0.01;          // passo de integração (s)
    const rec = 5;            // grava 1 amostra a cada 5 passos (0,05 s)
    const maxT = 3600;
    const H = scaleHeight(p.g);
    const cdaBody = p.cd * p.area;
    const cdaCanopy = Math.max(cdaBody, p.canopyCd * p.canopyArea);
    const inflate = Math.max(0.1, p.inflateTime);

    let tDeploy = null;
    let deploy = null;
    if (p.parachute && p.deployAlt >= p.h0) { tDeploy = 0; deploy = { t: 0, y: p.h0, v: 0 }; }

    function cdaAt(t) {
      if (tDeploy === null || t < tDeploy) return cdaBody;
      const f = Math.min(1, (t - tDeploy) / inflate);
      return cdaBody + f * (cdaCanopy - cdaBody);
    }
    function acc(t, s, v) {
      const y = Math.max(0, p.h0 - s);
      const rho = p.varyDensity ? densityAt(y, p.rho, p.g) : p.rho;
      return p.g - (0.5 * rho * cdaAt(t) * v * Math.abs(v)) / p.m;
    }

    const T = [0], Y = [p.h0], V = [0], A = [acc(0, 0, 0)], C = [cdaAt(0)];
    let t = 0, s = 0, v = 0;
    let landing = null;
    let maxV = 0, maxDecel = 0;
    let t99 = null;
    const vtBody = terminalVelocity(p);

    const steps = Math.ceil(maxT / dt);
    for (let i = 1; i <= steps; i++) {
      const k1v = acc(t, s, v), k1s = v;
      const k2v = acc(t + dt / 2, s + (dt / 2) * k1s, v + (dt / 2) * k1v), k2s = v + (dt / 2) * k1v;
      const k3v = acc(t + dt / 2, s + (dt / 2) * k2s, v + (dt / 2) * k2v), k3s = v + (dt / 2) * k2v;
      const k4v = acc(t + dt, s + dt * k3s, v + dt * k3v), k4s = v + dt * k3v;
      const vNew = v + (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
      const sNew = s + (dt / 6) * (k1s + 2 * k2s + 2 * k3s + k4s);
      const tNew = t + dt;
      const yOld = p.h0 - s, yNew = p.h0 - sNew;

      // evento: abertura do paraquedas (interpola o instante exato de cruzar a altitude)
      if (p.parachute && tDeploy === null && yNew <= p.deployAlt && yNew > 0) {
        const f = (yOld - p.deployAlt) / (yOld - yNew);
        tDeploy = t + f * dt;
        deploy = { t: tDeploy, y: p.deployAlt, v: v + f * (vNew - v) };
      }
      // evento: 99% da velocidade terminal do corpo (antes de abrir)
      if (t99 === null && tDeploy === null && vNew >= 0.99 * vtBody) {
        const f = (0.99 * vtBody - v) / (vNew - v);
        t99 = { t: t + f * dt, y: yOld + f * (yNew - yOld) };
      }
      // evento: chegada ao solo (interpola até y = 0 exato)
      if (yNew <= 0) {
        const f = yOld / (yOld - yNew);
        const tL = t + f * dt, vL = v + f * (vNew - v);
        T.push(tL); Y.push(0); V.push(vL); A.push(acc(tL, p.h0, vL)); C.push(cdaAt(tL));
        landing = { t: tL, v: vL };
        maxV = Math.max(maxV, vL);
        break;
      }

      t = tNew; s = sNew; v = vNew;
      maxV = Math.max(maxV, v);
      const aNow = acc(t, s, v);
      maxDecel = Math.max(maxDecel, -aNow);
      if (i % rec === 0) { T.push(t); Y.push(p.h0 - s); V.push(v); A.push(aNow); C.push(cdaAt(t)); }
    }
    if (!landing) { T.push(t); Y.push(p.h0 - s); V.push(v); A.push(acc(t, s, v)); C.push(cdaAt(t)); }

    return {
      T, Y, V, A, C,
      tEnd: T[T.length - 1],
      deploy, landing, t99,
      maxV, maxDecel,
      cdaBody, cdaCanopy, inflate,
      vtBody,
      vtCanopy: terminalVelocity(p, cdaCanopy)
    };
  }

  // Trajetória sem resistência no mesmo formato da simulação (para gráficos/animação)
  function vacuumTrajectory(p) {
    const imp = vacuumImpact(p);
    const T = [], Y = [], V = [], A = [];
    const n = Math.max(2, Math.ceil(imp.t / 0.05));
    for (let i = 0; i <= n; i++) {
      const t = (imp.t * i) / n;
      const st = vacuumAt(t, p);
      T.push(t); Y.push(Math.max(0, st.y)); V.push(st.v); A.push(p.g);
    }
    Y[Y.length - 1] = 0;
    return { T, Y, V, A, tEnd: imp.t, landing: { t: imp.t, v: imp.v } };
  }

  // Interpolação linear de uma trajetória no instante t
  function sampleAt(tr, t) {
    const T = tr.T, n = T.length;
    if (!(t > 0)) return pick(tr, 0, 0);
    if (t >= T[n - 1]) return pick(tr, n - 1, 0);
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (T[mid] <= t) lo = mid; else hi = mid;
    }
    const f = (t - T[lo]) / (T[hi] - T[lo]);
    return pick(tr, lo, f);
  }
  function pick(tr, i, f) {
    const j = Math.min(i + 1, tr.T.length - 1);
    const L = (arr) => (arr ? arr[i] + f * (arr[j] - arr[i]) : undefined);
    return { t: L(tr.T), y: L(tr.Y), v: L(tr.V), a: L(tr.A), cda: L(tr.C) };
  }

  return {
    R, M_AR, T0, P0, DEFAULTS,
    logCosh, acoshExp,
    scaleHeight, pressureAt, altitudeFromPressure, densityAt, pressureRate,
    vacuumAt, vacuumImpact,
    dragK, terminalVelocity, dragAt, timeToFraction, dragGroundTime,
    simulate, vacuumTrajectory, sampleAt
  };
});
