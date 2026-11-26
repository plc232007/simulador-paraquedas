/*
 * chart.js — gráfico de linhas leve em <canvas>, sem dependências.
 * Nítido em telas HiDPI, redimensiona sozinho e funciona em abas escondidas.
 *
 *   const ch = new LineChart(canvas, { xLabel, yLabel, xUnit, yUnit });
 *   ch.setData({ series: [{ x:[...], y:[...], color, label, dash }], hLines:[{y,label,color}], vLines:[...] });
 *   ch.setMarker(x);   // linha vertical + pontos no instante x (ou null)
 */
(function (root) {
  'use strict';

  function niceStep(range, target) {
    if (!(range > 0)) return 1;
    const raw = range / target;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  }
  function fmt(v, step) {
    const d = step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step)));
    return v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  // valor interpolado de uma série (x crescente) em x0
  function valueAt(s, x0) {
    const xs = s.x, ys = s.y, n = xs.length;
    if (!n || x0 < xs[0] || x0 > xs[n - 1]) return null;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x0) lo = m; else hi = m; }
    if (hi === lo) return ys[lo];
    const f = (x0 - xs[lo]) / (xs[hi] - xs[lo] || 1);
    return ys[lo] + f * (ys[hi] - ys[lo]);
  }

  class LineChart {
    constructor(canvas, opts) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.o = Object.assign({ xLabel: '', yLabel: '', xUnit: '', yUnit: '', yMin: null, yMax: null, xMin: null, xMax: null, legend: true }, opts || {});
      this.data = { series: [], hLines: [], vLines: [] };
      this.marker = null;
      this.w = 0; this.h = 0;
      this._raf = 0;
      if (typeof ResizeObserver !== 'undefined') {
        this.ro = new ResizeObserver(() => this.resize());
        this.ro.observe(canvas);
      }
      window.addEventListener('resize', () => this.resize());
      this.resize();
    }
    resize() {
      const r = this.c.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return; // aba escondida
      const dpr = window.devicePixelRatio || 1;
      const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
      if (W !== this.c.width || H !== this.c.height) { this.c.width = W; this.c.height = H; }
      this.w = r.width; this.h = r.height; this.dpr = dpr;
      this.draw();
    }
    setData(d) {
      this.data = { series: d.series || [], hLines: d.hLines || [], vLines: d.vLines || [] };
      if (d.xMax !== undefined) this.o.xMax = d.xMax;
      if (d.yMax !== undefined) this.o.yMax = d.yMax;
      if (d.yMin !== undefined) this.o.yMin = d.yMin;
      this.requestDraw();
    }
    setMarker(x) {
      if (x === this.marker) return;
      this.marker = x;
      this.requestDraw();
    }
    requestDraw() {
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => { this._raf = 0; this.draw(); });
    }
    bounds() {
      let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
      for (const s of this.data.series) {
        const n = s.x.length;
        if (!n) continue;
        xMin = Math.min(xMin, s.x[0]); xMax = Math.max(xMax, s.x[n - 1]);
        for (let i = 0; i < n; i++) { const v = s.y[i]; if (v < yMin) yMin = v; if (v > yMax) yMax = v; }
      }
      for (const l of this.data.hLines) { yMin = Math.min(yMin, l.y); yMax = Math.max(yMax, l.y); }
      if (!isFinite(xMin)) { xMin = 0; xMax = 1; yMin = 0; yMax = 1; }
      if (this.o.xMin !== null) xMin = this.o.xMin;
      if (this.o.xMax !== null) xMax = this.o.xMax;
      if (this.o.yMin !== null) yMin = this.o.yMin;
      if (this.o.yMax !== null) yMax = this.o.yMax;
      if (yMax - yMin < 1e-9) { yMax = yMin + 1; }
      if (xMax - xMin < 1e-9) { xMax = xMin + 1; }
      // folga e arredondamento "bonito" no topo
      const ys = niceStep(yMax - yMin, 5);
      yMax = Math.ceil((yMax + (yMax - yMin) * 0.04) / ys) * ys;
      if (yMin > 0 && this.o.yMin === null) yMin = Math.max(0, Math.floor(yMin / ys) * ys);
      return { xMin, xMax, yMin, yMax };
    }
    draw() {
      const ctx = this.ctx, w = this.w, h = this.h;
      if (!w || !h) return;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const ink = cssVar('--ink', '#0b0b0c');
      const muted = cssVar('--muted', '#5b6472');
      const grid = cssVar('--grid', 'rgba(0,0,0,.08)');
      const font = '12px ' + cssVar('--font-ui', 'system-ui, sans-serif');

      const m = { l: 58, r: 16, t: 14, b: 40 };
      const pw = w - m.l - m.r, ph = h - m.t - m.b;
      if (pw < 20 || ph < 20) return;
      const B = this.bounds();
      const X = (x) => m.l + ((x - B.xMin) / (B.xMax - B.xMin)) * pw;
      const Y = (y) => m.t + (1 - (y - B.yMin) / (B.yMax - B.yMin)) * ph;

      // grade + rótulos
      ctx.font = font; ctx.lineWidth = 1;
      const xs = niceStep(B.xMax - B.xMin, Math.max(3, Math.floor(pw / 90)));
      const ys = niceStep(B.yMax - B.yMin, Math.max(3, Math.floor(ph / 45)));
      ctx.strokeStyle = grid; ctx.fillStyle = muted;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let x = Math.ceil(B.xMin / xs) * xs; x <= B.xMax + 1e-9; x += xs) {
        const px = Math.round(X(x)) + 0.5;
        ctx.beginPath(); ctx.moveTo(px, m.t); ctx.lineTo(px, m.t + ph); ctx.stroke();
        ctx.fillText(fmt(x, xs), px, m.t + ph + 6);
      }
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let y = Math.ceil(B.yMin / ys) * ys; y <= B.yMax + 1e-9; y += ys) {
        const py = Math.round(Y(y)) + 0.5;
        ctx.beginPath(); ctx.moveTo(m.l, py); ctx.lineTo(m.l + pw, py); ctx.stroke();
        ctx.fillText(fmt(y, ys), m.l - 8, py);
      }
      // eixos
      ctx.strokeStyle = muted;
      ctx.beginPath(); ctx.moveTo(m.l + 0.5, m.t); ctx.lineTo(m.l + 0.5, m.t + ph + 0.5); ctx.lineTo(m.l + pw, m.t + ph + 0.5); ctx.stroke();
      ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(this.o.xLabel, m.l + pw / 2, h - 2);
      ctx.save(); ctx.translate(12, m.t + ph / 2); ctx.rotate(-Math.PI / 2);
      ctx.textBaseline = 'middle'; ctx.fillText(this.o.yLabel, 0, 0); ctx.restore();

      ctx.save();
      ctx.beginPath(); ctx.rect(m.l, m.t - 2, pw + 2, ph + 4); ctx.clip();

      // linhas de referência
      for (const l of this.data.hLines) {
        const py = Y(l.y);
        ctx.strokeStyle = l.color || muted; ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(m.l, py); ctx.lineTo(m.l + pw, py); ctx.stroke();
        ctx.setLineDash([]);
        if (l.label) {
          ctx.fillStyle = l.color || muted; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
          ctx.font = '600 ' + font; ctx.fillText(l.label, m.l + pw - 6, py - 3); ctx.font = font;
        }
      }
      for (const l of this.data.vLines) {
        if (l.x < B.xMin || l.x > B.xMax) continue;
        const px = X(l.x);
        ctx.strokeStyle = l.color || muted; ctx.setLineDash([3, 4]); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(px, m.t); ctx.lineTo(px, m.t + ph); ctx.stroke();
        ctx.setLineDash([]);
        if (l.label) {
          // rótulo embaixo, perto do eixo: não briga com a legenda (que fica em cima)
          ctx.font = '600 ' + font;
          const tw = ctx.measureText(l.label).width;
          const right = px + 5 + tw > m.l + pw;
          ctx.fillStyle = cssVar('--legend-bg', 'rgba(255,255,255,.85)');
          ctx.fillRect(right ? px - tw - 8 : px + 2, m.t + ph - 20, tw + 6, 16);
          ctx.fillStyle = l.color || muted; ctx.textAlign = right ? 'right' : 'left'; ctx.textBaseline = 'bottom';
          ctx.fillText(l.label, right ? px - 5 : px + 5, m.t + ph - 5); ctx.font = font;
        }
      }

      // séries (reduz para ~2 pontos por pixel)
      for (const s of this.data.series) {
        const n = s.x.length;
        if (n < 2) continue;
        const stride = Math.max(1, Math.floor(n / (pw * 2)));
        ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2.5;
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.setLineDash(s.dash || []);
        ctx.beginPath();
        ctx.moveTo(X(s.x[0]), Y(s.y[0]));
        for (let i = stride; i < n; i += stride) ctx.lineTo(X(s.x[i]), Y(s.y[i]));
        ctx.lineTo(X(s.x[n - 1]), Y(s.y[n - 1]));
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // marcador do instante atual
      if (this.marker !== null && isFinite(this.marker)) {
        const mx = Math.min(Math.max(this.marker, B.xMin), B.xMax);
        const px = X(mx);
        ctx.strokeStyle = ink; ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px, m.t); ctx.lineTo(px, m.t + ph); ctx.stroke();
        ctx.globalAlpha = 1;
        for (const s of this.data.series) {
          const v = valueAt(s, mx);
          if (v === null) continue;
          ctx.fillStyle = '#fff'; ctx.strokeStyle = s.color; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(px, Y(v), 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      }
      ctx.restore();

      // legenda
      if (this.o.legend && this.data.series.length > 1) {
        ctx.font = font; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        const items = this.data.series.filter((s) => s.label);
        const bw = 34 + Math.max(...items.map((s) => ctx.measureText(s.label).width));
        const bh = items.length * 18 + 6;
        const pos = this.o.legend === true ? 'tr' : this.o.legend;
        const bx = pos.includes('r') ? m.l + pw - bw - 8 : m.l + 8;
        const by = pos.includes('b') ? m.t + ph - bh - 8 : m.t + 6;
        ctx.fillStyle = cssVar('--legend-bg', 'rgba(255,255,255,.85)');
        ctx.fillRect(bx, by, bw, bh);
        let ly = by + 12;
        for (const s of items) {
          ctx.strokeStyle = s.color; ctx.lineWidth = 3; ctx.setLineDash(s.dash || []);
          ctx.beginPath(); ctx.moveTo(bx + 8, ly); ctx.lineTo(bx + 26, ly); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = ink; ctx.fillText(s.label, bx + 32, ly);
          ly += 18;
        }
      }
    }
  }

  root.LineChart = LineChart;
})(window);
