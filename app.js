/* =========================================================
   CLOVE — interactive solar system observatory
   Vanilla JS + Three.js. All visuals generated in-browser.
   ========================================================= */

(function () {
  "use strict";

  if (!window.THREE) {
    document.getElementById("bootPct").textContent = "ERR";
    document.querySelector("#bootStatusLabel").textContent = "无法载入 3D 引擎";
    return;
  }

  const T = window.THREE;
  const PI = Math.PI;
  const TAU = PI * 2;
  const DEG = PI / 180;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
  const isMobile = () => window.innerWidth <= 900;
  const waitFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

  function nearestAngle(target, current) {
    return target + Math.round((current - target) / TAU) * TAU;
  }

  const { PLANETS, SYSTEM } = window.CLOVE_DATA;

  /* ---------------------------------------------------------
     deterministic noise + texture painting
     --------------------------------------------------------- */

  function hash3(x, y, z, seed) {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1440662683) + Math.imul(seed, 1013904223);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  }

  function smooth(t) {
    return t * t * (3 - 2 * t);
  }

  function noise3(x, y, z, seed) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = smooth(x - xi), yf = smooth(y - yi), zf = smooth(z - zi);
    const c000 = hash3(xi, yi, zi, seed);
    const c100 = hash3(xi + 1, yi, zi, seed);
    const c010 = hash3(xi, yi + 1, zi, seed);
    const c110 = hash3(xi + 1, yi + 1, zi, seed);
    const c001 = hash3(xi, yi, zi + 1, seed);
    const c101 = hash3(xi + 1, yi, zi + 1, seed);
    const c011 = hash3(xi, yi + 1, zi + 1, seed);
    const c111 = hash3(xi + 1, yi + 1, zi + 1, seed);
    const x00 = lerp(c000, c100, xf);
    const x10 = lerp(c010, c110, xf);
    const x01 = lerp(c001, c101, xf);
    const x11 = lerp(c011, c111, xf);
    return lerp(lerp(x00, x10, yf), lerp(x01, x11, yf), zf);
  }

  function fbm3(x, y, z, octaves, seed) {
    let v = 0;
    let amp = 0.5;
    let freq = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      v += noise3(x * freq, y * freq, z * freq, seed + i * 17) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return v / norm;
  }

  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function hexRgb(hex) {
    const n = parseInt(hex.replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  function shade(c, f) {
    return [clamp(c[0] * f, 0, 255), clamp(c[1] * f, 0, 255), clamp(c[2] * f, 0, 255)];
  }

  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }

  function surfacePoint(u, v) {
    const lon = u * TAU;
    const lat = (v - 0.5) * PI;
    const cl = Math.cos(lat);
    return [cl * Math.cos(lon), Math.sin(lat), cl * Math.sin(lon)];
  }

  const PALETTES = {
    mercury: ["#28282d", "#68655f", "#a8a198", "#d2c9bc"],
    venus: ["#6f451d", "#b47b3a", "#e5bb77", "#fae5b7"],
    earth: ["#061a3a", "#0b4f8b", "#1d706b", "#4c7b3d"],
    mars: ["#411a12", "#823823", "#b95f39", "#dfa47e"],
    jupiter: ["#6b4632", "#a87b58", "#d4b18b", "#f2dfc3"],
    saturn: ["#817052", "#b7a37b", "#dfcca3", "#f4e8ce"],
    uranus: ["#3b7f91", "#68b3bd", "#a8dde0", "#d8f0ee"],
    neptune: ["#0a2568", "#164596", "#2f6cc0", "#73a8e6"]
  };

  function generateSurface(def, renderer) {
    const seed = hashString(def.id) % 100000;
    const W = 768;
    const H = 384;
    const canvas = makeCanvas(W, H);
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(W, H);
    const data = img.data;
    const pal = PALETTES[def.id].map(hexRgb);
    const type = def.texture;

    for (let y = 0; y < H; y++) {
      const v = (y + 0.5) / H;
      const lat = (v - 0.5) * PI;
      const cl = Math.cos(lat);
      const sy = Math.sin(lat);
      for (let x = 0; x < W; x++) {
        const u = (x + 0.5) / W;
        const lon = u * TAU;
        let px = cl * Math.cos(lon);
        let py = sy;
        let pz = cl * Math.sin(lon);
        let r = 0, g = 0, b = 0;

        if (type === "mercury") {
          const n = fbm3(px * 2.6, py * 2.6, pz * 2.6, 4, seed);
          const n2 = fbm3(px * 11, py * 11, pz * 11, 3, seed + 6);
          let t = clamp((n - 0.34) * 1.65 + (n2 - 0.5) * 0.2, 0, 1);
          let c = mix(pal[0], pal[2], t);
          if (n2 > 0.66) c = mix(c, pal[3], 0.3);
          if (n < 0.34) c = mix(c, pal[0], 0.35);
          r = c[0]; g = c[1]; b = c[2];
        } else if (type === "venus") {
          const warp = fbm3(px * 1.6 + 2.3, py * 4.4, pz * 1.6, 3, seed);
          const nx = Math.cos(lon + Math.sin(lat * 3.0 + warp * 2.5) * 0.7) * cl;
          const nz = Math.sin(lon + Math.sin(lat * 3.0 + warp * 2.5) * 0.7) * cl;
          const n = fbm3(nx * 2.2, py * 6.0, nz * 2.2, 4, seed + 8);
          const band = 0.5 + 0.5 * Math.sin(lat * 10.0 + n * 5.2 + warp * 3.4);
          let c = mix(pal[0], pal[3], clamp(n * 0.85 + band * 0.28 - 0.04, 0, 1));
          c = mix(c, pal[2], clamp((n - 0.52) * 1.7, 0, 0.55));
          r = c[0]; g = c[1]; b = c[2];
        } else if (type === "earth") {
          const n = fbm3(px * 1.65 + 1.7, py * 1.65, pz * 1.65, 5, seed);
          const det = fbm3(px * 5.5, py * 5.5, pz * 5.5, 3, seed + 4);
          const land = n + (det - 0.5) * 0.14;
          const ice = Math.abs(lat) > 1.24 + (det - 0.5) * 0.2;
          if (ice) {
            let c = mix(hexRgb("#cfe4ee"), hexRgb("#f6fbfd"), det);
            if (land < 0.45) c = mix(hexRgb("#a9c6d7"), c, 0.55);
            r = c[0]; g = c[1]; b = c[2];
          } else if (land > 0.53) {
            const elev = clamp((land - 0.53) / 0.2, 0, 1);
            let c = mix(hexRgb("#2d5a34"), hexRgb("#7d7243"), det);
            if (lat > 0.35) c = mix(c, hexRgb("#8a7651"), 0.28);
            if (elev > 0.55) c = mix(c, hexRgb("#a89b7e"), (elev - 0.55) * 0.8);
            if (land < 0.57) c = mix(hexRgb("#9e9668"), c, 0.35);
            r = c[0]; g = c[1]; b = c[2];
          } else {
            const depth = clamp((0.53 - land) / 0.3, 0, 1);
            let c = mix(hexRgb("#247a92"), hexRgb("#05183d"), depth);
            c = mix(c, hexRgb("#196ca4"), clamp((det - 0.5) * 0.6 + 0.1, 0, 0.4));
            r = c[0]; g = c[1]; b = c[2];
          }
        } else if (type === "mars") {
          const n = fbm3(px * 2.2, py * 2.2, pz * 2.2, 4, seed);
          const d = fbm3(px * 7.0 + 3.0, py * 7.0, pz * 7.0, 3, seed + 9);
          let c = mix(pal[0], pal[2], clamp((n - 0.28) * 1.9, 0, 1));
          c = mix(c, pal[3], clamp((d - 0.55) * 1.5, 0, 0.6));
          if (n < 0.37) c = mix(c, hexRgb("#3a1a14"), 0.5);
          if (Math.abs(lat) > 1.32 + (d - 0.5) * 0.13) c = mix(c, hexRgb("#f1e3d3"), 0.82);
          r = c[0]; g = c[1]; b = c[2];
        } else if (type === "jupiter" || type === "saturn") {
          const isJup = type === "jupiter";
          const turb = fbm3(px * 2.7, py * 7.2, pz * 2.7, 4, seed);
          const turb2 = fbm3(px * 6.4, py * 12.5, pz * 6.4, 3, seed + 13);
          const bandFreq = isJup ? 23 : 18;
          const band = 0.5 + 0.5 * Math.sin(lat * bandFreq + turb * (isJup ? 7.5 : 3.6));
          const band2 = 0.5 + 0.5 * Math.sin(lat * bandFreq * 2.8 + turb * 5.0 + 1.4);
          let t = band * 0.66 + band2 * 0.26;
          let c = mix(pal[0], pal[3], clamp(t + 0.06, 0, 1));
          c = mix(c, isJup ? hexRgb("#8f4d37") : hexRgb("#a58e66"), clamp((turb2 - 0.55) * 1.7, 0, 0.6));
          const pole = clamp((Math.abs(lat) - 1.05) / 0.5, 0, 1);
          c = mix(c, isJup ? hexRgb("#6b4a3b") : hexRgb("#7f725b"), pole * 0.5);
          if (!isJup && Math.abs(lat) > 1.27) c = mix(c, hexRgb("#a8c1bd"), 0.18);
          r = c[0]; g = c[1]; b = c[2];
        } else if (type === "uranus") {
          const n = fbm3(px * 2.2, py * 3.2, pz * 2.2, 3, seed);
          const band = 0.5 + 0.5 * Math.sin(lat * 8.5 + n * 2.6);
          let c = mix(pal[1], pal[3], clamp(0.32 + band * 0.25 + n * 0.22, 0, 1));
          c = mix(c, pal[2], clamp((n - 0.53) * 0.9, 0, 0.35));
          r = c[0]; g = c[1]; b = c[2];
        } else if (type === "neptune") {
          const n = fbm3(px * 2.4, py * 4.2, pz * 2.4, 4, seed);
          const band = 0.5 + 0.5 * Math.sin(lat * 11 + n * 4.0);
          let c = mix(pal[0], pal[2], clamp(0.4 + band * 0.24 + n * 0.2, 0, 1));
          c = mix(c, pal[3], clamp((n - 0.56) * 1.2, 0, 0.3));
          r = c[0]; g = c[1]; b = c[2];
        }

        const idx = (y * W + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(img, 0, 0);
    const rand = mulberry32(seed);
    decorateSurface(ctx, W, H, type, pal, rand);

    const tex = new T.CanvasTexture(canvas);
    tex.colorSpace = T.SRGBColorSpace;
    tex.wrapS = T.RepeatWrapping;
    tex.wrapT = T.ClampToEdgeWrapping;
    tex.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
    tex.needsUpdate = true;
    return { texture: tex, canvas, preview: canvas.toDataURL("image/jpeg", 0.84) };
  }

  function decorateSurface(ctx, W, H, type, pal, rand) {
    if (type === "mercury") {
      for (let i = 0; i < 115; i++) {
        const x = W * (0.06 + rand() * 0.88);
        const y = H * (0.08 + rand() * 0.84);
        const r = 2 + Math.pow(rand(), 2.3) * 24;
        const grd = ctx.createRadialGradient(x - r * 0.25, y - r * 0.2, r * 0.1, x, y, r);
        grd.addColorStop(0, "rgba(34,33,37,0.5)");
        grd.addColorStop(0.72, "rgba(72,69,67,0.28)");
        grd.addColorStop(0.94, "rgba(210,201,187,0.22)");
        grd.addColorStop(1, "rgba(220,211,195,0)");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * (0.55 + rand() * 0.45), rand() * PI, 0, TAU);
        ctx.fill();
        if (r > 11) {
          ctx.strokeStyle = "rgba(214,204,190,0.13)";
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }

    if (type === "venus") {
      ctx.save();
      for (let i = 0; i < 26; i++) {
        const y = H * (0.12 + rand() * 0.76);
        const x = W * rand();
        const len = W * (0.08 + rand() * 0.24);
        const grad = ctx.createLinearGradient(x, y, x + len, y + (rand() - 0.5) * 24);
        grad.addColorStop(0, "rgba(255,238,194,0)");
        grad.addColorStop(0.5, `rgba(255,238,194,${0.035 + rand() * 0.07})`);
        grad.addColorStop(1, "rgba(255,238,194,0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1 + rand() * 5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x + len * 0.3, y - 10, x + len * 0.7, y + 13, x + len, y + (rand() - 0.5) * 10);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (type === "mars") {
      ctx.save();
      ctx.strokeStyle = "rgba(48,17,12,0.34)";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(W * 0.21, H * 0.59);
      ctx.bezierCurveTo(W * 0.35, H * 0.55, W * 0.53, H * 0.63, W * 0.68, H * 0.57);
      ctx.stroke();
      ctx.strokeStyle = "rgba(232,177,137,0.16)";
      ctx.lineWidth = 2;
      ctx.stroke();
      for (let i = 0; i < 23; i++) {
        const x = W * rand();
        const y = H * (0.15 + rand() * 0.7);
        const r = 2 + rand() * 9;
        ctx.fillStyle = "rgba(54,20,13,0.15)";
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    if (type === "jupiter") {
      const x = W * 0.717;
      const y = H * 0.617;
      const rx = W * 0.105;
      const ry = H * 0.072;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.045);
      const grd = ctx.createRadialGradient(-rx * 0.15, -ry * 0.12, 2, 0, 0, rx);
      grd.addColorStop(0, "rgba(171,73,48,0.92)");
      grd.addColorStop(0.46, "rgba(153,60,41,0.88)");
      grd.addColorStop(0.77, "rgba(188,110,78,0.72)");
      grd.addColorStop(0.97, "rgba(242,220,188,0.25)");
      grd.addColorStop(1, "rgba(242,220,188,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(246,229,202,0.24)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 0.74, ry * 0.68, 0, 0, TAU);
      ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const ox = (rand() - 0.5) * W * 0.7;
        const oy = (rand() - 0.5) * H * 0.7;
        const rr = 3 + rand() * 9;
        ctx.fillStyle = "rgba(250,240,220,0.14)";
        ctx.beginPath();
        ctx.ellipse(ox, oy, rr * 1.8, rr * 0.6, 0, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    if (type === "neptune") {
      const x = W * 0.33;
      const y = H * 0.64;
      ctx.save();
      const grd = ctx.createRadialGradient(x, y, 2, x, y, W * 0.09);
      grd.addColorStop(0, "rgba(7,24,76,0.78)");
      grd.addColorStop(0.7, "rgba(10,37,105,0.42)");
      grd.addColorStop(1, "rgba(10,37,105,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.ellipse(x, y, W * 0.09, H * 0.06, -0.06, 0, TAU);
      ctx.fill();
      for (let i = 0; i < 8; i++) {
        const sx = W * (0.1 + rand() * 0.8);
        const sy = H * (0.25 + rand() * 0.5);
        ctx.fillStyle = "rgba(210,234,255,0.15)";
        ctx.beginPath();
        ctx.ellipse(sx, sy, 14 + rand() * 30, 1 + rand() * 2, 0, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    if (type === "earth") {
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = "#d8efff";
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 18; i++) {
        const x = W * rand();
        const y = H * (0.2 + rand() * 0.6);
        ctx.beginPath();
        ctx.ellipse(x, y, 8 + rand() * 28, 2 + rand() * 5, rand() * PI, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  async function loadTextureURL(url, renderer, opts) {
    const tex = await new T.TextureLoader().loadAsync(url);
    tex.colorSpace = opts && opts.colorSpace !== undefined ? opts.colorSpace : T.SRGBColorSpace;
    tex.wrapS = (opts && opts.wrapS) || T.RepeatWrapping;
    tex.wrapT = (opts && opts.wrapT) || T.ClampToEdgeWrapping;
    tex.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
    tex.needsUpdate = true;
    return tex;
  }

  async function loadPlanetTexture(def, renderer) {
    const assets = window.CLOVE_TEXTURES || {};
    const url = assets[def.texture];
    if (url) {
      try {
        const tex = await loadTextureURL(url, renderer);
        return { texture: tex, preview: url, canvas: null };
      } catch (err) {
        console.warn("Texture failed, using procedural fallback:", def.id, err);
      }
    }
    return generateSurface(def, renderer);
  }

  function generateCloudTexture(renderer) {    const W = 512;
    const H = 256;
    const canvas = makeCanvas(W, H);
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(W, H);
    const data = img.data;
    for (let y = 0; y < H; y++) {
      const v = (y + 0.5) / H;
      const lat = (v - 0.5) * PI;
      for (let x = 0; x < W; x++) {
        const p = surfacePoint((x + 0.5) / W, v);
        const n = fbm3(p[0] * 3.4 + 4.4, p[1] * 3.4, p[2] * 3.4, 4, 884);
        const wisps = fbm3(p[0] * 8.2, p[1] * 8.2, p[2] * 8.2, 3, 998);
        let a = clamp((n - 0.54) * 3.2 + (wisps - 0.5) * 0.7, 0, 1);
        a *= 0.36 + 0.64 * clamps01((Math.cos(lat) - 0.1) * 1.15);
        const idx = (y * W + x) * 4;
        data[idx] = 238;
        data[idx + 1] = 247;
        data[idx + 2] = 255;
        data[idx + 3] = Math.round(a * 238);
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new T.CanvasTexture(canvas);
    tex.colorSpace = T.SRGBColorSpace;
    tex.wrapS = T.RepeatWrapping;
    tex.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  function clamps01(v) {
    return clamp(v, 0, 1);
  }

  /* ---------------------------------------------------------
     sprite / texture helpers
     --------------------------------------------------------- */

  function makeRadialTexture(size, stops) {
    const c = makeCanvas(size, size);
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach((s) => g.addColorStop(s[0], s[1]));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  function makeStarTexture() {
    const s = 64;
    const c = makeCanvas(s, s);
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.16, "rgba(255,255,255,0.95)");
    g.addColorStop(0.38, "rgba(196,223,255,0.32)");
    g.addColorStop(1, "rgba(160,200,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  function makeFlareTexture() {
    const s = 256;
    const c = makeCanvas(s, s);
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.06, "rgba(255,255,255,0.65)");
    g.addColorStop(0.2, "rgba(174,208,255,0.13)");
    g.addColorStop(1, "rgba(130,180,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    ctx.globalCompositeOperation = "lighter";
    const ray = ctx.createLinearGradient(0, s / 2, s, s / 2);
    ray.addColorStop(0, "rgba(190,220,255,0)");
    ray.addColorStop(0.48, "rgba(230,244,255,0.18)");
    ray.addColorStop(0.5, "rgba(255,255,255,0.5)");
    ray.addColorStop(0.52, "rgba(230,244,255,0.18)");
    ray.addColorStop(1, "rgba(190,220,255,0)");
    ctx.fillStyle = ray;
    ctx.fillRect(0, s / 2 - 1.2, s, 2.4);
    const ray2 = ctx.createLinearGradient(s / 2, 0, s / 2, s);
    ray2.addColorStop(0, "rgba(190,220,255,0)");
    ray2.addColorStop(0.5, "rgba(255,255,255,0.25)");
    ray2.addColorStop(1, "rgba(190,220,255,0)");
    ctx.fillStyle = ray2;
    ctx.fillRect(s / 2 - 0.6, 0, 1.2, s);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  function makeNebulaTexture() {
    const s = 512;
    const c = makeCanvas(s, s);
    const ctx = c.getContext("2d");
    ctx.globalCompositeOperation = "lighter";
    const rand = mulberry32(7193);
    for (let i = 0; i < 70; i++) {
      const x = s * (0.14 + rand() * 0.72);
      const y = s * (0.14 + rand() * 0.72);
      const r = 18 + Math.pow(rand(), 1.8) * 135;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${0.018 + rand() * 0.036})`);
      g.addColorStop(0.45, `rgba(255,255,255,${0.008 + rand() * 0.02})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const mask = ctx.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s * 0.5);
    mask.addColorStop(0, "rgba(255,255,255,1)");
    mask.addColorStop(0.7, "rgba(255,255,255,0.55)");
    mask.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = mask;
    ctx.fillRect(0, 0, s, s);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  function makeSunPreview() {
    const s = 512;
    const c = makeCanvas(s, s);
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(s * 0.44, s * 0.4, 2, s * 0.5, s * 0.5, s * 0.5);
    g.addColorStop(0, "#fff9e8");
    g.addColorStop(0.28, "#ffd987");
    g.addColorStop(0.6, "#f39b3c");
    g.addColorStop(0.88, "#b95015");
    g.addColorStop(1, "#6f2a08");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2, 0, TAU);
    ctx.fill();
    const rand = mulberry32(33);
    ctx.globalCompositeOperation = "overlay";
    for (let i = 0; i < 160; i++) {
      const x = s * rand();
      const y = s * rand();
      const r = 2 + rand() * 16;
      ctx.fillStyle = `rgba(255,${180 + Math.round(rand() * 60)},80,${0.03 + rand() * 0.09})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    return c.toDataURL("image/jpeg", 0.86);
  }

  /* ---------------------------------------------------------
     boot UI
     --------------------------------------------------------- */

  const boot = $("#boot");
  const bootBar = $("#bootBar");
  const bootPct = $("#bootPct");
  const bootStatusLabel = $("#bootStatusLabel");
  const welcomeHint = $("#welcomeHint");
  const enterBtn = $("#enterBtn");
  const welcomeTourBtn = $("#welcomeTourBtn");
  let bootDone = false;
  let welcomeReady = false;

  function setLoad(p, label) {
    const pct = clamp(Math.round(p), 0, 100);
    bootBar.style.width = pct + "%";
    bootPct.textContent = String(pct).padStart(2, "0") + "%";
    if (label && bootStatusLabel) bootStatusLabel.textContent = label;
    if (welcomeHint && !welcomeReady) {
      welcomeHint.textContent = (label || "正在准备行星影像") + " · " + String(pct).padStart(2, "0") + "%";
    }
  }

  function readyWelcome() {
    if (welcomeReady) return;
    welcomeReady = true;
    boot.classList.add("is-ready");
    setLoad(100, "观测站已就绪");
    if (welcomeHint) welcomeHint.textContent = "拖拽环绕 · 滚轮靠近 · 点击锁定 · 键盘 1–8";
    enterBtn.disabled = false;
    welcomeTourBtn.disabled = false;
  }

  function enterExperience(startTour) {
    if (bootDone || !welcomeReady) return;
    bootDone = true;
    boot.classList.add("is-done");
    document.body.classList.add("app-ready");
    cameraState.welcome = false;
    setOverview(false);
    window.setTimeout(() => {
      boot.setAttribute("aria-hidden", "true");
    }, 1300);
    if (startTour) {
      window.setTimeout(() => {
        if (!cameraState.autoTour) toggleTour(true);
      }, 1150);
    }
  }

  enterBtn.addEventListener("click", () => enterExperience(false));
  welcomeTourBtn.addEventListener("click", () => enterExperience(true));

  /* ---------------------------------------------------------
     scene
     --------------------------------------------------------- */

  const canvas = $("#space");
  let renderer;
  try {
    renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
      powerPreference: "high-performance"
    });
  } catch (err) {
    $("#bootStatusLabel").textContent = "WebGL 初始化失败";
    bootPct.textContent = "ERR";
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.03, 3000);
  scene.add(camera);
  const cameraFill = new T.PointLight(0xd6e4ff, 0.38, 0, 0);
  cameraFill.position.set(0, 0, 0);
  camera.add(cameraFill);

  const world = new T.Group();
  scene.add(world);

  // lighting: one warm star, a whisper of cool fill
  const sunLight = new T.PointLight(0xffe0ae, 5.9, 0, 0);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);
  const ambient = new T.AmbientLight(0x8099c4, 0.18);
  scene.add(ambient);
  const hemi = new T.HemisphereLight(0x8fb8ff, 0x1c130b, 0.16);
  scene.add(hemi);
  const fill = new T.DirectionalLight(0x7ea6ff, 0.42);
  fill.position.set(-1, 0.4, 0.8);
  scene.add(fill);

  const starTex = makeStarTexture();
  const flareTex = makeFlareTexture();
  const nebulaTex = makeNebulaTexture();

  let galaxyUniforms, starUniforms, galaxySpin, galaxyPivot, starPoints;

  function pointsMaterial(opts) {
    return new T.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDpr: { value: renderer.getPixelRatio() },
        uOpacity: { value: opts.opacity != null ? opts.opacity : 1 },
        uPixelScale: { value: opts.pixelScale != null ? opts.pixelScale : 240 }
      },
      vertexShader: `
        attribute float aSize;
        attribute float aPhase;
        attribute vec3 aColor;
        uniform float uTime;
        uniform float uDpr;
        uniform float uPixelScale;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(aSize * uDpr * (uPixelScale / max(1.0, -mv.z)), 0.7, 7.0);
          vColor = aColor;
          vAlpha = 0.68 + 0.32 * sin(uTime * 0.72 + aPhase);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float core = smoothstep(0.5, 0.02, d);
          float glow = smoothstep(0.5, 0.22, d) * 0.4;
          float alpha = (core * 0.85 + glow) * vAlpha * uOpacity;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending
    });
  }

  function buildGalaxyBackdrop() {
    const cv = $("#galaxyBackdrop");
    const W = 2200;
    const H = 1400;
    cv.width = W;
    cv.height = H;
    const mainCtx = cv.getContext("2d");
    let ctx = mainCtx;
    const rand = mulberry32(20261028);
    const gauss = () => {
      let u = 0, v = 0;
      while (u === 0) u = rand();
      while (v === 0) v = rand();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
    };
    const cx = W * 0.35;
    const cy = H * 0.17;
    const rot = -0.3;
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    const squash = 0.53;

    const base = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.78);
    base.addColorStop(0, "#050813");
    base.addColorStop(0.46, "#040610");
    base.addColorStop(1, "#020308");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);

    const galaxyLayer = makeCanvas(W, H);
    ctx = galaxyLayer.getContext("2d");
    ctx.globalCompositeOperation = "lighter";

    const project = (lx, ly) => [
      cx + lx * cosR - ly * sinR,
      cy + lx * sinR + ly * cosR
    ];

    // broad galactic halo
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(1, squash);
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 1560);
    halo.addColorStop(0, "rgba(255,206,150,0.11)");
    halo.addColorStop(0.12, "rgba(255,187,132,0.075)");
    halo.addColorStop(0.3, "rgba(132,146,255,0.075)");
    halo.addColorStop(0.58, "rgba(92,118,225,0.038)");
    halo.addColorStop(0.82, "rgba(85,72,160,0.012)");
    halo.addColorStop(1, "rgba(40,32,90,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(-1700, -1700, 3400, 3400);
    ctx.restore();

    ctx.globalCompositeOperation = "lighter";

    function galaxyColor(t, roll) {
      const c0 = [255, 239, 211];
      const c1 = [206, 193, 255];
      const c2 = [118, 155, 255];
      let c;
      if (t < 0.3) c = mix(c0, c1, t / 0.3);
      else c = mix(c1, c2, clamp((t - 0.3) / 0.7, 0, 1));
      if (roll < 0.035) c = [255, 164, 197];
      else if (roll < 0.075) c = [147, 227, 255];
      return c;
    }

    // two principal + two secondary logarithmic arms
    const armDefs = [
      { offset: 0.0, count: 4400, strength: 1.0 },
      { offset: PI, count: 4400, strength: 1.0 },
      { offset: PI * 0.52, count: 1800, strength: 0.42 },
      { offset: PI * 1.52, count: 1800, strength: 0.42 }
    ];

    armDefs.forEach((arm) => {
      for (let i = 0; i < arm.count; i++) {
        const t = Math.pow(rand(), 0.7);
        const r = 26 + t * 1570;
        const theta = arm.offset + Math.log(r / 31) * 2.34 + gauss() * (0.08 + 0.07 * (1 - t));
        const lx = Math.cos(theta) * r + gauss() * (3.5 + 16 * (1 - t));
        const ly = Math.sin(theta) * r + gauss() * (2.5 + 12 * (1 - t));
        const p = project(lx, ly * squash);
        if (p[0] < -60 || p[0] > W + 60 || p[1] < -60 || p[1] > H + 60) continue;
        const roll = rand();
        const c = galaxyColor(t, roll);
        const alpha = (0.12 + Math.pow(1 - t, 1.25) * 0.5 + (roll < 0.03 ? 0.22 : 0)) * arm.strength;
        const size = (0.45 + Math.pow(rand(), 2.2) * 1.65) * (1 + (1 - t) * 0.55);
        ctx.fillStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha.toFixed(3)})`;
        ctx.fillRect(p[0], p[1], size, size);
        if (roll < 0.012) {
          ctx.fillStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},0.07)`;
          ctx.beginPath();
          ctx.arc(p[0], p[1], 3 + rand() * 6, 0, TAU);
          ctx.fill();
        }
      }
    });

    // smooth luminous haze laid along the principal arms
    [0, PI].forEach((armOffset) => {
      for (let i = 0; i < 240; i++) {
        const t = i / 240;
        const r = 55 + t * 1480;
        const theta = armOffset + Math.log(r / 31) * 2.34;
        const lx = Math.cos(theta) * r;
        const ly = Math.sin(theta) * r;
        const p = project(lx, ly * squash);
        const c = galaxyColor(t, 0.2);
        const rad = 20 + (1 - t) * 54;
        const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], rad);
        g.addColorStop(0, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},0.018)`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(p[0] - rad, p[1] - rad, rad * 2, rad * 2);
      }
    });

    // luminous nebular knots along the arms
    for (let i = 0; i < 390; i++) {
      const t = Math.pow(rand(), 0.72);
      const r = 26 + t * 1520;
      if (r < 135) continue;
      const armOffset = rand() < 0.5 ? 0 : PI;
      const theta = armOffset + Math.log(r / 31) * 2.34 + gauss() * 0.16;
      const lx = Math.cos(theta) * r + gauss() * 24;
      const ly = Math.sin(theta) * r + gauss() * 18;
      const p = project(lx, ly * squash);
      const c = galaxyColor(t, rand());
      const rad = 12 + Math.pow(rand(), 2.0) * 65;
      const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], rad);
      g.addColorStop(0, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${0.03 + rand() * 0.045})`);
      g.addColorStop(0.55, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},0.012)`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(p[0] - rad, p[1] - rad, rad * 2, rad * 2);
    }

    // dark dust lanes carve detail into the arms
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < 250; i++) {
      const t = 0.08 + rand() * 0.85;
      const r = 30 + t * 1450;
      const armOffset = rand() < 0.5 ? 0 : PI;
      const theta = armOffset + Math.log(r / 31) * 2.34 + 0.13 + gauss() * 0.05;
      const lx = Math.cos(theta) * r + gauss() * 20;
      const ly = Math.sin(theta) * r + gauss() * 12;
      const p = project(lx, ly * squash);
      const rad = 8 + Math.pow(rand(), 1.8) * 46;
      const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], rad);
      g.addColorStop(0, `rgba(3,5,12,${0.055 + rand() * 0.06})`);
      g.addColorStop(0.6, "rgba(3,5,12,0.025)");
      g.addColorStop(1, "rgba(3,5,12,0)");
      ctx.fillStyle = g;
      ctx.fillRect(p[0] - rad, p[1] - rad, rad * 2, rad * 2);
    }

    // warm core, rendered as an elliptical bloom
    ctx.globalCompositeOperation = "lighter";
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(1, squash);
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 245);
    core.addColorStop(0, "rgba(255,247,224,0.78)");
    core.addColorStop(0.07, "rgba(255,230,181,0.56)");
    core.addColorStop(0.22, "rgba(255,188,118,0.24)");
    core.addColorStop(0.5, "rgba(228,141,102,0.07)");
    core.addColorStop(1, "rgba(120,90,160,0)");
    ctx.fillStyle = core;
    ctx.fillRect(-400, -400, 800, 800);
    const coreHot = ctx.createRadialGradient(0, 0, 0, 0, 0, 46);
    coreHot.addColorStop(0, "rgba(255,255,247,1)");
    coreHot.addColorStop(0.28, "rgba(255,240,203,0.8)");
    coreHot.addColorStop(0.68, "rgba(255,190,120,0.22)");
    coreHot.addColorStop(1, "rgba(255,160,90,0)");
    ctx.fillStyle = coreHot;
    ctx.fillRect(-90, -90, 180, 180);
    ctx.restore();

    // dense core stars
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 850; i++) {
      const rr = Math.pow(rand(), 2.2) * 130;
      const aa = rand() * TAU;
      const lx = Math.cos(aa) * rr;
      const ly = Math.sin(aa) * rr * squash;
      const p = project(lx, ly);
      const c = rand() < 0.5 ? [255, 245, 219] : [255, 208, 153];
      const alpha = 0.22 + rand() * 0.55;
      const size = 0.5 + rand() * 1.5;
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
      ctx.fillRect(p[0], p[1], size, size);
    }

    // field stars
    for (let i = 0; i < 1600; i++) {
      const x = rand() * W;
      const y = rand() * H;
      const roll = rand();
      const c = roll < 0.6 ? [226, 240, 255] : roll < 0.84 ? [168, 197, 255] : [255, 220, 183];
      const alpha = 0.06 + rand() * 0.32;
      const size = 0.4 + Math.pow(rand(), 2.2) * 1.5;
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
      ctx.fillRect(x, y, size, size);
    }

    // three foreground lens-flare stars
    function drawFlare(x, y, r, color) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(0.1, `rgba(${color[0]},${color[1]},${color[2]},0.55)`);
      g.addColorStop(0.35, `rgba(${color[0]},${color[1]},${color[2]},0.08)`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      const ray = ctx.createLinearGradient(x - r * 1.5, y, x + r * 1.5, y);
      ray.addColorStop(0, "rgba(255,255,255,0)");
      ray.addColorStop(0.47, "rgba(255,255,255,0.08)");
      ray.addColorStop(0.5, "rgba(255,255,255,0.5)");
      ray.addColorStop(0.53, "rgba(255,255,255,0.08)");
      ray.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = ray;
      ctx.fillRect(x - r * 1.5, y - 0.7, r * 3, 1.4);
      const ray2 = ctx.createLinearGradient(x, y - r * 1.2, x, y + r * 1.2);
      ray2.addColorStop(0, "rgba(255,255,255,0)");
      ray2.addColorStop(0.5, "rgba(255,255,255,0.28)");
      ray2.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = ray2;
      ctx.fillRect(x - 0.5, y - r * 1.2, 1, r * 2.4);
    }
    drawFlare(W * 0.145, H * 0.24, 52, [170, 211, 255]);
    drawFlare(W * 0.8, H * 0.78, 40, [255, 216, 179]);
    drawFlare(W * 0.885, H * 0.18, 31, [197, 222, 255]);

    // composite the galaxy: a soft bloom, a mid glow, then the crisp star layer
    mainCtx.save();
    mainCtx.globalCompositeOperation = "lighter";
    mainCtx.filter = "blur(30px)";
    mainCtx.globalAlpha = 0.55;
    mainCtx.drawImage(galaxyLayer, 0, 0);
    mainCtx.filter = "blur(9px)";
    mainCtx.globalAlpha = 0.82;
    mainCtx.drawImage(galaxyLayer, 0, 0);
    mainCtx.filter = "none";
    mainCtx.globalAlpha = 1;
    mainCtx.globalCompositeOperation = "source-over";
    mainCtx.drawImage(galaxyLayer, 0, 0);
    mainCtx.restore();

    // gentle outer fade so the canvas edge never shows
    const edge = mainCtx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.92);
    edge.addColorStop(0, "rgba(2,3,8,0)");
    edge.addColorStop(1, "rgba(2,3,8,0.72)");
    mainCtx.fillStyle = edge;
    mainCtx.fillRect(0, 0, W, H);
  }

  function buildGalaxy() {
    galaxyPivot = new T.Group();
    galaxyPivot.position.set(12, -56, -480);
    galaxyPivot.rotation.set(1.04, 0.15, 0.22);
    scene.add(galaxyPivot);

    galaxySpin = new T.Group();
    galaxyPivot.add(galaxySpin);

    const count = 74000;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    const pha = new Float32Array(count);
    const rand = mulberry32(20261028);
    const gauss = () => {
      let u = 0, v = 0;
      while (u === 0) u = rand();
      while (v === 0) v = rand();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
    };
    const warm = [255, 222, 171];
    const gold = [255, 194, 119];
    const blue = [151, 177, 255];
    const violet = [184, 152, 255];
    const rose = [255, 154, 197];
    const cyan = [150, 235, 255];

    for (let i = 0; i < count; i++) {
      const t = Math.pow(rand(), 0.63);
      const r = 11 + t * 322;
      const arm = i % 3;
      const armAngle = (arm / 3) * TAU;
      const spiral = r * 0.0145;
      const ang = armAngle + spiral + gauss() * (0.055 + 0.14 * (1 - t));
      const spread = 2 + 22 * Math.pow(1 - t, 1.35);
      const x = Math.cos(ang) * r + gauss() * spread;
      const z = Math.sin(ang) * r + gauss() * spread;
      const y = gauss() * (3.2 + 13 * (1 - t)) * (1 - t * 0.3);

      // occasional halo stars around the disk
      const halo = rand() < 0.035;
      const hx = halo ? gauss() * 150 : x;
      const hy = halo ? gauss() * 85 : y;
      const hz = halo ? gauss() * 150 : z;

      pos[i * 3] = hx;
      pos[i * 3 + 1] = hy;
      pos[i * 3 + 2] = hz;

      const coreT = clamp(1 - r / 110, 0, 1);
      let c;
      const roll = rand();
      if (coreT > 0.55) c = mix(warm, gold, rand() * 0.7);
      else if (roll < 0.07) c = rose;
      else if (roll < 0.15) c = cyan;
      else if (roll < 0.48) c = blue;
      else c = violet;
      const fade = 0.45 + 0.55 * (1 - t) + (halo ? -0.18 : 0);
      c = shade(c, fade);
      col[i * 3] = c[0] / 255;
      col[i * 3 + 1] = c[1] / 255;
      col[i * 3 + 2] = c[2] / 255;
      siz[i] = (0.55 + rand() * 1.7) * (coreT > 0.55 ? 1.5 : 1) + (rand() < 0.01 ? 1.8 : 0);
      pha[i] = rand() * TAU;
    }

    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    geo.setAttribute("aColor", new T.BufferAttribute(col, 3));
    geo.setAttribute("aSize", new T.BufferAttribute(siz, 1));
    geo.setAttribute("aPhase", new T.BufferAttribute(pha, 1));
    const mat = pointsMaterial({ opacity: 0.94, pixelScale: 300 });
    galaxyUniforms = mat.uniforms;
    const galaxy = new T.Points(geo, mat);
    galaxy.frustumCulled = false;
    galaxySpin.add(galaxy);

    // warm bulge
    const coreCount = 10000;
    const cpos = new Float32Array(coreCount * 3);
    const ccol = new Float32Array(coreCount * 3);
    const csiz = new Float32Array(coreCount);
    const cpha = new Float32Array(coreCount);
    for (let i = 0; i < coreCount; i++) {
      const rr = Math.pow(rand(), 1.8) * 42;
      const th = rand() * TAU;
      const ph = Math.acos(2 * rand() - 1);
      cpos[i * 3] = Math.sin(ph) * Math.cos(th) * rr;
      cpos[i * 3 + 1] = Math.cos(ph) * rr * 0.52;
      cpos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * rr;
      const c = mix([255, 238, 198], [255, 171, 91], rand());
      ccol[i * 3] = c[0] / 255;
      ccol[i * 3 + 1] = c[1] / 255;
      ccol[i * 3 + 2] = c[2] / 255;
      csiz[i] = 0.8 + rand() * 2.5;
      cpha[i] = rand() * TAU;
    }
    const cgeo = new T.BufferGeometry();
    cgeo.setAttribute("position", new T.BufferAttribute(cpos, 3));
    cgeo.setAttribute("aColor", new T.BufferAttribute(ccol, 3));
    cgeo.setAttribute("aSize", new T.BufferAttribute(csiz, 1));
    cgeo.setAttribute("aPhase", new T.BufferAttribute(cpha, 1));
    const coreMat = pointsMaterial({ opacity: 0.9, pixelScale: 260 });
    const core = new T.Points(cgeo, coreMat);
    core.frustumCulled = false;
    galaxySpin.add(core);

    // diffuse nebular light
    const nebulaColors = [0x6b7cff, 0xa56bff, 0xff7e6b, 0x61d4ff];
    for (let i = 0; i < 7; i++) {
      const m = new T.SpriteMaterial({
        map: nebulaTex,
        color: nebulaColors[i % nebulaColors.length],
        transparent: true,
        opacity: 0.17 + rand() * 0.14,
        blending: T.AdditiveBlending,
        depthWrite: false,
        rotation: rand() * TAU
      });
      const sp = new T.Sprite(m);
      const rr = 20 + rand() * 180;
      const aa = rand() * TAU;
      sp.position.set(Math.cos(aa) * rr, (rand() - 0.5) * 22, Math.sin(aa) * rr);
      const sz = 120 + rand() * 250;
      sp.scale.set(sz, sz, 1);
      galaxySpin.add(sp);
    }

    // galactic core bloom
    const bloomTex = makeRadialTexture(256, [
      [0, "rgba(255,245,218,0.95)"],
      [0.12, "rgba(255,203,132,0.55)"],
      [0.42, "rgba(255,145,82,0.15)"],
      [1, "rgba(255,120,60,0)"]
    ]);
    const bloom = new T.Sprite(
      new T.SpriteMaterial({
        map: bloomTex,
        transparent: true,
        opacity: 0.8,
        blending: T.AdditiveBlending,
        depthWrite: false
      })
    );
    bloom.scale.set(115, 115, 1);
    galaxySpin.add(bloom);

    const bloom2 = new T.Sprite(
      new T.SpriteMaterial({
        map: bloomTex,
        transparent: true,
        opacity: 0.24,
        blending: T.AdditiveBlending,
        depthWrite: false
      })
    );
    bloom2.scale.set(320, 320, 1);
    galaxySpin.add(bloom2);
  }

  function buildStarfield() {
    const count = 7600;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    const pha = new Float32Array(count);
    const rand = mulberry32(4411);
    for (let i = 0; i < count; i++) {
      const rr = 280 + Math.pow(rand(), 0.7) * 720;
      const th = rand() * TAU;
      const ph = Math.acos(2 * rand() - 1);
      pos[i * 3] = Math.sin(ph) * Math.cos(th) * rr;
      pos[i * 3 + 1] = Math.cos(ph) * rr;
      pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * rr;
      const roll = rand();
      let c = roll < 0.58 ? [225, 239, 255] : roll < 0.82 ? [167, 198, 255] : [255, 218, 178];
      const f = 0.5 + rand() * 0.5;
      c = shade(c, f);
      col[i * 3] = c[0] / 255;
      col[i * 3 + 1] = c[1] / 255;
      col[i * 3 + 2] = c[2] / 255;
      siz[i] = 0.6 + Math.pow(rand(), 2.4) * 3.4;
      pha[i] = rand() * TAU;
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    geo.setAttribute("aColor", new T.BufferAttribute(col, 3));
    geo.setAttribute("aSize", new T.BufferAttribute(siz, 1));
    geo.setAttribute("aPhase", new T.BufferAttribute(pha, 1));
    const mat = pointsMaterial({ opacity: 0.82, pixelScale: 220 });
    starUniforms = mat.uniforms;
    starPoints = new T.Points(geo, mat);
    starPoints.frustumCulled = false;
    scene.add(starPoints);

    // a few cinematic lens-flare stars
    const flareRand = mulberry32(991);
    for (let i = 0; i < 4; i++) {
      const sp = new T.Sprite(
        new T.SpriteMaterial({
          map: flareTex,
          transparent: true,
          opacity: 0.34 + flareRand() * 0.22,
          blending: T.AdditiveBlending,
          depthWrite: false,
          color: i === 1 ? 0xffd8b0 : 0xa9ccff
        })
      );
      const rr = 450 + flareRand() * 250;
      const th = flareRand() * TAU;
      const ph = Math.acos(2 * flareRand() - 1);
      sp.position.set(Math.sin(ph) * Math.cos(th) * rr, Math.cos(ph) * rr, Math.sin(ph) * Math.sin(th) * rr);
      const s = 55 + flareRand() * 90;
      sp.scale.set(s, s, 1);
      scene.add(sp);
    }
  }

  /* ---------------------------------------------------------
     sun
     --------------------------------------------------------- */

  const sunGroup = new T.Group();
  scene.add(sunGroup);
  let sunMesh, coronaA, coronaB, coronaC, sunFlare, sunUniforms;
  let sharedSunTexture = null;

  const NOISE_GLSL = `
    float hash(vec3 p) {
      p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }
    float noise(vec3 x) {
      vec3 p = floor(x);
      vec3 f = fract(x);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(mix(hash(p + vec3(0,0,0)), hash(p + vec3(1,0,0)), f.x),
            mix(hash(p + vec3(0,1,0)), hash(p + vec3(1,1,0)), f.x), f.y),
        mix(mix(hash(p + vec3(0,0,1)), hash(p + vec3(1,0,1)), f.x),
            mix(hash(p + vec3(0,1,1)), hash(p + vec3(1,1,1)), f.x), f.y), f.z);
    }
    float fbm(vec3 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p = p * 2.02 + vec3(12.3, 4.7, 8.1);
        a *= 0.5;
      }
      return v;
    }
  `;

  function buildSun() {
    const sunMap = sharedSunTexture || (() => {
      const c = makeCanvas(256, 128);
      const cx2 = c.getContext("2d");
      const g = cx2.createRadialGradient(128, 64, 0, 128, 64, 128);
      g.addColorStop(0, "#fff7de");
      g.addColorStop(0.48, "#ffd078");
      g.addColorStop(0.8, "#ef8f2b");
      g.addColorStop(1, "#a54513");
      cx2.fillStyle = g;
      cx2.fillRect(0, 0, 256, 128);
      const tex = new T.CanvasTexture(c);
      tex.colorSpace = T.SRGBColorSpace;
      return tex;
    })();
    sunUniforms = { uTime: { value: 0 }, uMap: { value: sunMap } };
    const mat = new T.ShaderMaterial({
      uniforms: sunUniforms,
      vertexShader: `
        varying vec3 vNormalW;
        varying vec3 vPosW;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vPosW = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform sampler2D uMap;
        varying vec3 vNormalW;
        varying vec3 vPosW;
        varying vec2 vUv;
        ${NOISE_GLSL}
        void main() {
          vec3 p = normalize(vNormalW);
          float t = uTime * 0.018;
          vec2 uv = vUv;
          uv.x += (fbm(p * 4.2 + vec3(0.0, t, -t * 0.4)) - 0.5) * 0.012;
          uv.y += (fbm(p * 7.0 - vec3(t * 0.7, 0.0, t * 0.3)) - 0.5) * 0.008;
          vec3 base = texture2D(uMap, uv).rgb;
          base = pow(base, vec3(0.74));
          float flow = fbm(p * 8.6 + vec3(t * 1.4, -t, t * 0.8));
          float heat = smoothstep(0.2, 0.86, flow);
          vec3 c = base * vec3(1.22, 1.02, 0.7);
          c = mix(c, vec3(1.0, 0.63, 0.2), 0.2);
          c += vec3(1.0, 0.46, 0.09) * pow(heat, 2.2) * 0.55;
          c += vec3(1.0, 0.92, 0.7) * pow(heat, 6.0) * 0.85;
          vec3 viewDir = normalize(cameraPosition - vPosW);
          float mu = max(dot(normalize(vNormalW), viewDir), 0.0);
          c *= 1.34 - pow(1.0 - mu, 0.6) * 0.42;
          c += vec3(1.0, 0.4, 0.07) * pow(1.0 - mu, 3.0) * 0.8;
          gl_FragColor = vec4(c * 1.84, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    });
    sunMesh = new T.Mesh(new T.SphereGeometry(5.15, 128, 96), mat);
    sunMesh.userData.isSun = true;
    sunGroup.add(sunMesh);

    const coronaTex = makeRadialTexture(512, [
      [0, "rgba(255,248,224,0.95)"],
      [0.18, "rgba(255,222,154,0.72)"],
      [0.34, "rgba(255,174,86,0.4)"],
      [0.52, "rgba(255,126,46,0.14)"],
      [0.74, "rgba(255,94,32,0.03)"],
      [1, "rgba(255,80,20,0)"]
    ]);

    coronaA = new T.Sprite(
      new T.SpriteMaterial({
        map: coronaTex,
        transparent: true,
        opacity: 0.85,
        blending: T.AdditiveBlending,
        depthWrite: false,
        depthTest: true
      })
    );
    coronaA.scale.set(28, 28, 1);
    sunGroup.add(coronaA);

    coronaB = new T.Sprite(
      new T.SpriteMaterial({
        map: coronaTex,
        transparent: true,
        opacity: 0.4,
        blending: T.AdditiveBlending,
        depthWrite: false
      })
    );
    coronaB.scale.set(62, 62, 1);
    sunGroup.add(coronaB);

    coronaC = new T.Sprite(
      new T.SpriteMaterial({
        map: coronaTex,
        transparent: true,
        opacity: 0.15,
        blending: T.AdditiveBlending,
        depthWrite: false
      })
    );
    coronaC.scale.set(118, 118, 1);
    sunGroup.add(coronaC);

    sunFlare = new T.Sprite(
      new T.SpriteMaterial({
        map: flareTex,
        color: 0xffcf99,
        transparent: true,
        opacity: 0.28,
        blending: T.AdditiveBlending,
        depthWrite: false,
        rotation: 0.2
      })
    );
    sunFlare.scale.set(42, 42, 1);
    sunGroup.add(sunFlare);

    // tiny lens flare ring
    const ringMat = new T.MeshBasicMaterial({
      color: 0xffc186,
      transparent: true,
      opacity: 0.16,
      blending: T.AdditiveBlending,
      depthWrite: false,
      side: T.DoubleSide
    });
    const flareRing = new T.Mesh(new T.RingGeometry(8.3, 8.36, 96), ringMat);
    flareRing.rotation.x = -PI / 2;
    flareRing.userData.isFlare = true;
    sunGroup.add(flareRing);
  }

  /* ---------------------------------------------------------
     planet construction
     --------------------------------------------------------- */

  const planets = [];
  const clickables = [];
  const orbitLines = [];
  const moonLines = [];
  let beltGroup;
  let orbitElapsed = 0;
  let sharedMoonTexture = null;
  let sharedCloudTexture = null;
  let sharedRingTexture = null;
  let sharedEarthNormal = null;
  let sharedEarthRoughness = null;

  function makeOrbitLine(radius, color, opacity) {
    const pts = [];
    const segments = 256;
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * TAU;
      pts.push(new T.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    const geo = new T.BufferGeometry().setFromPoints(pts);
    const mat = new T.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: T.AdditiveBlending
    });
    const line = new T.LineLoop(geo, mat);
    line.userData.baseOpacity = opacity;
    orbitLines.push(line);
    return line;
  }

  function createRings(def, renderer) {
    const R = def.radius;
    const inner = R * def.rings.inner;
    const outer = R * def.rings.outer;
    const isSaturn = def.rings.type === "saturn";
    const geo = new T.RingGeometry(inner, outer, 256, 8);
    const useRingMap = isSaturn && !!sharedRingTexture;
    const mat = new T.ShaderMaterial({
      defines: { USE_RING_MAP: useRingMap ? 1 : 0 },
      uniforms: {
        uInner: { value: inner },
        uOuter: { value: outer },
        uMap: { value: sharedRingTexture || null },
        uA: { value: new T.Color(isSaturn ? 0x8f7857 : 0x6e98a4) },
        uB: { value: new T.Color(isSaturn ? 0xf3e3c2 : 0xa9d7da) },
        uOpacity: { value: isSaturn ? 0.98 : 0.1 },
        uPlanetRadius: { value: R }
      },
      vertexShader: `
        varying vec3 vLocal;
        varying vec3 vWorld;
        varying vec3 vCenter;
        void main() {
          vLocal = position;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          vCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uInner;
        uniform float uOuter;
        uniform sampler2D uMap;
        uniform vec3 uA;
        uniform vec3 uB;
        uniform float uOpacity;
        uniform float uPlanetRadius;
        varying vec3 vLocal;
        varying vec3 vWorld;
        varying vec3 vCenter;
        void main() {
          float r = length(vLocal.xy);
          float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
          float edge = smoothstep(0.0, 0.018, t) * (1.0 - smoothstep(0.965, 1.0, t));
          vec3 col;
          float alpha;
          #if USE_RING_MAP
            vec4 ring = texture2D(uMap, vec2(t, 0.5));
            float lum = dot(ring.rgb, vec3(0.299, 0.587, 0.114));
            col = mix(uA, uB, clamp(lum * 1.4, 0.0, 1.0)) * (0.92 + lum * 0.72);
            alpha = edge * uOpacity * ring.a * (0.52 + lum * 0.82);
          #else
            float b1 = 0.5 + 0.5 * sin(t * 92.0);
            float b2 = 0.5 + 0.5 * sin(t * 41.0 + 1.4);
            float bands = b1 * 0.5 + b2 * 0.5;
            float alphaGap = 1.0 - smoothstep(0.67, 0.72, t) * 0.8;
            col = mix(uA, uB, bands);
            alpha = edge * uOpacity * alphaGap * (0.5 + bands * 0.5);
          #endif

          // planet shadow cast across the ring plane
          vec3 toSun = normalize(-vWorld);
          vec3 toCenter = vCenter - vWorld;
          float tca = dot(toCenter, toSun);
          float d2 = dot(toCenter, toCenter) - tca * tca;
          float core = 1.0 - smoothstep(uPlanetRadius * uPlanetRadius * 0.78, uPlanetRadius * uPlanetRadius * 1.12, d2);
          float shadow = core * step(0.0, tca);
          alpha *= 1.0 - shadow * 0.82;
          col *= 1.0 - shadow * 0.4;

          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      side: T.DoubleSide,
      depthWrite: false
    });
    const mesh = new T.Mesh(geo, mat);
    mesh.rotation.x = -PI / 2;
    mesh.renderOrder = 2;
    return mesh;
  }

  function buildPlanet(def, textureInfo, renderer) {
    const orbitGroup = new T.Group();
    orbitGroup.rotation.x = def.incl * DEG;
    orbitGroup.rotation.z = (def.incl * 0.36) * DEG;
    world.add(orbitGroup);

    const orbitColor = new T.Color(def.accent);
    const line = makeOrbitLine(def.orbit, orbitColor, 0.13);
    orbitGroup.add(line);

    const group = new T.Group();
    orbitGroup.add(group);

    const axis = new T.Group();
    axis.rotation.z = def.tilt * DEG;
    group.add(axis);

    const isEarth = def.id === "earth";
    const hasRelief = ["mercury", "venus", "mars"].includes(def.id);
    const material = new T.MeshStandardMaterial({
      map: textureInfo.texture,
      color: new T.Color(
        ({ saturn: 0xffedcf, jupiter: 0xffe9d6, neptune: 0xdfeaff, uranus: 0xa9e1e6 })[def.id] || 0xffffff
      ),
      roughness: isEarth ? 1.2 : 0.94,
      metalness: 0.01,
      emissive: new T.Color(def.accent),
      emissiveIntensity: def.id === "earth" ? 0.012 : 0.018,
      normalMap: isEarth ? sharedEarthNormal : null,
      normalScale: new T.Vector2(isEarth ? 1.05 : 0, isEarth ? 1.05 : 0),
      roughnessMap: isEarth ? sharedEarthRoughness : null,
      bumpMap: hasRelief ? textureInfo.texture : null,
      bumpScale: def.id === "mercury" ? 0.022 : def.id === "mars" ? 0.014 : 0.003
    });
    const segments = def.id === "jupiter" || def.id === "saturn" ? [128, 84] : [96, 64];
    const mesh = new T.Mesh(new T.SphereGeometry(def.radius, segments[0], segments[1]), material);
    mesh.userData.planetIndex = planets.length;
    axis.add(mesh);
    clickables.push(mesh);

    // atmosphere rim for worlds with an envelope
    const atmoColors = {
      earth: 0x5a9fe0,
      venus: 0xffcc7d,
      mars: 0xff9b73,
      uranus: 0x9be8ee,
      neptune: 0x5d8ef0
    };
    if (atmoColors[def.id]) {
      const atmoMat = new T.ShaderMaterial({
        uniforms: {
          uColor: { value: new T.Color(atmoColors[def.id]) },
          uStrength: {
            value: ({ earth: 0.38, venus: 0.58, uranus: 0.52, neptune: 0.6, mars: 0.14 })[def.id] || 0.4
          }
        },
        vertexShader: `
          varying vec3 vN;
          varying vec3 vW;
          void main() {
            vN = normalize(mat3(modelMatrix) * normal);
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vW = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uStrength;
          varying vec3 vN;
          varying vec3 vW;
          void main() {
            vec3 v = normalize(cameraPosition - vW);
            vec3 sunDir = normalize(-vW);
            float rim = pow(1.0 - abs(dot(normalize(vN), v)), 2.75);
            float day = smoothstep(-0.22, 0.58, dot(normalize(vN), sunDir));
            vec3 sunset = vec3(1.0, 0.34, 0.08);
            vec3 col = mix(sunset, uColor, smoothstep(0.02, 0.62, day));
            float alpha = rim * uStrength * (0.28 + day * 1.05);
            gl_FragColor = vec4(col * (0.78 + day * 0.45), alpha);
          }
        `,
        transparent: true,
        blending: T.AdditiveBlending,
        side: T.BackSide,
        depthWrite: false
      });
      const atmo = new T.Mesh(new T.SphereGeometry(def.radius * 1.028, 64, 48), atmoMat);
      atmo.rotation.y = 0.3;
      axis.add(atmo);
    }

    // Earth cloud shell
    let clouds = null;
    if (def.id === "earth") {
      const cloudTex = sharedCloudTexture || generateCloudTexture(renderer);
      const cloudMat = new T.MeshStandardMaterial({
        map: cloudTex,
        transparent: true,
        opacity: 0.92,
        alphaTest: 0.01,
        depthWrite: false,
        roughness: 1,
        metalness: 0
      });
      clouds = new T.Mesh(new T.SphereGeometry(def.radius * 1.013, 64, 48), cloudMat);
      axis.add(clouds);
    }

    // rings
    let ringMesh = null;
    if (def.rings) {
      ringMesh = createRings(def, renderer);
      axis.add(ringMesh);
    }

    // moons
    const moonDefs = {
      earth: [{ dist: 3.05, radius: 0.3, speed: 0.55, incl: 0.12, color: 0xcfd0c9 }],
      mars: [
        { dist: 2.0, radius: 0.075, speed: 0.9, incl: 0.08, color: 0x9a8c7d },
        { dist: 2.55, radius: 0.055, speed: 0.62, incl: -0.18, color: 0x81766c }
      ],
      jupiter: [
        { dist: 4.45, radius: 0.16, speed: 0.7, incl: 0.02, color: 0xe6d38a },
        { dist: 5.2, radius: 0.13, speed: 0.55, incl: 0.05, color: 0xd8d4c7 },
        { dist: 6.1, radius: 0.21, speed: 0.42, incl: 0.04, color: 0x9c8c7b },
        { dist: 7.0, radius: 0.19, speed: 0.33, incl: 0.06, color: 0x746e69 }
      ],
      saturn: [
        { dist: 7.1, radius: 0.24, speed: 0.45, incl: 0.04, color: 0xd9b678 },
        { dist: 6.5, radius: 0.11, speed: 0.6, incl: -0.08, color: 0xc7c4b8 }
      ],
      uranus: [
        { dist: 3.9, radius: 0.1, speed: 0.5, incl: 0.1, color: 0xb9c3c1 },
        { dist: 4.6, radius: 0.11, speed: 0.38, incl: -0.12, color: 0x9da7a6 }
      ],
      neptune: [{ dist: 3.65, radius: 0.16, speed: -0.4, incl: 0.15, color: 0xb5b9b4 }]
    };

    const moonPivots = [];
    const moonMeshes = [];
    if (moonDefs[def.id]) {
      moonDefs[def.id].forEach((m, i) => {
        const pivot = new T.Group();
        pivot.rotation.x = m.incl;
        group.add(pivot);
        const mm = new T.Mesh(
          new T.SphereGeometry(m.radius, 32, 24),
          new T.MeshStandardMaterial({
            color: m.color,
            map: sharedMoonTexture || null,
            bumpMap: sharedMoonTexture || null,
            bumpScale: 0.018,
            roughness: 1,
            metalness: 0
          })
        );
        mm.position.x = m.dist;
        pivot.add(mm);
        moonPivots.push({ pivot, mesh: mm, speed: m.speed, dist: m.dist, initial: i * 1.7 + 0.4 });
        moonMeshes.push(mm);

        const mpts = [];
        for (let j = 0; j < 96; j++) {
          const a = (j / 96) * TAU;
          mpts.push(new T.Vector3(Math.cos(a) * m.dist, 0, Math.sin(a) * m.dist));
        }
        const ml = new T.LineLoop(
          new T.BufferGeometry().setFromPoints(mpts),
          new T.LineBasicMaterial({
            color: 0xb7d5f7,
            transparent: true,
            opacity: 0.1,
            depthWrite: false,
            blending: T.AdditiveBlending
          })
        );
        ml.rotation.x = 0;
        pivot.add(ml);
        moonLines.push(ml);
      });
    }

    const planet = {
      data: def,
      index: planets.length,
      orbitGroup,
      group,
      axis,
      mesh,
      clouds,
      ringMesh,
      line,
      angle: def.initialAngle,
      spinSeed: hashString(def.id) % 1000,
      moonPivots,
      moonMeshes,
      preview: textureInfo.preview,
      worldPos: new T.Vector3(),
      screen: new T.Vector3()
    };
    planets.push(planet);

    group.position.set(Math.cos(def.initialAngle) * def.orbit, 0, Math.sin(def.initialAngle) * def.orbit);
    return planet;
  }

  function buildBelt() {
    beltGroup = new T.Group();
    beltGroup.rotation.x = 0.016;
    world.add(beltGroup);

    const count = 560;
    const geo = new T.IcosahedronGeometry(0.065, 0);
    const mat = new T.MeshStandardMaterial({
      color: 0x6d655b,
      roughness: 1,
      metalness: 0.02,
      emissive: 0x1b140e,
      emissiveIntensity: 0.2
    });
    const mesh = new T.InstancedMesh(geo, mat, count);
    const dummy = new T.Object3D();
    const rand = mulberry32(6661);
    for (let i = 0; i < count; i++) {
      const a = rand() * TAU;
      const r = 32.1 + rand() * 2.8;
      dummy.position.set(Math.cos(a) * r, (rand() - 0.5) * 0.85, Math.sin(a) * r);
      dummy.rotation.set(rand() * TAU, rand() * TAU, rand() * TAU);
      const s = 0.3 + rand() * 0.95;
      dummy.scale.set(s, s * (0.5 + rand() * 0.9), s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    beltGroup.add(mesh);
  }

  function buildKuiperBelt() {
    const count = 800;
    const pos = new Float32Array(count * 3);
    const rand = mulberry32(923);
    for (let i = 0; i < count; i++) {
      const a = rand() * TAU;
      const r = 68 + rand() * 12;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (rand() - 0.5) * 5;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    const mat = new T.PointsMaterial({
      color: 0x9db3d8,
      size: 1.25,
      map: starTex,
      alphaTest: 0.01,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      sizeAttenuation: false,
      blending: T.AdditiveBlending
    });
    const pts = new T.Points(geo, mat);
    world.add(pts);
  }

  /* ---------------------------------------------------------
     comet
     --------------------------------------------------------- */

  let comet, cometHead, cometTail, cometOrbitLine, cometTrailPos;
  let cometHistory = [];

  function buildComet() {
    comet = new T.Group();
    world.add(comet);
    const a = 54;
    const b = 40;
    const pts = [];
    for (let i = 0; i < 256; i++) {
      const t = (i / 256) * TAU;
      pts.push(new T.Vector3(Math.cos(t) * a, Math.sin(t * 2) * 2.5, Math.sin(t) * b));
    }
    cometOrbitLine = new T.LineLoop(
      new T.BufferGeometry().setFromPoints(pts),
      new T.LineBasicMaterial({
        color: 0x8ec6ff,
        transparent: true,
        opacity: 0.1,
        blending: T.AdditiveBlending,
        depthWrite: false
      })
    );
    cometOrbitLine.rotation.z = 0.14;
    world.add(cometOrbitLine);

    cometHead = new T.Sprite(
      new T.SpriteMaterial({
        map: makeRadialTexture(128, [
          [0, "rgba(255,255,255,1)"],
          [0.2, "rgba(206,236,255,0.75)"],
          [0.55, "rgba(124,190,255,0.16)"],
          [1, "rgba(90,160,255,0)"]
        ]),
        transparent: true,
        opacity: 0.95,
        blending: T.AdditiveBlending,
        depthWrite: false
      })
    );
    cometHead.scale.set(3.4, 3.4, 1);
    comet.add(cometHead);

    const count = 46;
    cometTrailPos = new Float32Array(count * 3);
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(cometTrailPos, 3));
    cometTail = new T.Points(
      geo,
      new T.PointsMaterial({
        color: 0xaed8ff,
        size: 0.55,
        map: starTex,
        alphaTest: 0.01,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        sizeAttenuation: true,
        blending: T.AdditiveBlending
      })
    );
    cometTail.frustumCulled = false;
    world.add(cometTail);
    for (let i = 0; i < 40; i++) cometHistory.push(new T.Vector3());
  }

  /* ---------------------------------------------------------
     camera, controls, state
     --------------------------------------------------------- */

  const cameraState = {
    target: new T.Vector3(),
    look: new T.Vector3(),
    theta: 0.36,
    phi: 1.02,
    radius: 320,
    desired: {
      theta: 0.36,
      phi: 1.02,
      radius: 320
    },
    intro: false,
    welcome: true,
    userActive: 0,
    dragging: false,
    pinch: false,
    autoTour: false
  };

  let selected = null;
  let viewMode = "overview";
  let labelsOn = true;
  let timeScale = 1;
  let audioOn = false;
  let tourClock = 0;
  let tourIndex = 0;
  let lastFrame = performance.now();
  let pointer = new T.Vector2(-10, -10);
  let pointerNdc = new T.Vector2(-2, -2);
  let hoveredIndex = -1;
  const raycaster = new T.Raycaster();
  const galaxyBackdropEl = $("#galaxyBackdrop");
  const backdropMotion = { x: 0, y: 0, scale: 1.02 };

  const OVERVIEW_RADIUS = () => (isMobile() ? 188 : window.innerWidth < 1280 ? 216 : 205);

  function focusDistance(planet, mode) {
    const mobileFactor = isMobile() ? (mode === "surface" ? 1.2 : 1.34) : 1;
    return planet.data.radius * (mode === "surface" ? 4.15 : planet.data.zoom) * mobileFactor;
  }

  function cameraIdeal() {
    let focus = new T.Vector3(0, 0, 0);
    let radius = cameraState.desired.radius;
    let mode = viewMode;

    if (selected && mode !== "overview") {
      selected.group.getWorldPosition(focus);
    }

    const theta = cameraState.desired.theta;
    const phi = clamp(cameraState.desired.phi, 0.26, PI - 0.26);
    const pos = new T.Vector3(
      focus.x + radius * Math.sin(phi) * Math.sin(theta),
      focus.y + radius * Math.cos(phi),
      focus.z + radius * Math.sin(phi) * Math.cos(theta)
    );

    const forward = new T.Vector3().subVectors(focus, pos).normalize();
    const right = new T.Vector3().crossVectors(forward, new T.Vector3(0, 1, 0)).normalize();
    if (right.lengthSq() < 0.001) right.set(1, 0, 0);
    const up = new T.Vector3().crossVectors(right, forward).normalize();

    const fovRad = camera.fov * DEG;
    const viewH = 2 * radius * Math.tan(fovRad / 2);
    const viewW = viewH * camera.aspect;
    let shiftX = 0;
    let shiftY = 0;
    if (cameraState.welcome) {
      shiftX = -viewW * (isMobile() ? 0.018 : 0.21);
    } else if (selected && mode !== "overview") {
      shiftX = viewW * (isMobile() ? 0.01 : 0.105);
      shiftY = isMobile() ? -viewH * 0.16 : 0;
    } else if (!selected && !isMobile()) {
      shiftX = viewW * 0.072;
    }
    const look = focus.clone().addScaledVector(right, shiftX).addScaledVector(up, shiftY);

    return { pos, look, focus };
  }

  function setOverview(instant) {
    selected = null;
    viewMode = "overview";
    document.body.classList.remove("is-focused");
    cameraState.desired.theta = cameraState.theta;
    cameraState.desired.phi = 0.99;
    cameraState.desired.radius = OVERVIEW_RADIUS();
    if (instant) {
      cameraState.radius = cameraState.desired.radius;
      cameraState.phi = cameraState.desired.phi;
    }
    setActivePlanetUI(null);
    updateViewButtons("overview");
    updateDossier(null);
    updateSceneMode();
    hideConnector();
    cameraState.autoTour = false;
    syncTourUI();
    setHintVisibility();
    updateBackdropMood();
    if (beltGroup) beltGroup.visible = true;
  }

  function setPlanet(index, mode, opts) {
    const planet = planets[index];
    if (!planet) return;
    const wasSame = selected === planet;
    selected = planet;
    viewMode = mode === "surface" ? "surface" : "focus";
    cameraState.autoTour = opts && opts.keepTour ? cameraState.autoTour : cameraState.autoTour;
    if (!opts || !opts.keepTour) cameraState.autoTour = false;
    syncTourUI();
    document.body.classList.add("is-focused");
    planet.group.updateWorldMatrix(true, false);
    const worldPos = new T.Vector3();
    planet.group.getWorldPosition(worldPos);
    const sunwardTheta = Math.atan2(-worldPos.x, -worldPos.z);
    const angleOffset = clamp(planet.data.theta * 0.42, -0.52, 0.52);
    let chosenTheta = sunwardTheta + angleOffset;
    let chosenPhi = planet.data.phi;
    if (planet.data.rings) {
      planet.axis.updateWorldMatrix(true, false);
      const ringNormal = new T.Vector3(0, 1, 0)
        .applyQuaternion(planet.axis.getWorldQuaternion(new T.Quaternion()))
        .normalize();
      if (planet.data.id === "saturn") {
        const sunDir = worldPos.clone().negate().normalize();
        const camDir = sunDir
          .multiplyScalar(0.95)
          .addScaledVector(ringNormal, 1.15)
          .add(new T.Vector3(0, 0.12, 0))
          .normalize();
        cameraState.desired.phi = Math.acos(clamp(camDir.y, 0.3, 0.95));
        chosenTheta = Math.atan2(camDir.x, camDir.z);
        chosenPhi = cameraState.desired.phi;
      } else {
        const opening = (th) => {
          const dir = new T.Vector3(
            Math.sin(planet.data.phi) * Math.sin(th),
            Math.cos(planet.data.phi),
            Math.sin(planet.data.phi) * Math.cos(th)
          );
          return Math.abs(dir.dot(ringNormal));
        };
        const candidateA = sunwardTheta + angleOffset;
        const candidateB = sunwardTheta - angleOffset;
        chosenTheta = opening(candidateA) >= opening(candidateB) ? candidateA : candidateB;
      }
    }
    cameraState.desired.theta = nearestAngle(chosenTheta, cameraState.theta);
    cameraState.desired.phi = chosenPhi;
    cameraState.desired.radius = focusDistance(planet, viewMode);
    if (!wasSame) cameraState.userActive = performance.now();
    setActivePlanetUI(index);
    updateViewButtons(viewMode);
    updateDossier(planet);
    updateSceneMode();
    setHintVisibility();
    if (mode === "surface") {
      cameraState.desired.phi = clamp(1.47 + Math.sin(index) * 0.06, 0.3, PI - 0.3);
      cameraState.desired.radius = focusDistance(planet, "surface");
    }
    updateBackdropMood();
    if (beltGroup) beltGroup.visible = false;
  }

  function updateBackdropMood() {
    if (!galaxyBackdropEl) return;
    if (!selected) {
      galaxyBackdropEl.style.opacity = "0.92";
      galaxyBackdropEl.style.filter = "saturate(1.06) brightness(0.82)";
    } else if (viewMode === "surface") {
      galaxyBackdropEl.style.opacity = "0.42";
      galaxyBackdropEl.style.filter = "saturate(0.9) brightness(0.62)";
    } else {
      galaxyBackdropEl.style.opacity = "0.62";
      galaxyBackdropEl.style.filter = "saturate(0.98) brightness(0.7)";
    }
  }

  function updateSceneMode() {
    const sm = $("#sceneMode");
    const ss = $("#sceneScale");
    if (!selected) {
      sm.textContent = "SYSTEM OVERVIEW · 太阳系全景";
      ss.textContent = "ORBIT SCALE · VISUAL COMPRESSION";
    } else if (viewMode === "surface") {
      sm.textContent = "LOW ORBIT · " + selected.data.en + " 近地掠行";
      ss.textContent = "VIEW · SURFACE APPROACH";
    } else {
      sm.textContent = "PLANETARY APPROACH · " + selected.data.en;
      ss.textContent = "TRACKING · " + selected.data.distance.toFixed(2) + " AU";
    }
  }

  function setHintVisibility() {
    $("#viewHint").style.opacity = selected ? "0" : "";
  }

  function cyclePlanet(dir) {
    if (!planets.length) return;
    let next;
    if (selected) next = (selected.index + dir + planets.length) % planets.length;
    else next = dir > 0 ? 0 : planets.length - 1;
    setPlanet(next, "focus");
  }

  function setActivePlanetUI(index) {
    $$(".index-item").forEach((el, i) => el.classList.toggle("active", i === index));
    $$(".planet-tag").forEach((el, i) => el.classList.toggle("active", i === index));
    if (index == null) {
      $$(".index-item").forEach((el) => el.classList.remove("active"));
    }
  }

  function updateViewButtons(mode) {
    const normalized = mode === "focus" ? "planet" : mode;
    $$(".view-switch button").forEach((b) => {
      b.classList.toggle("active", b.dataset.view === normalized);
    });
  }

  /* ---------------------------------------------------------
     dossier
     --------------------------------------------------------- */

  const dossier = $("#dossier");
  const orbSphere = $("#orbSphere");
  const orbHalo = $("#orbHalo");
  let sunPreview = null;
  let panelRect = null;

  function statMarkup(stats) {
    return stats
      .map(
        (s) => `
        <div class="stat-cell">
          <span class="stat-label">${s.label}</span>
          <span class="stat-value">${s.value}<em>${s.unit || ""}</em></span>
        </div>`
      )
      .join("");
  }

  function highlightMarkup(items) {
    return items
      .map(
        (h, i) => `
        <div class="highlight">
          <span class="highlight-num">${String(i + 1).padStart(2, "0")}</span>
          <span class="highlight-name">${h.name}</span>
          <span class="highlight-value">${h.value}</span>
        </div>`
      )
      .join("");
  }

  function updateDossier(planet) {
    const data = planet ? planet.data : SYSTEM;
    dossier.classList.add("switching");
    document.body.classList.remove("is-focused");
    if (planet) document.body.classList.add("is-focused");
    document.documentElement.style.setProperty("--accent", data.accent);
    document.documentElement.style.setProperty("--accent-rgb", data.accentRgb);
    dossier.style.setProperty("--accent", data.accent);
    dossier.style.setProperty("--accent-rgb", data.accentRgb);
    $("#dossierGlow").style.background = `radial-gradient(circle, rgba(${data.accentRgb}, 0.17), transparent 68%)`;

    $("#objectCode").textContent = planet ? `OBJECT ${String(planet.index + 1).padStart(2, "0")} / 08` : SYSTEM.code;
    $("#objectType").textContent = data.type;
    $("#planetEn").textContent = data.en;
    $("#planetName").textContent = data.zh;
    $("#planetTagline").textContent = data.tagline;
    $("#planetDesc").textContent = data.desc;
    $("#statGrid").innerHTML = statMarkup(data.stats);
    $("#distanceValue").textContent = data.distance.toFixed(2) + " AU";
    $("#distanceBar").style.width = `${clamp((data.distance / 30.05) * 100, 1.5, 100)}%`;
    $("#distanceMarker").style.left = `${clamp((data.distance / 30.05) * 100, 1.5, 100)}%`;

    const domainMin = -230;
    const domainMax = 480;
    const rangeLeft = clamp(((data.tempMin - domainMin) / (domainMax - domainMin)) * 100, 0, 100);
    const rangeRight = clamp(((data.tempMax - domainMin) / (domainMax - domainMin)) * 100, 0, 100);
    const rangeMid = (rangeLeft + rangeRight) / 2;
    $("#tempRange").style.left = `${rangeLeft}%`;
    $("#tempRange").style.width = `${Math.max(1.5, rangeRight - rangeLeft)}%`;
    $("#tempMarker").style.left = `${rangeMid}%`;
    $("#tempValue").textContent = data.tempLabel;
    $("#highlights").innerHTML = highlightMarkup(data.highlights);
    $("#planetFact").textContent = data.fact;

    if (planet) {
      orbSphere.style.backgroundImage = `url("${planet.preview}")`;
      orbSphere.style.background = `url("${planet.preview}") center / 210% 100%`;
      orbSphere.style.backgroundColor = "#09111d";
      orbHalo.style.background = `radial-gradient(circle, rgba(${data.accentRgb}, 0.28), transparent 66%)`;
    } else {
      sunPreview = sunPreview || makeSunPreview();
      orbSphere.style.background = `url("${sunPreview}") center / 100% 100%`;
      orbSphere.style.backgroundColor = "#1a0b02";
      orbHalo.style.background = "radial-gradient(circle, rgba(242, 195, 132, 0.32), transparent 66%)";
    }

    dossier.classList.toggle("system-view", !planet);
    document.body.classList.toggle("system-view", !planet);
    $("#focusActionLabel").textContent = !planet ? "启程 · 水星" : viewMode === "surface" ? "返回轨道" : "近地掠行";
    $("#nextPlanet").textContent = !planet ? "自动巡游" : "下一站";

    $("#liveOrbit").style.display = planet ? "" : "none";
    if (planet) {
      updateOrbitReadout(planet);
    }

    window.setTimeout(() => dossier.classList.remove("switching"), 560);
    dossier.scrollTop = 0;
    panelRect = null;
    if (planet) {
      showConnector();
    } else {
      hideConnector();
    }
  }

  function updateOrbitReadout(planet) {
    const deg = ((planet.angle / TAU) * 360 + 360) % 360;
    $("#orbitPhase").textContent = deg.toFixed(1).padStart(5, "0") + "°";
    const cx = 66, cy = 29, rx = 55, ry = 17;
    const x = cx + Math.cos(planet.angle) * rx;
    const y = cy + Math.sin(planet.angle) * ry;
    const dot = $("#orbitDot");
    dot.setAttribute("cx", x.toFixed(2));
    dot.setAttribute("cy", y.toFixed(2));
    $("#orbitVector").setAttribute("d", `M${cx} ${cy} L${x.toFixed(2)} ${y.toFixed(2)}`);
  }

  function showConnector() {
    if (isMobile()) return;
    $("#connector").classList.add("visible");
    panelRect = null;
  }

  function hideConnector() {
    $("#connector").classList.remove("visible");
  }

  /* ---------------------------------------------------------
     UI build
     --------------------------------------------------------- */

  function buildUI() {
    const indexList = $("#indexList");
    indexList.innerHTML = PLANETS.map(
      (p, i) => `
      <button class="index-item" data-index="${i}" style="--accent:${p.accent};--accent-rgb:${p.accentRgb}" aria-label="观测${p.zh}">
        <span class="index-num">${String(i + 1).padStart(2, "0")}</span>
        <span class="index-name"><span class="index-zh">${p.zh}</span><span class="index-en">${p.en}</span></span>
        <span class="index-dot"></span>
      </button>`
    ).join("");

    const tags = $("#planetTags");
    tags.innerHTML = PLANETS.map(
      (p, i) => `
      <div class="planet-tag" data-index="${i}" style="--tag-color:${p.accent};--tag-rgb:${p.accentRgb}">
        <span class="planet-tag-dot"></span>
        <span class="planet-tag-name">${p.zh}</span>
        <span class="planet-tag-en">${p.en}</span>
        <span class="planet-tag-au">${p.distance.toFixed(2)} AU</span>
      </div>`
    ).join("");

    $$(".index-item").forEach((el) => {
      el.addEventListener("click", () => {
        const i = Number(el.dataset.index);
        if (selected && selected.index === i) {
          setPlanet(i, viewMode === "surface" ? "focus" : "surface");
        } else {
          setPlanet(i, "focus");
        }
      });
    });

    $("#brandHome").addEventListener("click", () => setOverview());
    $("#closeDossier").addEventListener("click", () => setOverview());
    $("#nextPlanet").addEventListener("click", () => {
      if (!selected) {
        toggleTour(true);
      } else {
        cyclePlanet(1);
      }
    });
    $("#focusAction").addEventListener("click", () => {
      if (!selected) {
        setPlanet(0, "focus");
      } else if (viewMode === "surface") {
        setPlanet(selected.index, "focus");
      } else {
        setPlanet(selected.index, "surface");
      }
    });

    $$(".view-switch button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = btn.dataset.view;
        if (v === "overview") setOverview();
        else if (v === "planet") {
          if (!selected) setPlanet(2, "focus");
          else setPlanet(selected.index, "focus");
        } else {
          if (!selected) setPlanet(2, "focus");
          setPlanet(selected.index, "surface");
        }
      });
    });

    $("#tourBtn").addEventListener("click", () => toggleTour());
    $("#labelsBtn").addEventListener("click", () => toggleLabels());
    $("#immersiveBtn").addEventListener("click", () => toggleImmersive(true));
    $("#uiReveal").addEventListener("click", () => toggleImmersive(false));

    const speed = $("#speedRange");
    speed.addEventListener("input", () => setTimeScale(parseFloat(speed.value)));
    $("#speedDown").addEventListener("click", () => setTimeScale(timeScale - 0.25));
    $("#speedUp").addEventListener("click", () => setTimeScale(timeScale + 0.25));

    $("#soundToggle").addEventListener("click", toggleSound);

    window.addEventListener("resize", () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      panelRect = null;
    });

    updateDossier(null);
    updateViewButtons("overview");
  }

  function setTimeScale(v) {
    timeScale = clamp(v, 0, 4);
    $("#speedRange").value = timeScale.toFixed(1);
    $("#speedValue").textContent = "×" + timeScale.toFixed(1);
    $("#speedRange").setAttribute("aria-valuetext", "时间流速 " + timeScale.toFixed(1) + " 倍");
  }

  function toggleLabels() {
    labelsOn = !labelsOn;
    document.body.classList.toggle("labels-off", !labelsOn);
    $("#labelsBtn").classList.toggle("active", labelsOn);
    $("#labelsBtn").setAttribute("aria-pressed", labelsOn ? "true" : "false");
  }

  function toggleImmersive(on) {
    document.body.classList.toggle("immersive", on);
    $("#uiReveal").setAttribute("aria-hidden", on ? "false" : "true");
  }

  function toggleTour(force) {
    cameraState.autoTour = typeof force === "boolean" ? force : !cameraState.autoTour;
    tourClock = 0;
    syncTourUI();
    if (cameraState.autoTour && !selected) {
      tourIndex = 0;
      setPlanet(0, "focus", { keepTour: true });
    }
  }

  function syncTourUI() {
    $("#tourBtn").classList.toggle("active", cameraState.autoTour);
    $("#tourBtn").setAttribute("aria-pressed", cameraState.autoTour ? "true" : "false");
  }

  /* ---------------------------------------------------------
     ambient audio
     --------------------------------------------------------- */

  let audioCtx, audioMaster, audioNodes;

  function toggleSound() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioMaster = audioCtx.createGain();
        audioMaster.gain.value = 0;
        const filter = audioCtx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 330;
        filter.Q.value = 2.4;
        filter.connect(audioMaster);
        audioMaster.connect(audioCtx.destination);
        audioNodes = { filter, oscs: [] };
        const freqs = [55, 82.4069, 110, 164.8138, 220.2];
        const gains = [0.22, 0.16, 0.11, 0.055, 0.025];
        freqs.forEach((f, i) => {
          const osc = audioCtx.createOscillator();
          osc.type = i < 2 ? "sine" : "triangle";
          osc.frequency.value = f;
          osc.detune.value = (i - 2) * 4;
          const g = audioCtx.createGain();
          g.gain.value = gains[i];
          osc.connect(g);
          g.connect(filter);
          osc.start();
          audioNodes.oscs.push(osc);
        });
        const lfo = audioCtx.createOscillator();
        lfo.frequency.value = 0.065;
        const lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 120;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        lfo.start();
        audioNodes.lfo = lfo;
      }
      if (audioCtx.state === "suspended") audioCtx.resume();
      audioOn = !audioOn;
      const now = audioCtx.currentTime;
      audioMaster.gain.cancelScheduledValues(now);
      audioMaster.gain.setValueAtTime(audioMaster.gain.value, now);
      audioMaster.gain.linearRampToValueAtTime(audioOn ? 0.065 : 0, now + 1.8);
      $("#soundToggle").classList.toggle("is-on", audioOn);
      $("#soundToggle").setAttribute("aria-label", audioOn ? "关闭环境音" : "开启环境音");
    } catch (e) {
      audioOn = false;
    }
  }

  /* ---------------------------------------------------------
     pointer interaction
     --------------------------------------------------------- */

  const pointers = new Map();
  let dragStart = null;
  let pinchStart = 0;
  let pinchRadius = 0;
  let moved = 0;

  function onPointerDown(e) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    if (pointers.size === 1) {
      dragStart = { x: e.clientX, y: e.clientY, time: performance.now() };
      moved = 0;
      cameraState.dragging = false;
    } else if (pointers.size === 2) {
      const pts = Array.from(pointers.values());
      pinchStart = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchRadius = cameraState.desired.radius;
      cameraState.pinch = true;
      cameraState.dragging = false;
    }
  }

  function onPointerMove(e) {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointerNdc.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointerNdc.y = -(e.clientY / window.innerHeight) * 2 + 1;

    if (pointers.has(e.pointerId)) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pointers.size === 2) {
      const pts = Array.from(pointers.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinchStart > 0) {
        const ratio = pinchStart / Math.max(10, dist);
        const limits = radiusLimits();
        cameraState.desired.radius = clamp(pinchRadius * ratio, limits.min, limits.max);
        cameraState.userActive = performance.now();
      }
      return;
    }

    if (dragStart && pointers.size === 1) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) {
        moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
        if (!cameraState.dragging) cameraState.dragging = true;
        cameraState.desired.theta -= dx * 0.0044;
        cameraState.desired.phi -= dy * 0.0044;
        cameraState.desired.phi = clamp(cameraState.desired.phi, 0.25, PI - 0.25);
        cameraState.userActive = performance.now();
        dragStart.x = e.clientX;
        dragStart.y = e.clientY;
      }
    }

    if (!cameraState.dragging) scheduleHover();
  }

  function onPointerUp(e) {
    const wasSingle = pointers.size === 1;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) {
      cameraState.pinch = false;
      pinchStart = 0;
    }
    if (wasSingle && dragStart && moved < 6 && performance.now() - dragStart.time < 500) {
      handleClick(e.clientX, e.clientY);
    }
    if (pointers.size === 0) {
      cameraState.dragging = false;
      dragStart = null;
    }
  }

  function onPointerCancel(e) {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      dragStart = null;
      cameraState.dragging = false;
    }
    cameraState.pinch = false;
  }

  let hoverRaf = 0;
  function scheduleHover() {
    if (hoverRaf) return;
    hoverRaf = requestAnimationFrame(() => {
      hoverRaf = 0;
      if (cameraState.dragging) return;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(clickables.concat([sunMesh]), false);
      let idx = -1;
      if (hits.length) {
        if (hits[0].object.userData.isSun) idx = -2;
        else idx = hits[0].object.userData.planetIndex;
      }
      if (idx !== hoveredIndex) {
        hoveredIndex = idx;
        canvas.style.cursor = idx !== -1 ? "pointer" : "crosshair";
        $$(".planet-tag").forEach((el, i) => {
          el.style.filter = i === idx ? "brightness(1.28)" : "";
        });
      }
    });
  }

  function handleClick(x, y) {
    pointerNdc.x = (x / window.innerWidth) * 2 - 1;
    pointerNdc.y = -(y / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(clickables.concat([sunMesh]), false);
    if (!hits.length) return;
    const obj = hits[0].object;
    if (obj.userData.isSun) {
      setOverview();
    } else {
      const i = obj.userData.planetIndex;
      if (selected && selected.index === i) {
        setPlanet(i, viewMode === "surface" ? "focus" : "surface");
      } else {
        setPlanet(i, "focus");
      }
    }
  }

  function radiusLimits() {
    if (!selected || viewMode === "overview") return { min: 92, max: 260 };
    const r = selected.data.radius;
    if (viewMode === "surface") return { min: r * 2.35, max: r * 7.0 };
    return { min: r * 3.2, max: Math.max(45, r * 19) };
  }

  function onWheel(e) {
    e.preventDefault();
    const limits = radiusLimits();
    const factor = Math.exp(clamp(e.deltaY, -180, 180) * 0.0013);
    const base = clamp(cameraState.desired.radius * factor, limits.min, limits.max);
    cameraState.desired.radius = base;
    if (selected && viewMode === "focus" && base < selected.data.radius * 5.2) {
      // roll into surface mode gracefully
      viewMode = "surface";
      updateViewButtons("surface");
      updateSceneMode();
      updateBackdropMood();
      $("#focusActionLabel").textContent = "返回轨道";
    }
    cameraState.userActive = performance.now();
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("pointerleave", (e) => {
    if (pointers.size) return;
    pointerNdc.set(-2, -2);
    canvas.style.cursor = "crosshair";
  });
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  document.addEventListener("keydown", (e) => {
    if (e.target && /input|textarea/i.test(e.target.tagName)) return;
    if (!bootDone) {
      if (welcomeReady && (e.code === "Enter" || e.code === "Space")) {
        e.preventDefault();
        enterExperience(false);
      }
      return;
    }
    if (e.code === "ArrowRight") {
      e.preventDefault();
      cyclePlanet(1);
    } else if (e.code === "ArrowLeft") {
      e.preventDefault();
      cyclePlanet(-1);
    } else if (e.code === "Escape") {
      if (document.body.classList.contains("immersive")) toggleImmersive(false);
      else setOverview();
    } else if (e.code === "Space") {
      e.preventDefault();
      toggleTour();
    } else if (e.key === "h" || e.key === "H") {
      toggleImmersive(!document.body.classList.contains("immersive"));
    } else if (e.key === "l" || e.key === "L") {
      toggleLabels();
    } else if (/^[1-8]$/.test(e.key)) {
      setPlanet(Number(e.key) - 1, "focus");
    }
  });

  /* ---------------------------------------------------------
     labels, connector, clock
     --------------------------------------------------------- */

  const tmpProj = new T.Vector3();
  const tmpCamDir = new T.Vector3();

  function updateLabels() {
    if (!labelsOn || selected) {
      $$(".planet-tag").forEach((el) => el.classList.remove("visible"));
      return;
    }
    camera.getWorldDirection(tmpCamDir);
    planets.forEach((p, i) => {
      const el = p.tagEl;
      if (!el) return;
      p.group.getWorldPosition(tmpProj);
      const world = tmpProj.clone();
      tmpProj.project(camera);
      const dx = world.x - camera.position.x;
      const dy = world.y - camera.position.y;
      const dz = world.z - camera.position.z;
      const front = dx * tmpCamDir.x + dy * tmpCamDir.y + dz * tmpCamDir.z > 0;
      const visible = front && tmpProj.z < 1 && Math.abs(tmpProj.x) < 1.3 && Math.abs(tmpProj.y) < 1.3;
      if (!visible) {
        el.classList.remove("visible");
        return;
      }
      const sx = (tmpProj.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-tmpProj.y * 0.5 + 0.5) * window.innerHeight;
      const offset = 22 + (p.data.radius / Math.max(10, camera.position.distanceTo(world))) * 300;
      el.style.transform = `translate3d(${(sx + offset).toFixed(1)}px, ${(sy - 14).toFixed(1)}px, 0)`;
      el.classList.add("visible");
    });
  }

  function updateConnector() {
    if (!selected || isMobile() || viewMode === "overview") {
      hideConnector();
      return;
    }
    const el = $("#connector");
    if (!el.classList.contains("visible")) showConnector();
    if (!panelRect) panelRect = dossier.getBoundingClientRect();
    selected.group.getWorldPosition(tmpProj);
    tmpProj.project(camera);
    if (tmpProj.z > 1) return;
    const x = (tmpProj.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-tmpProj.y * 0.5 + 0.5) * window.innerHeight;
    const ex = panelRect.left;
    const ey = panelRect.top + 150;
    const dx = ex - x;
    const midX = x + dx * 0.38;
    const path = `M ${x.toFixed(1)} ${y.toFixed(1)} C ${midX.toFixed(1)} ${y.toFixed(1)}, ${(ex - 78).toFixed(1)} ${ey.toFixed(1)}, ${ex.toFixed(1)} ${ey.toFixed(1)}`;
    $("#connectorPath").setAttribute("d", path);
    const dot = $("#connectorDot");
    dot.setAttribute("cx", x.toFixed(1));
    dot.setAttribute("cy", y.toFixed(1));
  }

  function updateClock() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    $("#localDate").textContent = `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
    $("#localTime").textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  setInterval(updateClock, 1000);
  updateClock();

  /* ---------------------------------------------------------
     animation loop
     --------------------------------------------------------- */

  let labelTick = 0;
  let readoutTick = 0;

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.1, (now - lastFrame) / 1000 || 0.016);
    lastFrame = now;
    const time = now * 0.001;

    const activeTime = timeScale > 0 ? dt * timeScale : 0;
    orbitElapsed += activeTime;

    if (!document.hidden) {
      // orbital motion
      planets.forEach((p, i) => {
        p.angle = p.data.initialAngle + orbitElapsed * p.data.orbitSpeed;
        p.group.position.set(Math.cos(p.angle) * p.data.orbit, 0, Math.sin(p.angle) * p.data.orbit);
        p.mesh.rotation.y = p.spinSeed + orbitElapsed * p.data.spin;
        if (p.clouds) p.clouds.rotation.y = p.spinSeed + orbitElapsed * (p.data.spin * 1.16) + 0.4;
        p.moonPivots.forEach((m) => {
          m.pivot.rotation.y = m.initial + orbitElapsed * m.speed;
        });
        const isSel = selected === p;
        const targetOpacity = isSel ? 0.42 : cameraState.welcome ? 0.24 : 0.13;
        p.line.material.opacity = damp(p.line.material.opacity, targetOpacity, 4, dt);
        p.line.material.color.lerp(new T.Color(isSel ? p.data.accent : "#93b4dd"), 0.04);
        if (p.ringMesh) p.ringMesh.rotation.z += dt * 0.0008;
      });

      if (beltGroup) beltGroup.rotation.y = orbitElapsed * 0.013;
      updateComet(time, dt);

      // camera drift
      const idle = performance.now() - cameraState.userActive > 3800 && !cameraState.dragging && !cameraState.pinch;
      if (idle) {
        const drift = selected && viewMode !== "overview" ? selected.data.drift : 0.0045;
        cameraState.desired.theta += drift * dt;
      }

      // auto tour
      if (cameraState.autoTour) {
        tourClock += dt;
        if (tourClock > 9.0) {
          tourClock = 0;
          tourIndex = (tourIndex + 1) % planets.length;
          setPlanet(tourIndex, "focus", { keepTour: true });
        }
      }

      // camera easing
      const ideal = cameraIdeal();
      const posL = 1 - Math.exp(-dt * (selected ? 4.7 : 3.6));
      const lookL = 1 - Math.exp(-dt * 6.3);
      camera.position.lerp(ideal.pos, posL);
      cameraState.look.lerp(ideal.look, lookL);
      camera.lookAt(cameraState.look);

      // sun animation
      if (sunUniforms) sunUniforms.uTime.value = time;
      if (sunMesh) sunMesh.rotation.y = time * 0.006;
      if (coronaA) {
        const pulse = 1 + Math.sin(time * 1.2) * 0.018 + Math.sin(time * 0.47) * 0.03;
        coronaA.scale.set(28 * pulse, 28 * pulse, 1);
        coronaB.scale.set(62 * (2 - pulse), 62 * (2 - pulse), 1);
        coronaC.scale.set(118 * (1 + (pulse - 1) * 0.55), 118 * (1 + (pulse - 1) * 0.55), 1);
      }
      if (sunFlare) sunFlare.material.rotation = 0.2 + Math.sin(time * 0.08) * 0.08;
      if (sunGroup.children) {
        sunGroup.children.forEach((c) => {
          if (c.userData.isFlare) {
            c.lookAt(camera.position);
            c.rotation.z += 0.0007;
          }
        });
      }
      if (galaxyUniforms) galaxyUniforms.uTime.value = time;
      if (starUniforms) starUniforms.uTime.value = time;
      if (galaxySpin) galaxySpin.rotation.y = time * 0.0038;
      if (starPoints) starPoints.rotation.y = time * 0.0012;

      // subtle pointer parallax on the background
      if (galaxyPivot) {
        const mx = (pointer.x / window.innerWidth - 0.5) * 0.02;
        const my = (pointer.y / window.innerHeight - 0.5) * 0.014;
        galaxyPivot.rotation.z = damp(galaxyPivot.rotation.z, 0.22 + mx, 1.5, dt);
        galaxyPivot.rotation.x = damp(galaxyPivot.rotation.x, 1.04 + my, 1.5, dt);
      }

      if (galaxyBackdropEl) {
        const px = clamp(pointer.x / window.innerWidth, 0, 1) - 0.5;
        const py = clamp(pointer.y / window.innerHeight, 0, 1) - 0.5;
        const targetX = px * -22 + Math.sin(cameraState.theta) * 7;
        const targetY = py * -14;
        const targetScale = selected ? 1.052 : 1.024;
        backdropMotion.x = damp(backdropMotion.x, targetX, 2.1, dt);
        backdropMotion.y = damp(backdropMotion.y, targetY, 2.1, dt);
        backdropMotion.scale = damp(backdropMotion.scale, targetScale, 2.0, dt);
        galaxyBackdropEl.style.transform =
          `translate3d(${backdropMotion.x.toFixed(2)}px, ${backdropMotion.y.toFixed(2)}px, 0) scale(${backdropMotion.scale.toFixed(4)})`;
      }

      // ui refresh
      labelTick += dt;
      if (labelTick > 0.033) {
        labelTick = 0;
        updateLabels();
        updateConnector();
      }
      readoutTick += dt;
      if (readoutTick > 0.1 && selected) {
        readoutTick = 0;
        updateOrbitReadout(selected);
      }

      renderer.render(scene, camera);
    }
  }

  /* ---------------------------------------------------------
     comet update
     --------------------------------------------------------- */

  function updateComet(time, dt) {
    if (!comet) return;
    const a = 54;
    const b = 40;
    const speed = 0.032;
    const ang = time * speed + 1.4;
    const x = Math.cos(ang) * a;
    const z = Math.sin(ang) * b;
    const y = Math.sin(ang * 2) * 2.4;
    comet.position.set(x, y, z);
    cometHead.scale.setScalar(2.6 + Math.sin(time * 3.1) * 0.25);
    cometOrbitLine.rotation.z = 0.14;

    const outward = new T.Vector3(x, y, z).normalize();
    const tangent = new T.Vector3(-Math.sin(ang) * a, 0, Math.cos(ang) * b).normalize();
    const count = cometTrailPos.length / 3;
    for (let i = 0; i < count; i++) {
      const f = i / (count - 1);
      const spread = f * 8.5;
      const wobble = Math.sin(time * 1.8 + i * 0.9) * f * 0.35;
      const px = x + outward.x * spread * (1.4 + f) + tangent.x * wobble;
      const py = y + outward.y * spread + Math.sin(i * 1.7 + time) * f * 0.18;
      const pz = z + outward.z * spread * (1.4 + f) + tangent.z * wobble;
      cometTrailPos[i * 3] = px;
      cometTrailPos[i * 3 + 1] = py;
      cometTrailPos[i * 3 + 2] = pz;
    }
    cometTail.geometry.attributes.position.needsUpdate = true;
  }

  /* ---------------------------------------------------------
     init
     --------------------------------------------------------- */

  async function init() {
    setLoad(4, "绘制银河背景");
    buildGalaxyBackdrop();
    const assets = window.CLOVE_TEXTURES || {};
    if (assets.sun) {
      setLoad(8, "读取恒星表面");
      sharedSunTexture = await loadTextureURL(assets.sun, renderer).catch(() => null);
    }
    buildStarfield();
    buildSun();
    buildBelt();
    buildKuiperBelt();
    buildComet();
    await waitFrame();

    setLoad(12, "载入行星影像");
    const shared = await Promise.all([
      assets.moon
        ? loadTextureURL(assets.moon, renderer).catch(() => null)
        : Promise.resolve(null),
      assets.earth_clouds
        ? loadTextureURL(assets.earth_clouds, renderer).catch(() => null)
        : Promise.resolve(null),
      assets.saturn_ring
        ? loadTextureURL(assets.saturn_ring, renderer, {
            wrapS: T.ClampToEdgeWrapping,
            wrapT: T.ClampToEdgeWrapping
          }).catch(() => null)
        : Promise.resolve(null),
      assets.earth_normal
        ? loadTextureURL(assets.earth_normal, renderer, { colorSpace: T.NoColorSpace }).catch(() => null)
        : Promise.resolve(null),
      assets.earth_roughness
        ? loadTextureURL(assets.earth_roughness, renderer, { colorSpace: T.NoColorSpace }).catch(() => null)
        : Promise.resolve(null)
    ]);
    sharedMoonTexture = shared[0];
    sharedCloudTexture = shared[1];
    sharedRingTexture = shared[2];
    sharedEarthNormal = shared[3];
    sharedEarthRoughness = shared[4];

    setLoad(20, "载入行星影像");
    for (let i = 0; i < PLANETS.length; i++) {
      const def = PLANETS[i];
      const texInfo = await loadPlanetTexture(def, renderer);
      const planet = buildPlanet(def, texInfo, renderer);
      planet.tagEl = $(`.planet-tag[data-index="${i}"]`);
      setLoad(20 + ((i + 1) / PLANETS.length) * 64, `载入 ${def.zh} 影像`);
      if (i % 2 === 0) await waitFrame();
    }

    buildUI();
    planets.forEach((planet, i) => {
      planet.tagEl = $(`.planet-tag[data-index="${i}"]`);
    });
    setLoad(92, "校准观测坐标");
    await waitFrame();

    // initial camera pose
    camera.position.set(
      Math.sin(cameraState.phi) * cameraState.radius * Math.sin(cameraState.theta),
      Math.cos(cameraState.phi) * cameraState.radius,
      Math.sin(cameraState.phi) * cameraState.radius * Math.cos(cameraState.theta)
    );
    cameraState.look.set(0, 0, 0);
    camera.lookAt(cameraState.look);
    cameraState.target.copy(cameraState.look);

    setLoad(100, "观测准备就绪");
    await new Promise((r) => setTimeout(r, 450));

    // keep a wide establishing shot behind the welcome overlay
    setOverview(false);
    cameraState.welcome = true;
    cameraState.desired.theta = 0.58;
    cameraState.desired.phi = 0.97;
    cameraState.desired.radius = isMobile() ? 252 : 212;
    cameraState.userActive = performance.now();
    readyWelcome();

    requestAnimationFrame((t) => {
      lastFrame = t;
      animate(t);
    });
  }

  // expose a tiny debug surface for QA, not used by the UI
  window.__CLOVE__ = {
    get planets() {
      return planets;
    },
    get selected() {
      return selected;
    },
    get camera() {
      return camera;
    },
    select: (i, mode) => setPlanet(i, mode || "focus"),
    overview: () => setOverview()
  };

  init().catch((err) => {
    console.error(err);
    $("#bootStatusLabel").textContent = "星系构建中断";
    bootPct.textContent = "ERR";
  });
})();
