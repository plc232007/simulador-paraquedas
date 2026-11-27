/*
 * scene.js — desenho do jogo em <canvas>.
 *   Scene.draw(ctx, W, H, S)
 * Mundo em metros: x horizontal (alvo em x = 0), alt = altitude.
 * A câmera segue o avião (antes do salto) ou o paraquedista.
 */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const C = {
    suit: '#e3e7ec', suitDark: '#b4bdc8', line: '#1b2330', orange: '#e8701a', helmet: '#aeb9c6',
    visor: '#22344b', glove: '#6e4f33', boot: '#8a5a33', pack: '#363f4c', navy: '#1d3557', white: '#f5f6f8', red: '#c8283a'
  };
  const FONT = '"Inter", "Segoe UI", "Helvetica Neue", Roboto, Arial, sans-serif';
  const SPAN = 170; // metros visíveis na vertical

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function hash2(i, j) { return hash(i * 73.13 + j * 19.71); }
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function limb(ctx, pts, w, color) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.strokeStyle = C.line; ctx.lineWidth = w + 2.2; ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
  }
  function dot(ctx, x, y, r, color) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = color; ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = C.line; ctx.stroke();
  }

  // ---------- paraquedista ----------
  // queda livre, barriga para baixo, cabeça à esquerda; origem = centro do tronco
  function freefallPose(ctx) {
    limb(ctx, [[11, -1], [23, -4], [30, -13]], 6, C.suitDark); dot(ctx, 31, -14, 3.2, C.boot);
    limb(ctx, [[-9, -2], [-17, -10], [-26, -10]], 5, C.suitDark); dot(ctx, -27, -10, 2.8, C.glove);
    rr(ctx, -15, -6, 31, 12, 6); ctx.fillStyle = C.suit; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = C.orange; ctx.fillRect(4, -6, 4, 12); ctx.restore();
    rr(ctx, -15, -6, 31, 12, 6); ctx.lineWidth = 1.4; ctx.strokeStyle = C.line; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-9, -6); ctx.lineTo(-6, 6); ctx.moveTo(11, -6); ctx.lineTo(12, 6); ctx.lineWidth = 1.6; ctx.stroke();
    rr(ctx, -12, -12, 23, 7, 3); ctx.fillStyle = C.pack; ctx.fill(); ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = C.orange; ctx.fillRect(-4, -11.4, 6, 5.8);
    limb(ctx, [[9, 2], [21, 1], [29, -7]], 6.5, C.suit); dot(ctx, 30, -8, 3.4, C.boot); dot(ctx, 21, 1, 1.8, C.orange);
    limb(ctx, [[-8, 1], [-16, -4], [-25, -2]], 5.5, C.suit); dot(ctx, -26, -2, 3, C.glove);
    dot(ctx, -21, 0, 6.8, C.helmet);
    ctx.beginPath(); ctx.arc(-21, 0, 5.3, 0.55 * Math.PI, 1.2 * Math.PI); ctx.closePath(); ctx.fillStyle = C.visor; ctx.fill();
    ctx.beginPath(); ctx.arc(-21, 0, 5.2, 1.35 * Math.PI, 1.6 * Math.PI); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.2; ctx.stroke();
  }
  // em pé (origem = quadril, botas em y ≈ +22). lh/rh = mão puxando o batoque (0 = em cima, 1 = embaixo)
  function uprightPose(ctx, lh, rh) {
    limb(ctx, [[-3, 0], [-4.5, 11], [-3.5, 20]], 6, C.suit);
    limb(ctx, [[3, 0], [4.5, 11], [3.5, 20]], 6, C.suit);
    ctx.beginPath(); ctx.ellipse(-4, 22, 4, 2.6, 0, 0, TAU); ctx.fillStyle = C.boot; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(4, 22, 4, 2.6, 0, 0, TAU); ctx.fill(); ctx.stroke();
    const arm = (sx, k) => {
      const ex = sx * (11 - 1 * k), ey = -27 + 11 * k, hx = sx * (9 + 1 * k), hy = -36 + 30 * k;
      limb(ctx, [[sx * 6, -19], [ex, ey], [hx, hy]], 5, C.suit); dot(ctx, hx, hy - 1, 2.8, C.glove);
    };
    arm(-1, lh); arm(1, rh);
    rr(ctx, -7.5, -23, 15, 24, 6); ctx.fillStyle = C.suit; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = C.orange; ctx.fillRect(-7.5, -10, 15, 3.5); ctx.restore();
    rr(ctx, -7.5, -23, 15, 24, 6); ctx.strokeStyle = C.line; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, -15); ctx.lineTo(6, -15); ctx.moveTo(-5, -1); ctx.lineTo(-2, 4); ctx.moveTo(5, -1); ctx.lineTo(2, 4); ctx.lineWidth = 1.8; ctx.stroke();
    dot(ctx, 0, -29, 6.4, C.helmet);
    ctx.beginPath(); ctx.ellipse(0, -28, 4.4, 3.1, 0, 0, TAU); ctx.fillStyle = C.visor; ctx.fill();
  }
  function canopy(ctx, cx, top, w, th, droop, fill, time) {
    const N = 9, cols = [C.orange, C.white, C.navy, C.white];
    const wob = (u) => (1 - fill) * Math.sin(u * 9 + time * 13) * 3;
    const topY = (u) => top + droop * u * u + wob(u);
    for (let i = 0; i < N; i++) {
      const u0 = -1 + (2 * i) / N, u1 = -1 + (2 * (i + 1)) / N;
      ctx.beginPath();
      ctx.moveTo(cx + (u0 * w) / 2, topY(u0)); ctx.lineTo(cx + (u1 * w) / 2, topY(u1));
      ctx.lineTo(cx + (u1 * w) / 2, topY(u1) + th); ctx.lineTo(cx + (u0 * w) / 2, topY(u0) + th);
      ctx.closePath(); ctx.fillStyle = cols[i % 4]; ctx.fill();
    }
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) { const u = -1 + i / 12; const x = cx + (u * w) / 2; i ? ctx.lineTo(x, topY(u)) : ctx.moveTo(x, topY(u)); }
    for (let i = 24; i >= 0; i--) { const u = -1 + i / 12; ctx.lineTo(cx + (u * w) / 2, topY(u) + th); }
    ctx.closePath(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.3; ctx.stroke();
    return [-1, -0.6, -0.2, 0.2, 0.6, 1].map((u) => [cx + (u * w) / 2, topY(u) + th]);
  }
  function pilotChute(ctx, x, y, r) {
    ctx.beginPath(); ctx.arc(x, y, r, Math.PI, 0); ctx.closePath();
    ctx.fillStyle = C.orange; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();
  }

  // D = { frac, heading, steer, flaring, collapse, dir (para onde olha na queda livre), time }
  function skydiver(ctx, x, y, s, D) {
    const f = D.frac;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (!f) {
      ctx.rotate(Math.sin(D.time * 2.1) * 0.05);
      if (D.dir > 0) ctx.scale(-1, 1);
      freefallPose(ctx);
    } else if (f.stretch < 1) {
      const up = 14 + f.pilot * 30 + f.stretch * 34;
      ctx.strokeStyle = C.line; ctx.lineWidth = 0.9;
      if (f.stretch > 0) {
        const bagY = -up;
        ctx.beginPath();
        for (const dx of [-4, -1, 1, 4]) { ctx.moveTo(dx * 0.6, -8); ctx.lineTo(dx, bagY + 6); }
        ctx.stroke();
        rr(ctx, -5, bagY - 4, 10, 10, 2); ctx.fillStyle = C.pack; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, bagY - 4); ctx.lineTo(0, bagY - 20); ctx.stroke();
        pilotChute(ctx, 0, bagY - 22, 7);
      } else {
        ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, -up); ctx.stroke();
        pilotChute(ctx, 0, -up - 2, 3 + f.pilot * 4);
      }
      ctx.save(); ctx.rotate(f.stretch * Math.PI / 2 * (D.dir > 0 ? -1 : 1)); if (D.dir > 0) ctx.scale(-1, 1); freefallPose(ctx); ctx.restore();
    } else {
      const c = D.collapse || 0, e = c * c * (3 - 2 * c);
      const turn = Math.sin(D.heading || 0);
      const bank = (D.steer || 0) * 0.18 * (1 - e);
      const sway = Math.sin(D.time * 1.3) * 0.04 * f.fill * (1 - e);
      ctx.rotate(bank + sway);
      const L = 58;
      const side = 0.45 + 0.55 * Math.cos(D.heading || 0); // de perfil o velame parece mais estreito
      const w = 74 * (0.3 + 0.7 * f.fill) * side * (1 + 0.15 * e);
      const th = 10 * (0.55 + 0.45 * f.fill) * (1 - 0.65 * e) * (D.flaring ? 1.25 : 1);
      const droop = 14 * (0.5 + 0.5 * f.fill) * (1 - 0.9 * e);
      const cx = turn * 10 * (1 - e) + 62 * e * (D.collapseDir || 1);
      const bottom = (-22 - L + (D.flaring ? 6 : 0)) * (1 - e) + 21 * e;
      const pts = canopy(ctx, cx, bottom - th, w, th, droop, Math.max(0.2, f.fill * (1 - 0.5 * e)), D.time);
      ctx.strokeStyle = 'rgba(27,35,48,.55)'; ctx.lineWidth = 0.8;
      ctx.beginPath();
      pts.forEach((p, i) => { ctx.moveTo(p[0], p[1]); ctx.lineTo(i < 3 ? -6 : 6, -21); });
      ctx.stroke();
      if (c < 0.5) pilotChute(ctx, cx, bottom - th - 3, 3);
      // seta da direção de voo do velame
      if (Math.abs(turn) > 0.15 && e < 0.1) {
        const ax = cx + Math.sign(turn) * (w / 2 + 10), ay = bottom - th / 2 + droop * 0.6;
        ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath();
        ctx.moveTo(ax + Math.sign(turn) * 9, ay); ctx.lineTo(ax, ay - 6); ctx.lineTo(ax, ay + 6); ctx.closePath(); ctx.fill();
      }
      const pullL = D.flaring ? 1 : D.steer < 0 ? 0.85 : 0;
      const pullR = D.flaring ? 1 : D.steer > 0 ? 0.85 : 0;
      uprightPose(ctx, e > 0.5 ? 0.9 : pullL, e > 0.5 ? 0.9 : pullR);
    }
    ctx.restore();
  }

  function plane(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.lineWidth = 1.3; ctx.strokeStyle = C.line;
    ctx.beginPath(); ctx.moveTo(-40, -8); ctx.lineTo(-50, -27); ctx.lineTo(-38, -27); ctx.lineTo(-26, -8); ctx.closePath();
    ctx.fillStyle = '#d5dbe3'; ctx.fill(); ctx.stroke();
    rr(ctx, -48, -9, 96, 18, 9); ctx.fillStyle = '#eef1f5'; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = C.orange; ctx.fillRect(-48, 2, 96, 3.5); ctx.restore();
    rr(ctx, -48, -9, 96, 18, 9); ctx.stroke();
    ctx.fillStyle = C.visor;
    for (let wx = -14; wx <= 26; wx += 9) { ctx.beginPath(); ctx.arc(wx, -3, 2, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#1b2330'; ctx.fillRect(-30, -6, 9, 13);
    ctx.beginPath(); ctx.ellipse(2, 6, 28, 4, 0, 0, TAU); ctx.fillStyle = '#c3cad4'; ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(27,35,48,.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(50, -10); ctx.lineTo(50, 10); ctx.stroke();
    ctx.restore();
  }
  function burst(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU, q = i % 2 ? r * 0.5 : r; ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q * 0.7); }
    ctx.closePath(); ctx.fillStyle = '#ffb020'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.42, r * 0.3, 0, 0, TAU); ctx.fillStyle = '#e2401c'; ctx.fill();
  }
  function cloud(ctx, x, y, w, h, alpha) {
    ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
    ctx.beginPath();
    for (const [bx, by, br] of [[-0.32, 0.1, 0.3], [-0.1, -0.15, 0.36], [0.16, -0.05, 0.32], [0.34, 0.12, 0.24], [0, 0.18, 0.42]]) {
      const cx = x + bx * w, cy = y + by * h * 2, rx = br * w, ry = br * h * 2.2;
      ctx.moveTo(cx + rx, cy); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    }
    ctx.fill();
  }
  function tree(ctx, x, gy, h) {
    ctx.fillStyle = '#5b3d24'; ctx.fillRect(x - h * 0.06, gy - h * 0.45, h * 0.12, h * 0.45);
    ctx.fillStyle = '#2f6b35';
    ctx.beginPath(); ctx.arc(x, gy - h * 0.62, h * 0.3, 0, TAU); ctx.arc(x - h * 0.18, gy - h * 0.48, h * 0.22, 0, TAU); ctx.arc(x + h * 0.18, gy - h * 0.48, h * 0.22, 0, TAU); ctx.fill();
  }
  function house(ctx, x, gy, u) {
    ctx.fillStyle = '#f1e3c8'; ctx.fillRect(x - 5 * u, gy - 6 * u, 10 * u, 6 * u);
    ctx.fillStyle = '#b4532a'; ctx.beginPath(); ctx.moveTo(x - 6.5 * u, gy - 6 * u); ctx.lineTo(x, gy - 10 * u); ctx.lineTo(x + 6.5 * u, gy - 6 * u); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5b6472'; ctx.fillRect(x - 1.2 * u, gy - 3.2 * u, 2.4 * u, 3.2 * u);
  }

  // ---------- quadro ----------
  function draw(ctx, W, H, S) {
    const ppm = H / SPAN;
    const camX = S.camX, camAlt = Math.max(S.camAlt, SPAN * 0.32);
    const X = (x) => W / 2 + (x - camX) * ppm;
    const Y = (alt) => H / 2 - (alt - camAlt) * ppm;
    const xL = camX - W / 2 / ppm, xR = camX + W / 2 / ppm;
    const aB = camAlt - SPAN / 2, aT = camAlt + SPAN / 2;
    const s = clamp(H / 420, 1.1, 2.2);
    const st = S.st;

    // céu (mais escuro no alto)
    const k = clamp(camAlt / 4000, 0, 1);
    const mix = (a, b) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgb(' + mix([120, 182, 236], [28, 84, 172]) + ')');
    g.addColorStop(1, 'rgb(' + mix([214, 236, 250], [128, 184, 234]) + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // nuvens (fixas no mundo, em células de 300 m × 140 m)
    const cloudsFront = [];
    for (let j = Math.floor((aB - 60) / 140); j <= Math.ceil((aT + 60) / 140); j++) {
      const baseAlt = j * 140;
      if (baseAlt < 350 || baseAlt > S.p.h0 + 400) continue;
      for (let i = Math.floor((xL - 200) / 300); i <= Math.ceil((xR + 200) / 300); i++) {
        if (hash2(i, j) < 0.45) continue;
        const c = { x: i * 300 + hash2(i + 7, j) * 220, alt: baseAlt + hash2(i, j + 3) * 90, w: 60 + hash2(i + 2, j + 9) * 120, h: 10 + hash2(i + 5, j + 1) * 16, front: hash2(i + 9, j + 4) < 0.3 };
        if (c.front) cloudsFront.push(c); else cloud(ctx, X(c.x), Y(c.alt), c.w * ppm, c.h * ppm, 0.9);
      }
    }

    // riscos de ar (sensação de velocidade)
    const vx = st ? st.vx : S.planeSpeed, vy = st && !st.landed ? st.vy : 0;
    const blur = 0.06 * ppm;
    let lx = vx * blur, ly = vy * blur;
    const len = Math.hypot(lx, ly);
    if (len > 70) { lx *= 70 / len; ly *= 70 / len; }
    if (len > 1.5) {
      ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1.2; ctx.beginPath();
      const G = 14;
      for (let j = Math.floor(aB / G); j <= Math.ceil(aT / G); j++) {
        if (j * G < 4) continue;
        for (let i = Math.floor(xL / G); i <= Math.ceil(xR / G); i++) {
          if (hash2(i, j) < 0.55) continue;
          const px = X(i * G + hash2(i + 3, j) * G), py = Y(j * G + hash2(i, j + 5) * G);
          ctx.moveTo(px, py); ctx.lineTo(px + lx, py + ly);
        }
      }
      ctx.stroke();
    }

    // chão
    const gy = Y(0);
    if (gy < H + 60) {
      ctx.fillStyle = '#86b37a';
      ctx.beginPath(); ctx.moveTo(0, gy);
      for (let px = 0; px <= W + 8; px += 8) { const wx = (px - W / 2) / ppm * 0.35 + camX * 0.35; ctx.lineTo(px, gy - ppm * (7 + 5 * Math.sin(wx / 60) + 3 * Math.sin(wx / 23 + 1))); }
      ctx.lineTo(W, gy); ctx.closePath(); ctx.fill();
      const gg = ctx.createLinearGradient(0, gy, 0, Math.max(gy + 1, H));
      gg.addColorStop(0, '#5ba35a'); gg.addColorStop(1, '#2f6e34');
      ctx.fillStyle = gg; ctx.fillRect(0, gy, W, Math.max(0, H - gy));
      for (let i = Math.floor(xL / 30) - 1; i <= Math.ceil(xR / 30) + 1; i++) {
        const wx = i * 30 + hash(i + 17) * 20;
        if (Math.abs(wx) < 45 || Math.abs(wx - 30) < 10) continue;
        const r = hash(i + 101);
        if (r > 0.94) house(ctx, X(wx), gy + 1, ppm);
        else if (r > 0.5) tree(ctx, X(wx), gy + 1, ppm * (8 + hash(i + 55) * 7));
      }
      // alvo de pouso (raios 2, 10 e 25 m)
      for (const [r, col] of [[25, 'rgba(255,255,255,.35)'], [10, C.white], [6, C.orange], [2, C.white]]) {
        ctx.beginPath(); ctx.ellipse(X(0), gy + ppm * 0.8, r * ppm, Math.max(2, r * ppm * 0.14), 0, 0, TAU); ctx.fillStyle = col; ctx.fill();
      }
      // biruta (mostra o vento)
      const bx = X(30), wind = S.wind || 0;
      ctx.strokeStyle = '#444'; ctx.lineWidth = Math.max(1, ppm * 0.3);
      ctx.beginPath(); ctx.moveTo(bx, gy); ctx.lineTo(bx, gy - ppm * 7); ctx.stroke();
      ctx.save(); ctx.translate(bx, gy - ppm * 6.7);
      const droop = (1 - Math.min(1, Math.abs(wind) / 4)) * 1.2;
      ctx.rotate((wind >= 0 ? 0 : Math.PI) + (wind >= 0 ? droop : -droop) + Math.sin(S.time * 3) * 0.06);
      for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#fff' : C.orange; ctx.fillRect(i * ppm * 1.1, -ppm * (0.7 - i * 0.1), ppm * 1.1, ppm * (1.4 - i * 0.2)); }
      ctx.restore();
    }

    // avião
    const planeX = S.planeX;
    if (planeX !== null && planeX > xL - 60 && planeX < xR + 60) {
      plane(ctx, X(planeX), Y(S.p.h0) - 12 * s, s * 1.25);
      if (S.mode === 'plane' || S.mode === 'menu') {
        // paraquedista na porta
        ctx.save(); ctx.translate(X(planeX) - 25 * s * 1.25, Y(S.p.h0) - 12 * s + 1 * s); ctx.scale(s * 0.42, s * 0.42); uprightPose(ctx, 0.8, 0.8); ctx.restore();
        // luz da porta
        ctx.beginPath(); ctx.arc(X(planeX) - 33 * s * 1.25, Y(S.p.h0) - 22 * s, 4 * s, 0, TAU);
        ctx.fillStyle = S.greenLight ? '#35e07a' : '#ff4d4d'; ctx.fill();
        ctx.beginPath(); ctx.arc(X(planeX) - 33 * s * 1.25, Y(S.p.h0) - 22 * s, 9 * s, 0, TAU);
        ctx.fillStyle = S.greenLight ? 'rgba(53,224,122,.3)' : 'rgba(255,77,77,.25)'; ctx.fill();
      }
    }

    // paraquedista
    if (st) {
      const dx = X(st.x);
      const frac = st.tDeploy === null ? null : S.frac;
      const upright = frac && frac.stretch >= 1;
      if (st.landed && st.landed.vy > 12) {
        burst(ctx, dx, gy, 34 * s);
      } else {
        // sombra no chão quando está baixo
        if (st.y < 150 && gy < H) {
          const a = (1 - st.y / 150) * 0.35;
          ctx.beginPath(); ctx.ellipse(dx, gy + 2, 12 * s * (1 + st.y / 80), 2.5 * s, 0, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,' + a + ')'; ctx.fill();
        }
        const py = Math.min(Y(st.y), gy - (upright ? 22 : 8) * s);
        skydiver(ctx, dx, py, s, {
          frac, heading: st.heading, steer: st.steer, flaring: st.flaring, time: S.time,
          collapse: S.collapse, collapseDir: S.wind >= 0 ? 1 : -1, dir: st.vx - st.wind >= 0 ? 1 : -1
        });
      }
    }
    for (const c of cloudsFront) cloud(ctx, X(c.x), Y(c.alt), c.w * ppm, c.h * ppm, 0.55);

    // régua discreta de altitude
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(0, 0, 54, H);
    ctx.strokeStyle = 'rgba(15,25,40,.6)'; ctx.fillStyle = 'rgba(15,25,40,.75)';
    ctx.font = '700 10px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (let a = Math.max(0, Math.floor(aB / 10) * 10); a <= aT; a += 10) {
      const y = Math.round(Y(a)) + 0.5, major = a % 50 === 0;
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(major ? 12 : 6, y); ctx.stroke();
      if (major) ctx.fillText(S.fmt(a, 0), 15, y);
    }

    // vinheta: escurece com a velocidade, pisca vermelho no perigo
    const speed = st && !st.landed ? Math.hypot(st.vx - st.wind, st.vy) : 0;
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    const dark = clamp((speed - 15) / 60, 0, 0.35);
    const danger = S.danger && Math.floor(S.time * 3) % 2 === 0;
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, danger ? 'rgba(200,20,40,.55)' : 'rgba(5,15,35,' + dark + ')');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  root.Scene = { draw, SPAN };
})(window);
