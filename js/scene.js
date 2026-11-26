/*
 * scene.js — desenho da cena do salto em <canvas>.
 *   Scene.draw(ctx, W, H, S)   S = estado do quadro (montado em app.js)
 * Dois modos de câmera:
 *   'follow'   → câmera acompanha o paraquedista (nuvens, vento, avião, chão chegando)
 *   'overview' → visão geral dos 4.000 m com os dois paraquedistas lado a lado
 */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const C = {
    suit: '#e3e7ec', suitDark: '#b4bdc8', line: '#1b2330', orange: '#e8701a', helmet: '#aeb9c6',
    visor: '#22344b', glove: '#6e4f33', boot: '#8a5a33', pack: '#363f4c', navy: '#1d3557', white: '#f5f6f8',
    red: '#c8283a'
  };
  const FONT = '"Inter", "Segoe UI", "Helvetica Neue", Roboto, Arial, sans-serif';
  const MONO = '"DejaVu Sans Mono", Consolas, "Courier New", monospace';

  // ---------- utilidades ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function pill(ctx, x, y, text, bg, fg, align, size) {
    size = size || 12;
    ctx.font = '700 ' + size + 'px ' + FONT;
    const w = ctx.measureText(text).width + 16, h = size + 10;
    const x0 = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
    ctx.fillStyle = bg; rr(ctx, x0, y - h / 2, w, h, h / 2); ctx.fill();
    ctx.fillStyle = fg || '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x0 + 8, y + 0.5);
    return w;
  }
  function limb(ctx, pts, w, color) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.strokeStyle = C.line; ctx.lineWidth = w + 2.2; ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
  }
  function dot(ctx, x, y, r, color) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = color; ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = C.line; ctx.stroke();
  }

  // ---------- paraquedista ----------
  // Queda livre, "barriga para baixo", cabeça à esquerda. Origem = centro do tronco.
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
  // Em pé, pendurado no velame, de frente. Origem = quadril; botas em y ≈ +22.
  function uprightPose(ctx) {
    limb(ctx, [[-3, 0], [-4.5, 11], [-3.5, 20]], 6, C.suit);
    limb(ctx, [[3, 0], [4.5, 11], [3.5, 20]], 6, C.suit);
    ctx.beginPath(); ctx.ellipse(-4, 22, 4, 2.6, 0, 0, TAU); ctx.fillStyle = C.boot; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(4, 22, 4, 2.6, 0, 0, TAU); ctx.fill(); ctx.stroke();
    limb(ctx, [[-6, -19], [-11, -27], [-9, -36]], 5, C.suit); dot(ctx, -9, -37, 2.8, C.glove);
    limb(ctx, [[6, -19], [11, -27], [9, -36]], 5, C.suit); dot(ctx, 9, -37, 2.8, C.glove);
    rr(ctx, -7.5, -23, 15, 24, 6); ctx.fillStyle = C.suit; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = C.orange; ctx.fillRect(-7.5, -10, 15, 3.5); ctx.restore();
    rr(ctx, -7.5, -23, 15, 24, 6); ctx.strokeStyle = C.line; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, -15); ctx.lineTo(6, -15); ctx.moveTo(-5, -1); ctx.lineTo(-2, 4); ctx.moveTo(5, -1); ctx.lineTo(2, 4); ctx.lineWidth = 1.8; ctx.stroke();
    dot(ctx, 0, -29, 6.4, C.helmet);
    ctx.beginPath(); ctx.ellipse(0, -28, 4.4, 3.1, 0, 0, TAU); ctx.fillStyle = C.visor; ctx.fill();
  }
  // Velame ram-air visto de frente; devolve pontos da borda de baixo (para as linhas)
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

  /*
   * Paraquedista completo. (x, y) = centro do tronco em queda livre / quadril sob o velame.
   * f = frações da abertura {pilot, stretch, fill}; collapse = 0..1 depois do pouso.
   */
  function skydiver(ctx, x, y, s, f, time, collapse) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    if (!f || (f.pilot === 0 && f.stretch === 0 && f.fill === 0)) {
      ctx.rotate(Math.sin(time * 2.1) * 0.05);
      freefallPose(ctx);
    } else if (f.stretch < 1) {
      // extrator puxa o saco; o corpo gira de deitado para em pé
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
      ctx.save(); ctx.rotate(f.stretch * Math.PI / 2); freefallPose(ctx); ctx.restore();
    } else {
      const c = collapse || 0;
      const sway = Math.sin(time * 1.3) * 0.05 * f.fill * (1 - c);
      ctx.rotate(sway);
      // depois do pouso (c: 0 → 1) o velame perde ar e deita no chão ao lado
      const L = 58, e = c * c * (3 - 2 * c);
      const w = 74 * (0.3 + 0.7 * f.fill) * (1 + 0.15 * e);
      const th = 10 * (0.55 + 0.45 * f.fill) * (1 - 0.65 * e);
      const droop = 14 * (0.5 + 0.5 * f.fill) * (1 - 0.9 * e);
      const cx = 62 * e;
      const bottom = (-22 - L) * (1 - e) + 21 * e;
      const pts = canopy(ctx, cx, bottom - th, w, th, droop, Math.max(0.2, f.fill * (1 - 0.5 * e)), time);
      ctx.strokeStyle = 'rgba(27,35,48,.55)'; ctx.lineWidth = 0.8;
      ctx.beginPath();
      pts.forEach((p, i) => { ctx.moveTo(p[0], p[1]); ctx.lineTo(i < 3 ? -6 : 6, -21); });
      ctx.stroke();
      if (c < 0.5) pilotChute(ctx, cx, bottom - th - 3, 3);
      uprightPose(ctx);
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
    for (let wx = -18; wx <= 26; wx += 9) { ctx.beginPath(); ctx.arc(wx, -3, 2, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#1b2330'; ctx.fillRect(-30, -6, 8, 13); // porta aberta
    ctx.beginPath(); ctx.ellipse(2, 6, 28, 4, 0, 0, TAU); ctx.fillStyle = '#c3cad4'; ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(27,35,48,.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(50, -10); ctx.lineTo(50, 10); ctx.stroke();
    ctx.restore();
  }

  function burst(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU, rr2 = i % 2 ? r * 0.5 : r;
      ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2 * 0.7);
    }
    ctx.closePath(); ctx.fillStyle = '#ffb020'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.42, r * 0.3, 0, 0, TAU); ctx.fillStyle = '#e2401c'; ctx.fill();
  }

  function cloud(ctx, x, y, w, h, alpha) {
    ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
    ctx.beginPath();
    const bumps = [[-0.32, 0.1, 0.3], [-0.1, -0.15, 0.36], [0.16, -0.05, 0.32], [0.34, 0.12, 0.24], [0, 0.18, 0.42]];
    for (const [bx, by, br] of bumps) {
      const cx = x + bx * w, cy = y + by * h * 2, rx = br * w, ry = br * h * 2.2;
      ctx.moveTo(cx + rx, cy);
      ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    }
    ctx.fill();
  }

  function tree(ctx, x, gy, h) {
    ctx.fillStyle = '#5b3d24'; ctx.fillRect(x - h * 0.06, gy - h * 0.45, h * 0.12, h * 0.45);
    ctx.fillStyle = '#2f6b35';
    ctx.beginPath(); ctx.arc(x, gy - h * 0.62, h * 0.3, 0, TAU); ctx.arc(x - h * 0.18, gy - h * 0.48, h * 0.22, 0, TAU); ctx.arc(x + h * 0.18, gy - h * 0.48, h * 0.22, 0, TAU); ctx.fill();
  }

  function ground(ctx, W, H, gy, unit, targetX, time) {
    // morros ao fundo
    ctx.fillStyle = '#7fae74';
    ctx.beginPath(); ctx.moveTo(0, gy);
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, gy - unit * (6 + 4 * Math.sin(x / 90) + 3 * Math.sin(x / 37 + 1)));
    ctx.lineTo(W, gy); ctx.closePath(); ctx.fill();
    // gramado
    const g = ctx.createLinearGradient(0, gy, 0, Math.max(gy + 1, H));
    g.addColorStop(0, '#5ba35a'); g.addColorStop(1, '#2f6e34');
    ctx.fillStyle = g; ctx.fillRect(0, gy, W, Math.max(0, H - gy));
    // árvores
    for (let i = 0; i < 14; i++) {
      const tx = hash(i + 3) * W;
      if (Math.abs(tx - targetX) < unit * 18) continue;
      tree(ctx, tx, gy + 1, unit * (7 + hash(i + 40) * 6));
    }
    // alvo de pouso
    for (const [r, col] of [[1, '#f4f5f7'], [0.66, C.orange], [0.33, '#f4f5f7']]) {
      ctx.beginPath(); ctx.ellipse(targetX, gy + unit * 1.2, unit * 10 * r, unit * 1.6 * r, 0, 0, TAU); ctx.fillStyle = col; ctx.fill();
    }
    // biruta
    const bx = targetX + unit * 26;
    ctx.strokeStyle = '#444'; ctx.lineWidth = Math.max(1, unit * 0.4);
    ctx.beginPath(); ctx.moveTo(bx, gy); ctx.lineTo(bx, gy - unit * 9); ctx.stroke();
    ctx.save(); ctx.translate(bx, gy - unit * 8.6); ctx.rotate(0.15 + Math.sin(time * 2) * 0.08);
    for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#fff' : C.orange; ctx.fillRect(i * unit * 1.4, -unit * (0.9 - i * 0.12), unit * 1.4, unit * (1.8 - i * 0.24)); }
    ctx.restore();
  }

  function skyGradient(ctx, W, H, altFrac) {
    const k = clamp(altFrac, 0, 1);
    const mix = (a, b) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
    const top = mix([120, 182, 236], [31, 92, 180]), bot = mix([214, 236, 250], [134, 189, 236]);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgb(' + top + ')'); g.addColorStop(1, 'rgb(' + bot + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  function hud(ctx, x, y, S) {
    const alt = S.landed ? 0 : S.sr.y, v = S.landed ? 0 : S.sr.v;
    const w = 196, h = 84;
    ctx.fillStyle = 'rgba(20,24,31,.86)'; rr(ctx, x, y, w, h, 14); ctx.fill();
    const danger = S.mode === 'manual' && !S.deployed && !S.landed && alt < 900 && S.t > 0;
    const blink = danger && Math.floor(S.time * 3) % 2 === 0;
    ctx.fillStyle = blink ? '#ff6b6b' : '#bfe3cf';
    rr(ctx, x + 8, y + 8, w - 16, 44, 9); ctx.fill();
    ctx.fillStyle = '#13261c'; ctx.textBaseline = 'middle';
    ctx.font = '800 10px ' + FONT; ctx.textAlign = 'left'; ctx.fillText('ALT', x + 16, y + 30);
    ctx.font = '800 28px ' + MONO; ctx.textAlign = 'right'; ctx.fillText(S.fmt(alt, 0), x + w - 30, y + 31);
    ctx.font = '800 12px ' + MONO; ctx.fillText('m', x + w - 16, y + 35);
    ctx.fillStyle = '#e6ebf2'; ctx.font = '700 13px ' + FONT; ctx.textAlign = 'left';
    ctx.fillText('▼ ' + S.fmt(v, 1) + ' m/s · ' + S.fmt(v * 3.6, 0) + ' km/h', x + 12, y + h - 16);
  }

  function minimap(ctx, W, H, S) {
    const x = W - 34, y0 = 70, y1 = H - 60;
    const yOf = (a) => y0 + (1 - clamp(a, 0, S.p.h0) / S.p.h0) * (y1 - y0);
    ctx.fillStyle = 'rgba(255,255,255,.7)'; rr(ctx, x - 16, y0 - 34, 42, y1 - y0 + 58, 10); ctx.fill();
    ctx.fillStyle = '#1b2330'; ctx.font = '800 9px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('MAPA', x + 5, y0 - 22);
    ctx.strokeStyle = '#1b2330'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
    ctx.fillStyle = '#2f6e34'; ctx.fillRect(x - 10, y1, 20, 4);
    ctx.font = '700 9px ' + FONT; ctx.fillStyle = '#1b2330';
    ctx.fillText(S.fmt(S.p.h0 / 1000, 0) + ' km', x + 5, y0 - 9); ctx.fillText('0', x + 5, y1 + 14);
    if (S.deployLineAlt !== null) {
      ctx.strokeStyle = C.orange; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 8, yOf(S.deployLineAlt)); ctx.lineTo(x + 8, yOf(S.deployLineAlt)); ctx.stroke();
    }
    for (const [alt, col, dx] of [[S.sv.y, C.red, -6], [S.sr.y, C.navy, 6]]) {
      ctx.beginPath(); ctx.arc(x + dx, yOf(alt), 5, 0, TAU); ctx.fillStyle = col; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }

  // ---------- câmera que segue ----------
  function drawFollow(ctx, W, H, S) {
    const span = 170;                      // metros visíveis na vertical
    const ppm = H / span;                  // pixels por metro
    const p = S.p, t = S.t, yD = S.landed ? 0 : S.sr.y;
    const camC = Math.max(yD, span * 0.32);
    const yOf = (alt) => H / 2 - (alt - camC) * ppm;
    const camTop = camC + span / 2, camBot = camC - span / 2;
    const cx = Math.max(110, W * 0.46);
    const s = clamp(H / 420, 1.1, 2.1);

    skyGradient(ctx, W, H, camC / 4000);

    // nuvens em camadas (fixas no mundo: passam pela câmera)
    const clouds = [];
    for (let k = 0; k < 40; k++) {
      const alt = 350 + k * 115 + hash(k) * 60;
      if (alt > p.h0 + 150) break;
      clouds.push({ alt, x: hash(k + 11) * W, w: 60 + hash(k + 21) * 110, h: 10 + hash(k + 31) * 14, front: k % 3 === 0 });
    }
    const drawClouds = (front) => {
      for (const c of clouds) {
        if (c.front !== front) continue;
        if (c.alt < camBot - 40 || c.alt > camTop + 40) continue;
        cloud(ctx, c.x, yOf(c.alt), c.w * ppm, c.h * ppm, front ? 0.55 : 0.9);
      }
    };
    drawClouds(false);

    // partículas de ar: riscos proporcionais à velocidade (sensação de queda)
    const v = S.landed ? 0 : S.sr.v;
    const streak = clamp(v * ppm * 0.07, 1.5, 70);
    ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let j = Math.floor(camBot / 6); j <= Math.ceil(camTop / 6); j++) {
      if (j * 6 < 3) continue;
      for (let q = 0; q < 2; q++) {
        const a = j * 6 + hash(j * 7 + q) * 6;
        const px = hash(j * 13 + q * 5) * W, py = yOf(a);
        ctx.moveTo(px, py); ctx.lineTo(px, py + streak);
      }
    }
    ctx.stroke();

    // chão
    const gy = yOf(0);
    if (gy < H + 40) ground(ctx, W, H, gy, ppm, cx, S.time);

    // avião (vai embora nos primeiros segundos)
    const planeX = cx - 34 * s + t * 55 * ppm;
    if (planeX < W + 200) plane(ctx, planeX, yOf(p.h0) - 22 * s, s * 1.2);

    // paraquedista
    if (S.landed && S.vLand > 12) {
      burst(ctx, cx, gy, 34 * s);
      pill(ctx, cx, gy - 52 * s, 'IMPACTO · ' + S.fmt(S.vLand, 1) + ' m/s', C.red);
    } else {
      const upright = S.frac && S.frac.stretch >= 1;
      const yPix = upright ? Math.min(yOf(yD), gy - 22 * s) : Math.min(yOf(yD), gy - 8 * s);
      skydiver(ctx, cx, yPix, s, S.frac, S.time, S.collapse);
      if (S.landed) pill(ctx, cx + 42 * s, yPix - 10, (S.vLand <= 7 ? '✓ POUSO · ' : 'POUSO DURO · ') + S.fmt(S.vLand, 1) + ' m/s', S.vLand <= 7 ? '#1f8a4c' : C.orange, '#fff', 'left');
    }
    drawClouds(true);

    // régua local de altitude
    const rulerW = 64;
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(0, 0, rulerW, H);
    ctx.strokeStyle = '#1b2330'; ctx.fillStyle = '#1b2330';
    ctx.font = '700 11px ' + FONT; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let a = Math.max(0, Math.floor(camBot / 10) * 10); a <= camTop; a += 10) {
      const y = Math.round(yOf(a)) + 0.5, major = a % 50 === 0;
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(rulerW - (major ? 12 : 6), y); ctx.lineTo(rulerW, y); ctx.stroke();
      if (major) ctx.fillText(S.fmt(a, 0) + ' m', rulerW - 15, y);
    }
    // altitude de abertura planejada
    if (S.deployLineAlt !== null && S.deployLineAlt > camBot && S.deployLineAlt < camTop) {
      const y = yOf(S.deployLineAlt);
      ctx.setLineDash([8, 6]); ctx.strokeStyle = C.orange; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(rulerW, y); ctx.lineTo(W - 60, y); ctx.stroke(); ctx.setLineDash([]);
      pill(ctx, W - 64, y - 14, S.deployLineLabel, C.orange, '#fff', 'right');
    }

    hud(ctx, rulerW + 12, 12, S);
    minimap(ctx, W, H, S);
    if (S.message) pill(ctx, (rulerW + W - 50) / 2, H - 22, S.message.text, S.message.bg, '#fff', 'center', 13);
  }

  // ---------- visão geral ----------
  function drawOverview(ctx, W, H, S) {
    const p = S.p, t = S.t;
    const top = 64, groundH = 40, rulerW = 74;
    const plotH = H - top - groundH, groundY = H - groundH;
    const yOf = (alt) => top + (1 - Math.max(0, alt) / p.h0) * plotH;
    const s = clamp(H / 1000, 0.5, 0.8);

    skyGradient(ctx, W, H, 0.8);
    for (let k = 0; k < 11; k++) cloud(ctx, rulerW + (0.1 + hash(k + 5) * 0.85) * (W - rulerW), top + (0.08 + hash(k + 50) * 0.8) * plotH, 70 * clamp(W / 700, 0.8, 1.5), 12, 0.8);

    ctx.fillStyle = 'rgba(255,255,255,0.62)'; ctx.fillRect(0, 0, rulerW, groundY);
    ctx.strokeStyle = '#0b0b0c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(rulerW - 1, top); ctx.lineTo(rulerW - 1, groundY); ctx.stroke();
    const step = S.niceStep(p.h0, 8);
    ctx.font = '700 11px ' + FONT; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#1f2a37';
    for (let a = 0; a <= p.h0 + 1e-9; a += step / 2) {
      const y = Math.round(yOf(a)) + 0.5;
      const major = Math.abs(a / step - Math.round(a / step)) < 1e-6;
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(rulerW - (major ? 12 : 7), y); ctx.lineTo(rulerW, y); ctx.stroke();
      if (major && a > 0) ctx.fillText(S.fmt(a, 0) + ' m', rulerW - 16, y);
    }

    const xa = rulerW + (W - rulerW) * 0.3, xb = rulerW + (W - rulerW) * 0.7;
    pill(ctx, xa, 20, 'SEM RESISTÊNCIA DO AR', C.red);
    pill(ctx, xb, 20, 'COM RESISTÊNCIA DO AR', C.navy);

    ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(rulerW, yOf(p.h0)); ctx.lineTo(W, yOf(p.h0)); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '600 11px ' + FONT; ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText('saída do avião · ' + S.fmt(p.h0, 0) + ' m', W - 8, yOf(p.h0) - 3);
    const planeX = (xa + xb) / 2 + t * 40;
    if (planeX < W + 100) plane(ctx, planeX, yOf(p.h0) - 16, s * 0.8);

    if (S.deployLineAlt !== null) {
      const y = yOf(S.deployLineAlt);
      ctx.setLineDash([8, 6]); ctx.strokeStyle = C.orange; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(xb - (W - rulerW) * 0.18, y); ctx.lineTo(W, y); ctx.stroke(); ctx.setLineDash([]);
      pill(ctx, W - 8, y - 14, S.deployLineLabel, C.orange, '#fff', 'right');
    }

    ground(ctx, W, H, groundY, 1.6, xb, S.time);
    ctx.font = '800 12px ' + FONT; ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('SOLO · 0 m', 10, groundY + groundH / 2);

    // rastros
    ctx.lineWidth = 3; ctx.globalAlpha = 0.35;
    ctx.strokeStyle = C.red; ctx.beginPath(); ctx.moveTo(xa, yOf(p.h0)); ctx.lineTo(xa, yOf(S.sv.y)); ctx.stroke();
    ctx.strokeStyle = C.navy; ctx.beginPath(); ctx.moveTo(xb, yOf(p.h0)); ctx.lineTo(xb, yOf(S.sr.y)); ctx.stroke();
    ctx.globalAlpha = 1;

    // A: sem resistência
    if (S.vacLanded) {
      burst(ctx, xa, groundY, 30 * s / 0.7);
      pill(ctx, xa, groundY - 46, 'IMPACTO · ' + S.fmt(S.vac.landing.v, 0) + ' m/s', C.red);
    } else {
      const y = Math.min(yOf(S.sv.y), groundY - 8 * s);
      skydiver(ctx, xa, y, s, null, S.time, 0);
      pill(ctx, xa + 30 * s, y, S.fmt(S.sv.v, 1) + ' m/s', 'rgba(11,11,12,.82)', '#fff', 'left');
    }
    // B: com resistência
    if (S.landed && S.vLand > 12) {
      burst(ctx, xb, groundY, 26 * s / 0.7);
      pill(ctx, xb, groundY - 46, 'IMPACTO · ' + S.fmt(S.vLand, 1) + ' m/s', C.red);
    } else {
      const upright = S.frac && S.frac.stretch >= 1;
      const y = Math.min(yOf(S.sr.y), groundY - (upright ? 22 : 8) * s);
      skydiver(ctx, xb, y, s, S.frac, S.time, S.collapse);
      if (S.landed) pill(ctx, xb + 30 * s, y - 6, (S.vLand <= 7 ? '✓ POUSO · ' : 'POUSO DURO · ') + S.fmt(S.vLand, 1) + ' m/s', S.vLand <= 7 ? '#1f8a4c' : C.orange, '#fff', 'left');
      else pill(ctx, xb + 30 * s, y, S.fmt(S.sr.v, 1) + ' m/s', 'rgba(11,11,12,.82)', '#fff', 'left');
    }
    if (S.message) pill(ctx, (rulerW + W) / 2, 48, S.message.text, S.message.bg, '#fff', 'center', 13);
  }

  root.Scene = {
    draw(ctx, W, H, S) { (S.camera === 'overview' ? drawOverview : drawFollow)(ctx, W, H, S); }
  };
})(window);
