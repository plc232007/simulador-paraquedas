// Rode com:  node --test tests/physics.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/physics.js');

const p = { ...P.DEFAULTS, deployMode: 'auto' };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≉ ${b} (±${tol})`);

test('Régua 1 — queda sem resistência', () => {
  const st = P.vacuumAt(5, p);
  near(st.v, 49, 1e-9, 'v(5)');
  near(st.y, 3877.5, 1e-9, 'y(5)');
  const imp = P.vacuumImpact(p);
  near(imp.t, 28.571, 1e-3, 't impacto');
  near(imp.v, 280, 1e-6, 'v impacto');
  // não passa do solo
  near(P.vacuumAt(999, p).y, 0, 1e-9, 'y após impacto');
});

test('Régua 2 — altímetro barométrico', () => {
  const H = P.scaleHeight(p.g);
  near(H, 8441.5, 1, 'escala de altura H');
  near(P.pressureAt(0, p.g), 101325, 1e-9, 'P0');
  // ida e volta pressão → altitude
  for (const h of [0, 500, 1200, 4000]) {
    near(P.altitudeFromPressure(P.pressureAt(h, p.g), p.g), h, 1e-6, `inversa h=${h}`);
  }
  // derivada numérica confere dP/dh = −P/H
  const h = 2000, e = 1e-3;
  const dPdh = (P.pressureAt(h + e, p.g) - P.pressureAt(h - e, p.g)) / (2 * e);
  near(dPdh, -P.pressureAt(h, p.g) / H, 1e-6, 'dP/dh');
});

test('Régua 3 — velocidade terminal (valores do slide)', () => {
  near(P.terminalVelocity(p), 45.36, 0.01, 'v_t');
  const t99 = P.timeToFraction(0.99, p);
  near(t99, 12.25, 0.01, 't 99%');
  const st = P.dragAt(t99, p);
  near(st.v / st.vt, 0.99, 1e-9, 'fração 99%');
  near(st.s, 411.2, 0.5, 'distância até 99%');
  // limite t→∞
  near(P.dragAt(1e6, { ...p, h0: 1e12 }).v, P.terminalVelocity(p), 1e-6, 'limite');
  // tempo até o solo sem paraquedas consistente com s(t) = h0
  const tg = P.dragGroundTime(p);
  near(P.dragAt(tg, p).s, p.h0, 1e-6, 's(t_solo)');
});

test('RK4 bate com a solução analítica (sem paraquedas)', () => {
  const q = { ...p, deployMode: 'never' };
  const sim = P.simulate(q);
  for (const t of [1, 5, 12.25, 30, 60]) {
    const num = P.sampleAt(sim, t), ana = P.dragAt(t, q);
    near(num.v, ana.v, 0.02, `v(${t})`);
    near(num.y, ana.y, 0.1, `y(${t})`);
  }
  near(sim.landing.t, P.dragGroundTime(q), 0.02, 'tempo até o solo');
  near(sim.t99.t, P.timeToFraction(0.99, q), 0.02, 't99 RK4');
});

test('Simulação com paraquedas pousa em segurança', () => {
  const sim = P.simulate(p);
  assert.ok(sim.deploy, 'paraquedas abriu');
  near(sim.deploy.y, p.deployAlt, 1e-9, 'altitude de abertura');
  assert.ok(sim.landing, 'pousou');
  assert.ok(sim.landing.v < 7, `pouso suave (v=${sim.landing.v})`);
  near(sim.landing.v, sim.vtCanopy, 0.05, 'pousa na v terminal do velame');
  assert.ok(sim.maxDecel / p.g < 6, `desaceleração de abertura razoável (${(sim.maxDecel / p.g).toFixed(1)} g)`);
  assert.equal(sim.Y[sim.Y.length - 1], 0);
  // tempos crescentes, sem NaN
  for (let i = 1; i < sim.T.length; i++) {
    assert.ok(sim.T[i] > sim.T[i - 1], 'tempo crescente');
    assert.ok(Number.isFinite(sim.V[i]) && Number.isFinite(sim.Y[i]), 'finito');
  }
});

test('Abertura manual e dispositivo de segurança (AAD)', () => {
  // botão apertado aos 50 s
  const man = P.simulate({ ...p, deployMode: 'manual', deployTime: 50 });
  assert.equal(man.deploy.by, 'manual');
  near(man.deploy.t, 50, 1e-9, 'instante do botão');
  assert.ok(man.landing.v < 7, 'pouso suave');
  // trajetória idêntica antes do botão
  const free = P.simulate({ ...p, deployMode: 'never' });
  near(P.sampleAt(man, 49).y, P.sampleAt(free, 49).y, 1e-9, 'antes do botão nada muda');
  // esqueceu de abrir → AAD abre a 225 m e salva
  const aad = P.simulate({ ...p, deployMode: 'manual', deployTime: null, aad: true });
  assert.equal(aad.deploy.by, 'aad');
  near(aad.deploy.y, P.AAD_ALT, 0.5, 'altitude do AAD');
  assert.ok(aad.landing.v < 12, `AAD evita impacto fatal (v=${aad.landing.v.toFixed(1)})`);
  // sem AAD e sem botão → impacto
  const sem = P.simulate({ ...p, deployMode: 'manual', deployTime: null, aad: false });
  assert.equal(sem.deploy, null);
  near(sem.landing.v, P.terminalVelocity(p), 0.05, 'impacto em v_t');
  // nunca abrir ignora o AAD
  assert.equal(P.simulate({ ...p, deployMode: 'never', aad: true }).deploy, null);
  // fases da abertura
  assert.deepEqual(P.deployFraction(-1), { pilot: 0, stretch: 0, fill: 0 });
  assert.equal(P.deployFraction(P.PHASE.full).fill, 1);
});

test('Casos-limite não quebram', () => {
  const casos = [
    { ...p, h0: 1000, deployAlt: 800 },
    { ...p, deployAlt: 5000 },             // abertura acima da saída → abre na hora
    { ...p, deployMode: 'manual', deployTime: 0.001 },
    { ...p, deployMode: 'manual', deployTime: 1e6 },
    { ...p, m: 50, area: 1.2, cd: 1.5 },
    { ...p, m: 150, area: 0.3, cd: 0.5, h0: 6000 },
    { ...p, varyDensity: true },
    { ...p, canopyArea: 10 },
  ];
  for (const c of casos) {
    const sim = P.simulate(c);
    assert.ok(sim.landing, 'pousou');
    assert.ok(Number.isFinite(sim.tEnd) && sim.tEnd > 0);
    const s = P.sampleAt(sim, sim.tEnd / 2);
    assert.ok(Number.isFinite(s.v) && Number.isFinite(s.y));
  }
  // densidade variável ⇒ cai mais rápido no alto
  const a = P.simulate({ ...p, deployMode: 'never' });
  const b = P.simulate({ ...p, deployMode: 'never', varyDensity: true });
  assert.ok(b.maxV > a.maxV);
  // sampleAt fora do intervalo
  const sim = P.simulate(p);
  assert.equal(P.sampleAt(sim, -5).y, p.h0);
  assert.equal(P.sampleAt(sim, 1e9).y, 0);
  assert.equal(P.sampleAt(sim, NaN).y, p.h0);
});
