// =====================================================================
//  SİTEYİ YIK! — OYUN KODU (v2)
//  Bölümler:
//   A) Tuval ve fare     B) Harita (platformlar)    C) Kontroller
//   D) Fizik             E) Silahlar                F) Yıkım
//      F1: Harfleri tek tek koparma
//      F2: Patlama krateri (piksel delik)
//      F3: Kutuları/resimleri parçalama
//   G) Çizim (piksel karakter, efektler)            H) Oyun döngüsü
// =====================================================================
(() => {
  if (window.__DESTROY__) return;
  window.__DESTROY__ = true;

  // ---------------- A) TUVAL ----------------
  // pointer-events: none → tuval tıklamaları "yutmaz". Böylece altındaki
  // harfleri bulabiliyoruz (F1 için gerekli). Fareyi pencereden dinliyoruz.
  const cv = document.createElement('canvas');
  Object.assign(cv.style, {
    position: 'fixed', left: '0', top: '0', width: '100vw', height: '100vh',
    zIndex: '2147483647', pointerEvents: 'none',
  });
  document.documentElement.appendChild(cv);
  const style = document.createElement('style');
  style.textContent = '*{cursor:crosshair!important;user-select:none!important}';
  document.head.appendChild(style);

  // Geç yüklenen (lazy) resimleri hemen yükle
  for (const im of document.querySelectorAll('img[data-src],img[data-srcset],source[data-srcset]')) {
    if (im.dataset.src) im.src = im.dataset.src;
    if (im.dataset.srcset) im.srcset = im.dataset.srcset;
  }

  const ctx = cv.getContext('2d');
  let W = 0, H = 0;
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false; // piksel görünüm bulanıklaşmasın
  }
  resize();
  addEventListener('resize', () => { resize(); scan(); });

  const docW = () => Math.max(document.documentElement.scrollWidth, W);
  const docH = () => Math.max(document.documentElement.scrollHeight, H);
  const rand = (a, b) => a + Math.random() * (b - a);

  // ---------------- B) HARİTA ----------------
  const SELECTOR = 'h1,h2,h3,h4,h5,h6,p,a,button,img,svg,video,input,textarea,select,li,td,th,label,figure,pre,blockquote,iframe,span,nav,header,footer,form,div,section,article,aside,table';
  const MEDIA = /^(IMG|SVG|VIDEO|BUTTON|INPUT|TEXTAREA|SELECT|IFRAME|CANVAS|PICTURE)$/i;
  let blocks = [];

  // "solid" = kırılınca parçalanan şey (resim, buton, renkli kutu).
  // Yazı blokları kırılmaz; onların HARFLERİ tek tek kopar.
  function classify(el) {
    if (MEDIA.test(el.tagName)) return 'solid';
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor;
    const hasBg = (bg && bg !== 'transparent' && !/,\s*0\)$/.test(bg)) || cs.backgroundImage !== 'none';
    const hasBorder = parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none';
    if (hasBg || hasBorder) return 'solid';
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return 'text';
    return /^(DIV|SECTION|ARTICLE|ASIDE|NAV|HEADER|FOOTER|FORM|TABLE|FIGURE)$/.test(el.tagName) ? null : 'text';
  }

  function scan() {
    const sx = scrollX, sy = scrollY;
    const old = new Map(blocks.map(b => [b.el, b]));
    const list = [];
    for (const el of document.querySelectorAll(SELECTOR)) {
      if (el === cv || el.__dead || el.classList.contains('__dl')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 12 || r.height < 8) continue;
      if (r.width > docW() * 0.98 && r.height > H * 0.8) continue;
      const prev = old.get(el);
      const kind = prev ? prev.kind : classify(el);
      if (!kind) continue;
      const area = r.width * r.height;
      list.push({
        el, kind, x: r.left + sx, y: r.top + sy, w: r.width, h: r.height, area,
        hp: prev ? prev.hp : Math.min(40, Math.max(2, Math.round(area / 3000))), // büyük kutu = daha dayanıklı
        shake: prev ? prev.shake : 0,
      });
      if (list.length > 3500) break;
    }
    blocks = list;
  }
  scan();
  setTimeout(scan, 600);
  setInterval(scan, 1000);

  function blockAt(x, y) {
    let best = null;
    for (const b of blocks) {
      if (b.el.__dead) continue;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        if (!best || b.area < best.area) best = b;
      }
    }
    return best;
  }

  // ---------------- C) KONTROLLER ----------------
  // Hem WASD hem YÖN TUŞLARI çalışır.
  const keys = {};
  const mouse = { x: W / 2, y: H / 2, down: false };
  let weapon = 1, running = true;

  addEventListener('keydown', e => {
    if (!running) return;
    const k = e.key.toLowerCase();
    keys[k] = true;
    if (['1', '2', '3', '4', '5', '6'].includes(k)) weapon = +k;
    if (k === 'escape') quit();
    if (k === 'r' && P.dead) restart();
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  }, true);
  addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; }, true);
  addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; }, true);
  addEventListener('mousedown', e => {
    if (!running || e.button !== 0) return;
    mouse.down = true; e.preventDefault(); e.stopPropagation();
  }, true);
  addEventListener('mouseup', () => { mouse.down = false; }, true);
  // Linklere tıklayınca sayfa değişmesin
  addEventListener('click', e => { if (running) { e.preventDefault(); e.stopPropagation(); } }, true);

  const left = () => keys.a || keys.arrowleft;
  const right = () => keys.d || keys.arrowright;
  const jump = () => keys.w || keys.arrowup || keys[' '];
  const down = () => keys.s || keys.arrowdown;
  const jet = () => keys.shift;

  // ---------------- D) FİZİK ----------------
  const GRAVITY = 1800, SPEED = 280, JUMP = 680;
  const P = { x: scrollX + W / 2, y: scrollY + 80, vx: 0, vy: 0, onGround: false, face: 1, walk: 0, fuel: 100, jumpHeld: false, flying: false, kick: 0, hp: 5, inv: 0, dead: false };

  // x konumundaki biri prevY→newY düşerken hangi platforma basar? (oyuncu + düşmanlar)
  function landOn(x, prevY, newY) {
    let floor = null;
    for (const b of blocks) {
      if (b.el.__dead) continue;
      if (x < b.x - 4 || x > b.x + b.w + 4) continue;
      if (prevY <= b.y + 1 && newY >= b.y && (floor === null || b.y < floor)) floor = b.y;
    }
    return floor;
  }

  function updatePlayer(dt) {
    if (P.inv > 0) P.inv -= dt;
    const dir = P.dead ? 0 : (right() ? 1 : 0) - (left() ? 1 : 0);
    P.vx += (dir * SPEED - P.vx) * Math.min(1, dt * 18); // yumuşak hızlanma
    if (dir) P.face = dir;

    if (!P.dead && jump() && P.onGround && !P.jumpHeld) { P.vy = -JUMP; P.onGround = false; }
    P.jumpHeld = jump();

    P.flying = false;
    if (!P.dead && jet() && P.fuel > 0) {
      P.vy -= 2900 * dt; P.fuel -= 45 * dt; P.flying = true;
      if (P.vy < -420) P.vy = -420;
      if (Math.random() < 0.6) pixel(P.x - P.face * 10, P.y - 14, rand(-40, 40), rand(150, 300), Math.random() < .5 ? '#ffb000' : '#ff5a00', .3, 4);
    } else if (P.onGround) P.fuel = Math.min(100, P.fuel + 30 * dt);

    P.vy = Math.min(1400, P.vy + GRAVITY * dt);
    const prevY = P.y;
    P.x = Math.max(12, Math.min(docW() - 12, P.x + P.vx * dt));
    P.y += P.vy * dt;

    P.onGround = false;
    if (P.vy >= 0 && !down()) {
      const f = landOn(P.x, prevY, P.y);
      if (f !== null) { P.y = f; P.vy = 0; P.onGround = true; }
    }
    if (P.y >= docH()) { P.y = docH(); P.vy = 0; P.onGround = true; }
    if (P.y < 60) { P.y = 60; P.vy = 0; }
    if (P.onGround && Math.abs(P.vx) > 20) P.walk += dt * 10;
    if (P.kick > 0) P.kick -= dt;
  }

  function updateCamera() {
    const sx = P.x - scrollX, sy = P.y - scrollY;
    let tx = scrollX, ty = scrollY;
    if (sy > H * 0.75) ty += (sy - H * 0.75) * 0.2;
    if (sy < H * 0.3) ty -= (H * 0.3 - sy) * 0.2;
    if (sx > W * 0.8) tx += (sx - W * 0.8) * 0.2;
    if (sx < W * 0.2) tx -= (W * 0.2 - sx) * 0.2;
    if (tx !== scrollX || ty !== scrollY) scrollTo(tx, ty);
  }

  // ---------------- E) SİLAHLAR ----------------
  const shots = [], particles = [], debris = [], decals = [];
  let cooldown = 0, score = 0, shakeT = 0;
  const WEAPONS = {
    1: { name: 'Tabanca', rate: 0.1 }, 2: { name: 'Bomba', rate: 0.45 }, 3: { name: 'Roket', rate: 0.65 },
    4: { name: 'Pompalı', rate: 0.55 }, 5: { name: 'Lazer', rate: 99 }, 6: { name: 'Kara Delik', rate: 2.5 },
  };
  const singularities = [], bombs = [];
  let laser = null, laserTick = 0;

  function aim() {
    const sx = P.x, sy = P.y - 26;
    const a = Math.atan2(mouse.y + scrollY - sy, mouse.x + scrollX - sx);
    return { sx, sy, a, x: sx + Math.cos(a) * 30, y: sy + Math.sin(a) * 30 };
  }

  function fire() {
    const t = aim(), c = Math.cos(t.a), s = Math.sin(t.a);
    P.kick = 0.08;
    if (weapon === 1) {
      shots.push({ kind: 'bullet', x: t.x, y: t.y, vx: c * 1500 + rand(-30, 30), vy: s * 1500 + rand(-30, 30), life: 1 });
      for (let i = 0; i < 3; i++) pixel(t.x, t.y, c * rand(100, 300), s * rand(100, 300), '#ffe066', .08, 3);
    } else if (weapon === 2) {
      shots.push({ kind: 'grenade', x: t.x, y: t.y, vx: c * 750 + P.vx * .5, vy: s * 750 - 120, life: 1.6, rot: 0 });
    } else if (weapon === 3) {
      shots.push({ kind: 'rocket', x: t.x, y: t.y, vx: c * 380, vy: s * 380, life: 3 });
      P.vx -= c * 120; // geri tepme
    } else if (weapon === 4) {
      // POMPALI: 8 saçma, geniş açı, kısa menzil, güçlü geri tepme
      for (let i = 0; i < 8; i++) {
        const a = t.a + rand(-.22, .22), v = rand(1100, 1450);
        shots.push({ kind: 'bullet', x: t.x, y: t.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(.25, .38) });
      }
      for (let i = 0; i < 10; i++) pixel(t.x, t.y, c * rand(150, 450) + rand(-80, 80), s * rand(150, 450) + rand(-80, 80), i % 2 ? '#fff3a0' : '#ff8c00', .12, 4);
      P.vx -= c * 260; if (!P.onGround) P.vy -= s * 220; shakeT = .1;
    } else if (weapon === 6) {
      // KARA DELİK: yavaş giden bir küre; ~1 sn sonra açılır
      shots.push({ kind: 'hole', x: t.x, y: t.y, vx: c * 320, vy: s * 320, life: .9 });
    }
  }

  // LAZER: basılı tuttukça ışın; yazıları yakar, resim/butonda durur, düşmanı eritir
  function updateLaser(dt) {
    laser = null;
    if (P.dead || weapon !== 5 || !mouse.down) return;
    laserTick -= dt;
    const tick = laserTick <= 0;
    if (tick) laserTick = .06;
    const t = aim(), c = Math.cos(t.a), s = Math.sin(t.a);
    let ex = t.x, ey = t.y;
    const pts = [];
    for (let d = 0; d < 1100; d += 6) {
      const x = t.x + c * d, y = t.y + s * d;
      ex = x; ey = y;
      const en = enemyAt(x, y);
      if (en) { if (tick) hitEnemy(en, 1, x, y); break; }
      const b = blockAt(x, y);
      if (b && MEDIA.test(b.el.tagName)) { if (tick) damage(b, 1, x, y); break; }
      if (d % 12 === 0) pts.push([x, y]);
    }
    if (tick) knockLetters(pts, t.x, t.y, .5);
    laser = { x1: t.x, y1: t.y, x2: ex, y2: ey };
    pixel(ex, ey, rand(-150, 150), rand(-200, 50), Math.random() < .5 ? '#ff4d6d' : '#fff', .25, 3);
  }

  function updateSingularities(dt) {
    for (let i = singularities.length - 1; i >= 0; i--) {
      const g = singularities[i];
      g.t -= dt; g.r = Math.min(170, g.r + dt * 180); g.tick -= dt; g.spin += dt * 6;
      if (g.tick <= 0) {
        g.tick = .12;
        // çevredeki harfleri içeri doğru kopar (negatif kuvvet = merkeze uçar)
        const pts = [];
        for (let k = 0; k < 40; k++) { const a = rand(0, 6.283), d = rand(12, g.r); pts.push([g.x + Math.cos(a) * d, g.y + Math.sin(a) * d]); }
        knockLetters(pts, g.x, g.y, -1.3);
        for (const e of enemies) if (Math.hypot(e.x - g.x, e.y - e.h / 2 - g.y) < 50) hitEnemy(e, 1, g.x, g.y);
      }
      const pull = (o, k) => {
        const dx = g.x - o.x, dy = g.y - o.y, d = Math.hypot(dx, dy) || 1;
        if (d > g.r * 1.7) return d;
        const a = k * 9000 / (d + 30);
        o.vx += dx / d * a * dt; o.vy += dy / d * a * dt - GRAVITY * dt * .8;
        return d;
      };
      for (let k = debris.length - 1; k >= 0; k--) { if (pull(debris[k], 1) < 16) debris.splice(k, 1); }
      for (const e of enemies) pull({ get x() { return e.x; }, get y() { return e.y - e.h / 2; }, set vx(v) { e.vx = v; }, get vx() { return e.vx; }, set vy(v) { e.vy = v; }, get vy() { return e.vy; } }, .5);
      for (let k = 0; k < 3; k++) {
        const a = rand(0, 6.283), d = g.r * rand(.5, 1);
        particles.push({ x: g.x + Math.cos(a) * d, y: g.y + Math.sin(a) * d, vx: -Math.sin(a) * 260 - Math.cos(a) * 160, vy: Math.cos(a) * 260 - Math.sin(a) * 160, color: k % 2 ? '#c77dff' : '#7b2cbf', life: .4, max: .4, size: 3, smoke: true });
      }
      if (g.t <= 0) { singularities.splice(i, 1); explode(g.x, g.y, 170, 9); }
    }
  }

  function updateShots(dt) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.life -= dt;
      if (s.kind === 'grenade') { s.vy += GRAVITY * .8 * dt; s.rot += dt * 10; }
      if (s.kind === 'rocket') {
        s.vx *= 1 + 2.4 * dt; s.vy *= 1 + 2.4 * dt;
        pixel(s.x, s.y, rand(-30, 30), rand(-30, 30), Math.random() < .3 ? '#ffb000' : '#9a9a9a', .5, rand(3, 6));
      }
      if (s.kind === 'hole') {
        s.x += s.vx * dt; s.y += s.vy * dt;
        pixel(s.x, s.y, rand(-40, 40), rand(-40, 40), '#9d4edd', .3, 4);
        if (s.life <= 0) { singularities.push({ x: s.x, y: s.y, t: 3.2, r: 0, tick: 0, spin: 0 }); shots.splice(i, 1); }
        continue;
      }
      const nx = s.x + s.vx * dt, ny = s.y + s.vy * dt;
      const steps = Math.max(1, Math.ceil(Math.hypot(nx - s.x, ny - s.y) / 5));
      let done = false, bounced = false;

      for (let k = 1; k <= steps && !done && !bounced; k++) {
        const px = s.x + (nx - s.x) * k / steps, py = s.y + (ny - s.y) * k / steps;
        // Önce düşman mı vurduk?
        const en = enemyAt(px, py);
        if (en) {
          if (s.kind === 'bullet') hitEnemy(en, 1, px, py); else explode(px, py, 130, 9);
          done = true; break;
        }
        // Havada uçan fırlatılmış eşyayı vurduk mu? → havada patlar
        const bi = bombs.findIndex(t => Math.hypot(t.x - px, t.y - py) < 14);
        if (bi >= 0) { const bb = bombs.splice(bi, 1)[0]; enemyExplode(bb.x, bb.y, 60, true); score += 5; done = true; break; }
        const ti = thrown.findIndex(t => Math.hypot(t.x - px, t.y - py) < 18);
        if (ti >= 0) {
          const t = thrown.splice(ti, 1)[0];
          for (let j = 0; j < 14; j++) pixel(t.x, t.y, rand(-250, 250), rand(-250, 250), j % 2 ? '#fff' : '#ffd000', .35, 4);
          score += 5; done = true; break;
        }
        const b = blockAt(px, py);
        if (!b) continue;

        if (s.kind === 'grenade') { s.vy *= -.45; s.vx *= .7; bounced = true; break; }

        // Önce: çarpılan yerde harf var mı? (kutunun içindeki yazılar da kopsun)
        if (b.kind === 'text' || b.el.querySelector('*') || b.el.textContent.trim()) {
          const n0 = knockLetters([[px, py]], px, py, 1);
          if (n0) {
            if (s.kind === 'rocket') explode(px, py, 130, 9);
            else for (let j = 0; j < 4; j++) pixel(px, py, rand(-200, 200), rand(-200, 100), '#ddd', .3, 3);
            done = true; break;
          }
        }
        if (b.kind === 'text') {
          // Yazının üstünden geçerken bir HARFE değdiyse koparır.
          // Harf aralarındaki boşluktan mermi geçip gider.
          const n = knockLetters([[px, py], [px + rand(-4, 4), py + rand(-4, 4)]], px, py, 1);
          if (n) {
            if (s.kind === 'rocket') explode(px, py, 130, 9);
            else for (let j = 0; j < 4; j++) pixel(px, py, rand(-200, 200), rand(-200, 100), '#ddd', .3, 3);
            done = true;
          }
        } else {
          if (s.kind === 'rocket') explode(px, py, 130, 9);
          else {
            decals.push({ type: 'hole', x: px, y: py, el: b.el });
            for (let j = 0; j < 5; j++) pixel(px, py, rand(-250, 250), rand(-250, 100), '#ffd34d', .2, 3);
            damage(b, 1, px, py);
          }
          done = true;
        }
      }
      if (done) { shots.splice(i, 1); continue; }
      if (!bounced) { s.x = nx; s.y = ny; }
      if (s.y > docH()) { s.y = docH(); s.vy *= -.4; s.vx *= .7; }

      if (s.life <= 0) {
        if (s.kind !== 'bullet') explode(s.x, s.y, s.kind === 'rocket' ? 130 : 110, 7);
        shots.splice(i, 1);
      }
    }
  }

  function explode(x, y, radius, power) {
    shakeT = 0.35;
    decals.push({ type: 'crater', x, y, img: makeCrater(radius * 0.55) });

    // ateş + duman pikselleri
    for (let i = 0; i < 70; i++) {
      const a = rand(0, Math.PI * 2), v = rand(50, 520);
      const c = ['#fff3a0', '#ffd000', '#ff8c00', '#ff4500', '#b22222'][i % 5];
      pixel(x, y, Math.cos(a) * v, Math.sin(a) * v, c, rand(.3, .7), rand(4, 9));
    }
    for (let i = 0; i < 25; i++) {
      pixel(x + rand(-20, 20), y + rand(-20, 20), rand(-60, 60), rand(-140, -30), ['#555', '#777', '#999'][i % 3], rand(.8, 1.4), rand(6, 12), true);
    }

    // patlama alanındaki HARFLERİ kopar
    const pts = [];
    for (let px = x - radius; px <= x + radius; px += 7)
      for (let py = y - radius; py <= y + radius; py += 7)
        if (Math.hypot(px - x, py - y) < radius * 0.85) pts.push([px, py]);
    knockLetters(pts, x, y, 2.2);

    // kutuları/resimleri hasarla
    for (const b of blocks) {
      if (b.el.__dead || b.kind !== 'solid') continue;
      const cx = Math.max(b.x, Math.min(x, b.x + b.w)), cy = Math.max(b.y, Math.min(y, b.y + b.h));
      const d = Math.hypot(cx - x, cy - y);
      if (d < radius) damage(b, Math.ceil(power * (1 - d / radius)), x, y);
    }
    for (const e of [...enemies]) {
      const d = Math.hypot(e.x - x, e.y - 24 - y);
      if (d < radius) { hitEnemy(e, Math.ceil(4 * (1 - d / radius)) + 1, x, y); e.vy -= 400; }
    }
    const pd = Math.hypot(P.x - x, P.y - 24 - y);
    if (pd < radius) {
      const f = (1 - pd / radius) * 900;
      P.vx += (P.x - x) / (pd || 1) * f; P.vy -= f * .8; P.onGround = false;
    }
  }

  function pixel(x, y, vx, vy, color, life, size, smoke) {
    if (particles.length > 1500) return;
    particles.push({ x, y, vx, vy, color, life, max: life, size, smoke });
  }

  // ---------------- F1) HARFLERİ TEK TEK KOPARMA ----------------
  // Fikir: Tarayıcıya "şu noktada hangi harf var?" diye soruyoruz
  // (caretRangeFromPoint). O harfi <span> içine alıp görünmez yapıyoruz,
  // yerine aynı yazı tipinde, aynı renkte uçan bir harf çiziyoruz.
  // Görünmez yaptığımız için satır kaymaz → sayfada harf boşlukları kalır.
  function caretAt(cx, cy) {
    if (document.caretRangeFromPoint) return document.caretRangeFromPoint(cx, cy);
    const p = document.caretPositionFromPoint && document.caretPositionFromPoint(cx, cy);
    if (!p) return null;
    const r = document.createRange(); r.setStart(p.offsetNode, p.offset); return r;
  }

  function knockLetters(worldPts, fromX, fromY, force, noScore) {
    // 1. aşama: sayfayı DEĞİŞTİRMEDEN hangi harflerin vurulduğunu topla
    const found = new Map(); // textNode → Map(offset → bilgi)
    for (const [wx, wy] of worldPts) {
      const cx = wx - scrollX, cy = wy - scrollY;
      if (cx < 0 || cy < 0 || cx > W || cy > H) continue;
      const r = caretAt(cx, cy);
      if (!r || r.startContainer.nodeType !== 3) continue;
      const node = r.startContainer, parent = node.parentElement;
      if (!parent || parent.namespaceURI !== 'http://www.w3.org/1999/xhtml' || parent.classList.contains('__dl')) continue;
      for (const off of [r.startOffset, r.startOffset - 1]) {
        if (off < 0 || off >= node.data.length || /\s/.test(node.data[off])) continue;
        const rr = document.createRange(); rr.setStart(node, off); rr.setEnd(node, off + 1);
        const rc = rr.getBoundingClientRect();
        if (cx < rc.left - 2 || cx > rc.right + 2 || cy < rc.top - 2 || cy > rc.bottom + 2) continue;
        if (!found.has(node)) found.set(node, new Map());
        found.get(node).set(off, { rc, ch: node.data[off], parent });
        break;
      }
      if (found.size > 400) break;
    }

    // 2. aşama: sondan başa doğru böl (böylece önceki konumlar bozulmaz)
    let count = 0;
    const styles = new Map();
    for (const [node, offs] of found) {
      const parent = [...offs.values()][0].parent;
      if (!styles.has(parent)) { const cs = getComputedStyle(parent); styles.set(parent, { font: cs.font, color: cs.color }); }
      const st = styles.get(parent);
      for (const off of [...offs.keys()].sort((a, b) => b - a)) {
        const { rc, ch } = offs.get(off);
        try {
          const rr = document.createRange(); rr.setStart(node, off); rr.setEnd(node, off + 1);
          const span = document.createElement('span');
          span.className = '__dl';
          span.style.visibility = 'hidden';
          rr.surroundContents(span);
        } catch { continue; }
        const x = rc.left + scrollX + rc.width / 2, y = rc.top + scrollY + rc.height / 2;
        const dx = x - fromX, dy = y - fromY, d = Math.hypot(dx, dy) || 1;
        const v = rand(80, 260) * force;
        if (debris.length < 1500) debris.push({
          type: 'letter', ch, font: st.font, color: st.color, x, y, w: rc.width, h: rc.height,
          vx: dx / d * v + rand(-60, 60), vy: dy / d * v - rand(120, 280),
          rot: 0, vr: rand(-8, 8), life: rand(4, 7),
        });
        count++;
      }
    }
    if (!noScore) score += count;
    return count;
  }

  // ---------------- F2) KRATER ----------------
  // Patlama yerinde pikselli, kenarı yanık bir delik.
  // Bir kez küçük bir tuvale çizip saklıyoruz, her karede onu yapıştırıyoruz (hızlı).
  function makeCrater(r) {
    const px = 4, n = Math.ceil(r * 2 / px) + 6, c = document.createElement('canvas');
    c.width = c.height = n * px;
    const g = c.getContext('2d'), mid = n / 2;
    const wob = [...Array(16)].map(() => rand(.82, 1.05)); // kenar girintileri
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const dx = (i - mid) * px, dy = (j - mid) * px, d = Math.hypot(dx, dy);
      const ang = (Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2) * 16;
      const edge = r * wob[Math.floor(ang) % 16] * rand(.96, 1.04);
      let col = null;
      if (d < edge - px * 2) col = Math.random() < .03 ? '#3b3577' : '#1d1a4a';      // derin boşluk
      else if (d < edge - px) col = ['#ff7b00', '#ffb000', '#d9480f'][Math.floor(rand(0, 3))]; // kor
      else if (d < edge) col = Math.random() < .7 ? '#7a2e0e' : '#ffcc33';          // yanık kenar
      else if (d < edge + px * 3 && Math.random() < .25) col = ['#444', '#777', '#aaa'][Math.floor(rand(0, 3))]; // is
      if (col) { g.fillStyle = col; g.fillRect(i * px, j * px, px, px); }
    }
    return c;
  }

  // ---------------- F3) KUTU / RESİM PARÇALAMA ----------------
  function damage(b, amount, fx, fy) {
    b.hp -= amount; b.shake = .15;
    if (b.hp <= 0) destroyBlock(b, fx, fy);
  }

  function destroyBlock(b, fx, fy) {
    const el = b.el;
    if (el.__dead) return;
    el.__dead = true;
    const cs = getComputedStyle(el);
    // Parça rengi: arka plan rengi varsa o, yoksa yazı rengi
    const hasBg = cs.backgroundColor && !/,\s*0\)$/.test(cs.backgroundColor) && cs.backgroundColor !== 'transparent';
    const colors = hasBg ? [cs.backgroundColor, cs.backgroundColor, cs.borderTopColor] : [cs.color];
    const img = el.tagName === 'IMG' && el.complete && el.naturalWidth ? el : null;
    const size = Math.max(8, Math.min(22, Math.sqrt(b.area / 60)), Math.sqrt(b.area / 120));
    for (let px = b.x; px < b.x + b.w; px += size) for (let py = b.y; py < b.y + b.h; py += size) {
      if (debris.length > 1500) break;
      const w = Math.min(size, b.x + b.w - px), h = Math.min(size, b.y + b.h - py);
      const dx = px - fx, dy = py - fy, d = Math.hypot(dx, dy) || 1, v = rand(150, 500);
      debris.push({
        type: 'chunk', x: px + w / 2, y: py + h / 2, w, h,
        vx: dx / d * v + rand(-50, 50), vy: dy / d * v - rand(200, 400), rot: 0, vr: rand(-6, 6),
        life: rand(3, 4.5), color: colors[Math.floor(Math.random() * colors.length)],
        img, sx: (px - b.x) / b.w, sy: (py - b.y) / b.h, sw: w / b.w, sh: h / b.h,
      });
    }
    el.style.visibility = 'hidden';
    for (const o of blocks) if (o.el !== el && el.contains(o.el)) o.el.__dead = true;
    score += 10;
  }

  function updateEffects(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= .93; p.vy = p.smoke ? p.vy * .96 : p.vy * .93 + 300 * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.life -= dt; d.vy += GRAVITY * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt;
      const floor = docH() - d.h / 2;
      if (d.y > floor) { d.y = floor; d.vy *= -.3; d.vx *= .5; d.vr *= .5; }
      if (d.life <= 0) debris.splice(i, 1);
    }
    for (const b of blocks) if (b.shake > 0) {
      b.shake -= dt;
      b.el.style.transform = b.shake > 0 ? `translate(${rand(-3, 3)}px,${rand(-3, 3)}px) rotate(${rand(-1.5, 1.5)}deg)` : '';
    }
    if (decals.length > 300) decals.splice(0, decals.length - 300);
    if (shakeT > 0) shakeT -= dt;
  }

  // ---------------- G) ÇİZİM ----------------
  // Piksel karakter: her harf bir renk, her satır bir piksel sırası.
  const PAL = { K: '#1b1b2f', H: '#e63946', h: '#ff6b6b', S: '#f4c095', E: '#1b1b2f', J: '#ffd166', j: '#e0a800', P: '#355070', B: '#2a9d8f', b: '#1f7a70', F: '#3d2b1f' };
  const BODY = [
    '....KKKKK...',
    '...KHHHHhK..',
    '..KHHHHHHHK.',
    '..KKKKKKKKK.',
    '..KSSSSSSK..',
    '..KSSESSEK..',
    '..KSSSSSSK..',
    '...KKKKKK...',
    '.KKKJJJJJK..',
    'KBbKJJJJJJK.',
    'KBbKJjJJJJK.',
    'KBbKJjJJJJK.',
    'KBbKJJJJJK..',
    '.KKKKKKKKK..',
  ];
  const LEGS = [
    ['...KPPPPK...', '...KPKKPK...', '...KPK.KPK..', '..KFFK..KFFK', '..KKK....KKK'], // duruş
    ['...KPPPPK...', '..KPPK.KPK..', '.KPK...KPK..', 'KFFK...KFFK.', 'KKK....KKK..'], // adım 1
    ['...KPPPPK...', '...KPKKPK...', '...KPKKPK...', '...KFFKFFK..', '...KKKKKKK..'], // adım 2
  ];
  const SCALE = 3;

  function drawSprite(rows, x, y, flip, pal = PAL, sc = SCALE) {
    for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) {
      const col = pal[rows[r][c]];
      if (!col) continue;
      const cx = flip ? (rows[r].length - 1 - c) : c;
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(x + cx * sc), Math.round(y + r * sc), Math.ceil(sc), Math.ceil(sc));
    }
  }

  function drawPlayer(ox, oy) {
    const w = 12 * SCALE, rows = BODY.length + 5;
    const x = P.x - ox - w / 2, top = P.y - oy - rows * SCALE;
    const flip = P.face < 0;
    let leg = 0;
    if (!P.onGround) leg = 1;
    else if (Math.abs(P.vx) > 20) leg = 1 + (Math.floor(P.walk) % 2);
    const bob = P.onGround && leg === 2 ? SCALE : 0;
    drawSprite(BODY, x, top + bob, flip);
    drawSprite(LEGS[leg], x, top + BODY.length * SCALE, flip);

    // Silah: omuzdan fareye doğru döner
    const t = aim();
    ctx.save();
    ctx.translate(t.sx - ox, t.sy - oy);
    ctx.rotate(t.a);
    if (Math.cos(t.a) < 0) ctx.scale(1, -1); // sola nişanda ters dönmesin
    const k = P.kick > 0 ? -4 : 0;
    if (weapon === 3) {
      ctx.fillStyle = '#1b1b2f'; ctx.fillRect(k - 8, -6, 38, 12);
      ctx.fillStyle = '#4a6b2a'; ctx.fillRect(k - 6, -4, 34, 8);
      ctx.fillStyle = '#e63946'; ctx.fillRect(k + 26, -4, 4, 8);
    } else if (weapon === 2) {
      ctx.fillStyle = '#1b1b2f'; ctx.fillRect(k, -5, 12, 10);
      ctx.fillStyle = '#3a5a1a'; ctx.fillRect(k + 2, -3, 8, 6);
    } else {
      ctx.fillStyle = '#1b1b2f'; ctx.fillRect(k, -4, 24, 7);
      ctx.fillStyle = '#6c757d'; ctx.fillRect(k + 2, -2, 20, 3);
      ctx.fillStyle = '#1b1b2f'; ctx.fillRect(k + 2, 2, 5, 6);
    }
    ctx.fillStyle = PAL.S; ctx.fillRect(k - 2, -3, 6, 6); // el
    ctx.restore();
  }

  function draw() {
    let ox = scrollX, oy = scrollY;
    if (shakeT > 0) { ox += rand(-7, 7); oy += rand(-7, 7); }
    ctx.clearRect(0, 0, W, H);

    for (const d of decals) {
      if (d.type === 'crater') {
        const s = d.img.width;
        if (d.x - ox + s < 0 || d.y - oy + s < 0 || d.x - ox - s > W || d.y - oy - s > H) continue;
        ctx.drawImage(d.img, Math.round(d.x - ox - s / 2), Math.round(d.y - oy - s / 2));
      } else if (!(d.el && d.el.__dead)) {
        const hx = Math.round(d.x - ox), hy = Math.round(d.y - oy);
        ctx.fillStyle = 'rgba(90,90,90,.55)'; ctx.fillRect(hx - 5, hy - 5, 10, 10);   // çatlak
        ctx.fillStyle = '#1b1b2f'; ctx.fillRect(hx - 3, hy - 3, 6, 6);                // delik
        ctx.fillStyle = '#ffb000'; ctx.fillRect(hx + 3, hy - 4, 2, 2);                // kıvılcım izi
      }
    }

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const d of debris) {
      const x = d.x - ox, y = d.y - oy;
      if (x < -50 || y < -50 || x > W + 50 || y > H + 50) continue;
      ctx.globalAlpha = Math.min(1, d.life);
      drawItem(d, x, y, d.rot);
    }
    ctx.globalAlpha = 1;

    for (const s of shots) {
      const x = s.x - ox, y = s.y - oy;
      if (s.kind === 'bullet') {
        ctx.fillStyle = '#ffe066'; ctx.fillRect(x - 2, y - 2, 4, 4);
        ctx.fillStyle = 'rgba(255,224,102,.5)'; ctx.fillRect(x - s.vx * .01 - 1, y - s.vy * .01 - 1, 3, 3);
      } else if (s.kind === 'grenade') {
        ctx.save(); ctx.translate(x, y); ctx.rotate(s.rot);
        ctx.fillStyle = '#1b1b2f'; ctx.fillRect(-6, -6, 12, 12);
        ctx.fillStyle = '#3a5a1a'; ctx.fillRect(-4, -4, 8, 8);
        ctx.fillStyle = s.life % .3 < .15 ? '#ff3b30' : '#ffd000'; ctx.fillRect(-2, -8, 4, 3);
        ctx.restore();
      } else {
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(s.vy, s.vx));
        ctx.fillStyle = '#1b1b2f'; ctx.fillRect(-12, -4, 22, 8);
        ctx.fillStyle = '#adb5bd'; ctx.fillRect(-10, -2, 16, 4);
        ctx.fillStyle = '#e63946'; ctx.fillRect(6, -2, 4, 4);
        ctx.restore();
      }
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max) * (p.smoke ? .6 : 1);
      ctx.fillStyle = p.color;
      const s = Math.round(p.size);
      ctx.fillRect(Math.round(p.x - ox - s / 2), Math.round(p.y - oy - s / 2), s, s);
    }
    ctx.globalAlpha = 1;

    for (const g of singularities) {
      const x = g.x - ox, y = g.y - oy;
      ctx.globalAlpha = .18; ctx.fillStyle = '#7b2cbf';
      ctx.beginPath(); ctx.arc(x, y, g.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      const R = 16 + Math.sin(g.spin * 2) * 3;
      for (let a = 0; a < 6.283; a += .35) {
        ctx.fillStyle = Math.floor(a * 3 + g.spin) % 2 ? '#c77dff' : '#ff9ef5';
        ctx.fillRect(Math.round(x + Math.cos(a + g.spin) * (R + 4) - 2), Math.round(y + Math.sin(a + g.spin) * (R + 4) - 2), 4, 4);
      }
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
    }
    if (laser) {
      const a = { x: laser.x1 - ox, y: laser.y1 - oy }, b = { x: laser.x2 - ox, y: laser.y2 - oy };
      ctx.lineCap = 'butt';
      ctx.strokeStyle = 'rgba(255,0,60,.35)'; ctx.lineWidth = 12 + Math.random() * 4;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (const b of bombs) {
      const x = b.x - ox, y = b.y - oy;
      ctx.fillStyle = '#1b1b2f'; ctx.fillRect(Math.round(x - 5), Math.round(y - 5), 10, 10);
      ctx.fillStyle = b.life % .2 < .1 ? '#ef233c' : '#8d99ae'; ctx.fillRect(Math.round(x - 2), Math.round(y - 2), 4, 4);
    }
    drawEnemies(ox, oy);
    for (const t of thrown) drawItem(t.o, t.x - ox, t.y - oy, t.rot);
    if (!P.dead && !(P.inv > 0 && Math.floor(P.inv * 10) % 2)) drawPlayer(ox, oy); // hasar alınca yanıp söner
    drawHUD();
    drawTouchUI();
    if (P.dead) drawGameOver();
  }

  function drawItem(d, x, y, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
    const k = d.big || 1;
    if (k !== 1) ctx.scale(k, k);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (d.type === 'letter') {
      ctx.font = d.font; ctx.fillStyle = d.color; ctx.fillText(d.ch, 0, 0);
    } else if (d.img) {
      const iw = d.img.naturalWidth, ih = d.img.naturalHeight;
      try { ctx.drawImage(d.img, d.sx * iw, d.sy * ih, d.sw * iw, d.sh * ih, -d.w / 2, -d.h / 2, d.w, d.h); }
      catch { ctx.fillStyle = d.color; ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h); }
    } else { ctx.fillStyle = d.color; ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h); }
    ctx.restore();
  }

  function drawHUD() {
    ctx.save();
    const hs = Math.min(1, W / 520); if (hs < 1) ctx.scale(hs, hs); // küçük ekranda HUD küçülür
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(20,20,35,.85)'; ctx.fillRect(10, 10, 360, 132);
    ctx.font = 'bold 13px ui-monospace, Menlo, monospace';
    for (const row of [[1, 2, 3], [4, 5, 6]]) {
      let x = 20; const y = row[0] === 1 ? 30 : 48;
      for (const k of row) {
        ctx.fillStyle = k === weapon ? '#ffd166' : '#888';
        const label = `[${k}] ${WEAPONS[k].name}`;
        ctx.fillText(label, x, y); x += ctx.measureText(label).width + 12;
      }
    }
    ctx.fillStyle = '#fff'; ctx.fillText(`Puan: ${score}`, 20, 70);
    ctx.fillStyle = '#333'; ctx.fillRect(150, 61, 100, 10);
    ctx.fillStyle = '#4fc3f7'; ctx.fillRect(150, 61, P.fuel, 10);
    for (let i = 0; i < 5; i++) drawHeart(20 + i * 20, 80, i < P.hp);
    ctx.font = '11px ui-monospace, Menlo, monospace'; ctx.fillStyle = '#bbb';
    ctx.fillText(`Düşman: ${enemies.length}`, 130, 91);
    if (isTouch) {
      ctx.fillText('Butonlarla yürü/zıpla · SİLAH ile değiştir', 20, 116);
      ctx.fillText('Ekrana dokun, basılı tut: nişan + ateş', 20, 132);
    } else {
      ctx.fillText('←→ / A D yürü · ↑ / W zıpla · ↓ / S in', 20, 116);
      ctx.fillText('Shift jetpack · Fare nişan+ateş · ESC çık', 20, 132);
    }
    ctx.restore();
  }



  // ---------------- I) DÜŞMANLAR ----------------
  // Her düşman: oyuncuya yaklaşır, sayfadan bir şey koparır (harf, resim,
  // buton ya da yerdeki parça), biraz uzaklaşıp onu oyuncuya fırlatır.
  // Fırlatılan şey ya da düşmanın kendisi değerse oyuncu 1 kalp kaybeder.
  const EBODY = [
    '.K........K.',
    '.KHK....KHK.',
    '..KHKKKKHK..',
    '..KHHHHHHK..',
    '..KSSSSSSK..',
    '..KEESSEEK..',
    '..KSSKKSSK..',
    '...KKKKKK...',
    '..KJJJJJJK..',
    '.KJJjJJjJJK.',
    '.KSKJJJJKSK.',
    '..KKJJJJKK..',
    '..KJJJJJJK..',
    '..KKKKKKKK..',
  ];
  // Düşman türleri:
  //  - Fırlatıcı: sayfadan harf/resim söker, sana fırlatır
  //  - Dev: yavaş ama çok dayanıklı; yaklaşınca üstüne koşar (2 kalp götürür), dev parçalar atar
  //  - Drone: uçar, tepende dolaşıp bomba bırakır
  const DRONE_A = [
    '.PPPP..PPPP.',
    '....KKKK....',
    '...KMMMMK...',
    '..KMMWWMMK..',
    '..KMWEEWMK..',
    '..KMMWWMMK..',
    '...KMMMMK...',
    '....KKKK....',
    '.....KK.....',
  ];
  const DRONE_B = ['..PP....PP..', ...DRONE_A.slice(1)];
  const TYPES = {
    thrower: { hp: 4, speed: 170, sc: 3, dmg: 1, pals: [
      { K: '#1b1b2f', H: '#6a4c93', S: '#9be37a', E: '#d00000', J: '#3a3a5a', j: '#262640', P: '#222', F: '#111' },
      { K: '#1b1b2f', H: '#9d0208', S: '#c9ada7', E: '#ffd000', J: '#d62828', j: '#6a040f', P: '#333', F: '#111' },
      { K: '#1b1b2f', H: '#f77f00', S: '#8ecae6', E: '#000000', J: '#023047', j: '#011d2e', P: '#219ebc', F: '#111' }] },
    brute: { hp: 14, speed: 95, sc: 4.5, dmg: 2, pals: [
      { K: '#1b1b2f', H: '#3a5a40', S: '#a3b18a', E: '#ff0000', J: '#588157', j: '#344e41', P: '#3a3a3a', F: '#111' }] },
    drone: { hp: 3, speed: 260, sc: 3, dmg: 1, fly: true, pals: [
      { K: '#1b1b2f', M: '#8d99ae', W: '#edf2f4', E: '#ef233c', P: '#adb5bd' }] },
  };
  const WHITE = new Proxy({}, { get: (_, k) => (k === '.' ? undefined : '#ffffff') });
  const enemies = [], thrown = [];
  const MAX_ENEMIES = 4;
  let spawnT = 1.5, spawnCount = 0;

  function pickType() {
    const r = Math.random();
    if (r < .3) return 'drone';
    if (r < .5 && !enemies.some(e => e.type === 'brute')) return 'brute';
    return 'thrower';
  }

  function spawnEnemy(type = pickType()) {
    const T = TYPES[type];
    const side = Math.random() < .5 ? -1 : 1;
    let x = P.x + side * rand(250, 450);
    if (x < 40 || x > docW() - 40) x = P.x - side * rand(250, 450);
    x = Math.max(30, Math.min(docW() - 30, x));
    const y = scrollY + (T.fly ? 80 : 40);
    const body = T.fly ? DRONE_A : EBODY;
    enemies.push({ type, x, y, vx: 0, vy: 0, onGround: false, face: -side, walk: 0, hp: T.hp, hpMax: T.hp, hurt: 0,
      sc: T.sc, w: 12 * T.sc, h: (T.fly ? body.length : body.length + 5) * T.sc, dmg: T.dmg, speed: T.speed,
      carry: null, grabT: rand(.5, 1.5), throwT: 0, drop: 0, jumpT: rand(1, 3), dropT: rand(1, 2), charge: 0, chargeT: 2,
      seed: rand(0, 6), t: 0, pal: T.pals[spawnCount++ % T.pals.length] });
    for (let i = 0; i < 24; i++) pixel(x, y, rand(-180, 180), rand(-180, 180), i % 2 ? '#c77dff' : '#fff', .5, 5);
  }

  const enemyAt = (x, y) => enemies.find(e => Math.abs(x - e.x) < e.w / 2 + 2 && y > e.y - e.h && y < e.y + 2);

  function hitEnemy(e, dmg, fx, fy) {
    if (!enemies.includes(e)) return;
    e.hp -= dmg; e.hurt = .15;
    e.vx += Math.sign(e.x - fx || 1) * (e.type === 'brute' ? 80 : 250);
    for (let i = 0; i < 6; i++) pixel(e.x, e.y - e.h / 2, rand(-200, 200), rand(-250, 50), e.pal.S || e.pal.M, .3, 4);
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    const i = enemies.indexOf(e);
    if (i < 0) return;
    enemies.splice(i, 1);
    if (e.carry) dropItem(e.carry, e.x, e.y - e.h, 0, -200);
    const cols = Object.values(e.pal);
    for (let k = 0; k < (e.type === 'brute' ? 80 : 40); k++) {
      pixel(e.x + rand(-e.w / 2, e.w / 2), e.y - rand(0, e.h), rand(-350, 350), rand(-450, 50), cols[k % cols.length], rand(.4, .9), rand(4, 8));
    }
    if (e.type === 'drone') enemyExplode(e.x, e.y - e.h / 2, 50, false);
    score += e.type === 'brute' ? 150 : e.type === 'drone' ? 75 : 50;
    shakeT = .15; spawnT = 3;
  }

  function hurtPlayer(n, fromX) {
    if (P.inv > 0 || P.dead) return;
    P.hp -= n; P.inv = 1.2; shakeT = .25;
    P.vx += Math.sign(P.x - fromX || 1) * 380; P.vy = -320; P.onGround = false;
    for (let i = 0; i < 16; i++) pixel(P.x, P.y - 28, rand(-250, 250), rand(-300, 50), i % 2 ? '#e63946' : '#fff', .5, 4);
    if (P.hp <= 0) {
      P.hp = 0; P.dead = true; mouse.down = false;
      for (let i = 0; i < 50; i++) pixel(P.x, P.y - 28, rand(-400, 400), rand(-500, 100), [PAL.H, PAL.J, PAL.B, PAL.S][i % 4], rand(.5, 1.2), rand(4, 8));
    }
  }

  // Düşman bombası patlaması: sayfada küçük krater + yakındaysan hasar
  function enemyExplode(x, y, r, hurts = true) {
    decals.push({ type: 'crater', x, y, img: makeCrater(r * .5) });
    for (let i = 0; i < 30; i++) {
      const a = rand(0, 6.283), v = rand(50, 380);
      pixel(x, y, Math.cos(a) * v, Math.sin(a) * v, ['#fff3a0', '#ff8c00', '#ef233c'][i % 3], rand(.3, .6), rand(3, 7));
    }
    const pts = [];
    for (let px = x - r; px <= x + r; px += 8) for (let py = y - r; py <= y + r; py += 8)
      if (Math.hypot(px - x, py - y) < r * .8) pts.push([px, py]);
    knockLetters(pts, x, y, 1.8, true);
    if (hurts && Math.hypot(P.x - x, P.y - 24 - y) < r) hurtPlayer(1, x);
    shakeT = Math.max(shakeT, .12);
  }

  function updateBombs(dt) {
    for (let i = bombs.length - 1; i >= 0; i--) {
      const b = bombs[i];
      b.life -= dt; b.vy += GRAVITY * .7 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      const hitP = !P.dead && Math.abs(b.x - P.x) < 18 && b.y > P.y - 56 && b.y < P.y;
      if (hitP || blockAt(b.x, b.y) || b.y > docH() || b.life <= 0) { enemyExplode(b.x, b.y, 70); bombs.splice(i, 1); }
    }
  }

  // Yakındaki bir şeyi kap: 1) yerdeki parça  2) küçük resim/buton  3) sayfadan harf sök
  function tryGrab(e) {
    const big = e.type === 'brute';
    const hx = e.x + e.face * e.w / 2, hy = e.y - e.h / 2;
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      if (Math.hypot(d.x - hx, d.y - hy) < 70 + (big ? 40 : 0)) { e.carry = debris.splice(i, 1)[0]; if (d.type === 'letter') e.carry.big = big ? 3.5 : 2.2; return; }
    }
    for (const b of blocks) {
      if (b.el.__dead || b.kind !== 'solid' || b.area > (big ? 60000 : 20000)) continue;
      const cx = Math.max(b.x, Math.min(hx, b.x + b.w)), cy = Math.max(b.y, Math.min(hy, b.y + b.h));
      if (Math.hypot(cx - hx, cy - hy) < (big ? 80 : 50)) {
        const cs = getComputedStyle(b.el);
        const bg = cs.backgroundColor, hasBg = bg && bg !== 'transparent' && !/,\s*0\)$/.test(bg);
        const img = b.el.tagName === 'IMG' && b.el.complete && b.el.naturalWidth ? b.el : null;
        const k = Math.min(1, (big ? 100 : 60) / Math.max(b.w, b.h));
        e.carry = { type: 'chunk', w: b.w * k, h: b.h * k, color: hasBg ? bg : cs.color, img, sx: 0, sy: 0, sw: 1, sh: 1, rot: 0 };
        b.el.style.visibility = 'hidden'; b.el.__dead = true;
        return;
      }
    }
    for (let k = 0; k < 8; k++) {
      const before = debris.length;
      knockLetters([[hx + rand(-40, 40), hy + rand(-50, 30)]], hx, hy, .3, true);
      if (debris.length > before) { e.carry = debris.pop(); e.carry.big = big ? 3.5 : 2.2; return; }
    }
  }

  function throwAt(e) {
    const o = e.carry; e.carry = null; e.grabT = rand(.8, 1.6);
    const sx = e.x, sy = e.y - e.h - 8;
    const tx = P.x + P.vx * .3, ty = P.y - 28;
    const t = Math.max(.45, Math.min(1.1, Math.hypot(tx - sx, ty - sy) / 650));
    const g = GRAVITY * .6;
    thrown.push({ o, x: sx, y: sy, vx: (tx - sx) / t, vy: (ty - sy) / t - .5 * g * t, g, rot: 0, vr: rand(-10, 10), life: 3, dmg: e.dmg });
  }

  function dropItem(o, x, y, vx, vy) {
    Object.assign(o, { x, y, vx, vy, rot: o.rot || 0, vr: rand(-6, 6), life: 3 });
    if (debris.length < 1500) debris.push(o);
  }

  function updateDrone(e, dt, dx, adx) {
    e.t += dt;
    const tx = P.x + Math.sin(e.t * .9 + e.seed) * 170, ty = P.y - 200 + Math.sin(e.t * 2 + e.seed) * 25;
    e.vx += ((tx - e.x) * 2.2 - e.vx) * Math.min(1, dt * 3);
    e.vy += ((ty - e.y) * 2.2 - e.vy) * Math.min(1, dt * 3);
    e.x = Math.max(12, Math.min(docW() - 12, e.x + e.vx * dt));
    e.y = Math.max(60, e.y + e.vy * dt);
    e.face = Math.sign(dx) || 1;
    if (P.dead) return;
    e.dropT -= dt;
    if (e.dropT <= 0 && adx < 220) { e.dropT = rand(1.6, 2.6); bombs.push({ x: e.x, y: e.y + 2, vx: e.vx * .3, vy: 60, life: 3 }); }
    if (Math.abs(P.x - e.x) < e.w / 2 + 10 && Math.abs((P.y - 28) - (e.y - e.h / 2)) < 40) hurtPlayer(1, e.x);
  }

  function updateEnemies(dt) {
    if (!P.dead) {
      spawnT -= dt;
      if (enemies.length < MAX_ENEMIES && spawnT <= 0) { spawnEnemy(); spawnT = 2.5; }
    }
    for (const e of [...enemies]) {
      if (e.hurt > 0) e.hurt -= dt;
      const dx = P.x - e.x, dy = P.y - e.y, adx = Math.abs(dx);
      if (e.type === 'drone') { updateDrone(e, dt, dx, adx); continue; }

      let dir = 0, speed = e.speed;
      if (!P.dead) {
        if (e.carry) dir = adx < 180 ? -Math.sign(dx) : adx > 380 ? Math.sign(dx) : 0; // mesafe koru
        else dir = Math.sign(dx);                                                     // yaklaş
      }
      // Dev: yakındaysa üstüne koşar
      if (e.type === 'brute' && !P.dead) {
        e.chargeT -= dt;
        if (!e.carry && adx < 320 && e.onGround && e.chargeT <= 0) { e.charge = .7; e.chargeT = 3.5; }
        if (e.charge > 0) {
          e.charge -= dt; dir = Math.sign(dx); speed = 440;
          if (Math.random() < .5) pixel(e.x - dir * 20, e.y - 4, -dir * rand(50, 150), rand(-80, -20), '#bbb', .4, 5, true);
        }
      }
      e.face = dir || Math.sign(dx) || 1;
      e.vx += (dir * speed - e.vx) * Math.min(1, dt * 8);

      e.jumpT -= dt;
      if (e.onGround && !P.dead && ((dy < -70 && e.jumpT <= 0) || Math.random() < dt * .15)) {
        e.vy = -rand(600, 720); e.onGround = false; e.jumpT = rand(.8, 2);
      }
      if (e.onGround && dy > 90 && Math.random() < dt * .8) e.drop = .25;
      if (e.drop > 0) e.drop -= dt;

      e.vy = Math.min(1400, e.vy + GRAVITY * dt);
      const prevY = e.y;
      e.x = Math.max(12, Math.min(docW() - 12, e.x + e.vx * dt));
      e.y += e.vy * dt;
      e.onGround = false;
      if (e.vy >= 0 && e.drop <= 0) {
        const f = landOn(e.x, prevY, e.y);
        if (f !== null) { e.y = f; e.vy = 0; e.onGround = true; if (e.type === 'brute' && prevY < f - 30) shakeT = Math.max(shakeT, .08); }
      }
      if (e.y >= docH()) { e.y = docH(); e.vy = 0; e.onGround = true; }
      if (e.onGround && Math.abs(e.vx) > 20) e.walk += dt * (e.type === 'brute' ? 6 : 9);

      if (P.dead) continue;
      if (!e.carry) {
        e.grabT -= dt;
        if (e.grabT <= 0) { e.grabT = .4; tryGrab(e); if (e.carry) e.throwT = rand(.6, 1.2); }
      } else {
        e.throwT -= dt;
        if (e.throwT <= 0 && adx < 700) throwAt(e);
      }
      if (Math.abs(P.x - e.x) < e.w / 2 + 12 && P.y > e.y - e.h && P.y - 56 < e.y) hurtPlayer(e.dmg, e.x);
    }
  }

  function updateThrown(dt) {
    for (let i = thrown.length - 1; i >= 0; i--) {
      const t = thrown[i];
      t.life -= dt; t.vy += t.g * dt; t.x += t.vx * dt; t.y += t.vy * dt; t.rot += t.vr * dt;
      if (!P.dead && Math.abs(t.x - P.x) < 20 && t.y > P.y - 58 && t.y < P.y + 4) {
        hurtPlayer(t.dmg || 1, t.x);
        dropItem(t.o, t.x, t.y, -t.vx * .2, -200);
        thrown.splice(i, 1); continue;
      }
      if (t.y > docH() || t.life <= 0) { dropItem(t.o, t.x, t.y, t.vx * .2, -150); thrown.splice(i, 1); }
    }
  }

  function drawEnemies(ox, oy) {
    for (const e of enemies) {
      const x = e.x - ox - e.w / 2, top = e.y - oy - e.h;
      const flip = e.face < 0;
      const pal = e.hurt > 0 ? WHITE : e.pal;
      if (e.type === 'drone') {
        drawSprite(Math.floor(performance.now() / 60) % 2 ? DRONE_A : DRONE_B, x, top, flip, pal, e.sc);
      } else {
        const leg = !e.onGround ? 1 : Math.abs(e.vx) > 20 ? 1 + (Math.floor(e.walk) % 2) : 0;
        drawSprite(EBODY, x, top, flip, pal, e.sc);
        drawSprite(LEGS[leg], x, top + EBODY.length * e.sc, flip, pal, e.sc);
        if (e.carry) drawItem(e.carry, e.x - ox, top - 14 + Math.sin(performance.now() / 120) * 2, 0);
      }
      ctx.fillStyle = '#1b1b2f'; ctx.fillRect(e.x - ox - 14, top - 6, 28, 4);
      ctx.fillStyle = '#e63946'; ctx.fillRect(e.x - ox - 13, top - 5, 26 * Math.max(0, e.hp) / e.hpMax, 2);
    }
  }

  const HEART = ['.KK.KK.', 'KRRKRRK', 'KRRRRRK', '.KRRRK.', '..KRK..', '...K...'];
  function drawHeart(x, y, full) {
    drawSprite(HEART, x, y, false, { K: '#1b1b2f', R: full ? '#e63946' : '#444' });
  }

  function drawGameOver() {
    ctx.fillStyle = 'rgba(10,10,25,.7)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.min(56, W / 7)}px ui-monospace, Menlo, monospace`;
    ctx.fillStyle = '#1b1b2f'; ctx.fillText('KAYBETTİN!', W / 2 + 4, H / 2 - 36);
    ctx.fillStyle = '#e63946'; ctx.fillText('KAYBETTİN!', W / 2, H / 2 - 40);
    ctx.font = 'bold 20px ui-monospace, Menlo, monospace'; ctx.fillStyle = '#ffd166';
    ctx.fillText(`Puan: ${score}`, W / 2, H / 2 + 10);
    ctx.fillStyle = '#fff'; ctx.font = '16px ui-monospace, Menlo, monospace';
    ctx.fillText(isTouch ? 'Yeniden başlamak için ekrana dokun' : 'Yeniden başlamak için R tuşuna bas', W / 2, H / 2 + 44);
  }

  function restart() {
    Object.assign(P, { hp: 5, dead: false, inv: 1.5, x: scrollX + W / 2, y: scrollY + 80, vx: 0, vy: 0, fuel: 100 });
    enemies.length = 0; thrown.length = 0; bombs.length = 0; singularities.length = 0; spawnT = 1.5; score = 0;
  }


  // ---------------- J) TELEFON / DOKUNMATİK KONTROLLER ----------------
  // Dokunmatik ekranda butonlar çıkar. Butona dokunmak = o tuşa basmak.
  // Butonların dışına dokunup basılı tutmak = oraya nişan al + ateş et.
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  const touchOwners = new Map(); // dokunuş id → buton adı ya da 'aim'
  function touchButtons() {
    const s = Math.min(1.15, Math.max(.8, Math.min(W, H) / 420)); // ekran boyuna göre büyüklük
    return [
      { id: 'left',  key: 'arrowleft',  x: 58 * s,      y: H - 70 * s,  r: 34 * s, label: '◀' },
      { id: 'right', key: 'arrowright', x: 142 * s,     y: H - 70 * s,  r: 34 * s, label: '▶' },
      { id: 'down',  key: 'arrowdown',  x: 100 * s,     y: H - 148 * s, r: 24 * s, label: '▼' },
      { id: 'jump',  key: 'arrowup',    x: W - 64 * s,  y: H - 78 * s,  r: 38 * s, label: 'ZIPLA' },
      { id: 'jet',   key: 'shift',      x: W - 156 * s, y: H - 58 * s,  r: 30 * s, label: 'JET' },
      { id: 'weap',  key: null,         x: W - 64 * s,  y: H - 178 * s, r: 30 * s, label: 'SİLAH' },
      { id: 'quit',  key: null,         x: W - 26 * s,  y: 26 * s,      r: 18 * s, label: '✕' },
    ];
  }
  function onTouch(e) {
    if (!running) return;
    e.preventDefault(); e.stopPropagation();
    const btns = touchButtons();
    for (const t of e.changedTouches) {
      const x = t.clientX, y = t.clientY;
      if (e.type === 'touchstart') {
        if (P.dead) { restart(); continue; }               // ölünce dokun → yeniden başla
        const b = btns.find(b => Math.hypot(x - b.x, y - b.y) < b.r + 10);
        if (b) {
          touchOwners.set(t.identifier, b.id);
          if (b.key) keys[b.key] = true;
          if (b.id === 'weap') weapon = weapon % 6 + 1;
          if (b.id === 'quit') { quit(); return; }
        } else {
          touchOwners.set(t.identifier, 'aim');
          mouse.x = x; mouse.y = y; mouse.down = true;
        }
      } else if (e.type === 'touchmove') {
        if (touchOwners.get(t.identifier) === 'aim') { mouse.x = x; mouse.y = y; }
      } else { // touchend / touchcancel
        const id = touchOwners.get(t.identifier);
        touchOwners.delete(t.identifier);
        if (id === 'aim') mouse.down = [...touchOwners.values()].includes('aim');
        else { const b = btns.find(b => b.id === id); if (b && b.key) keys[b.key] = false; }
      }
    }
  }
  if (isTouch) for (const ev of ['touchstart', 'touchmove', 'touchend', 'touchcancel'])
    addEventListener(ev, onTouch, { capture: true, passive: false });

  function drawTouchUI() {
    if (!isTouch) return;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const active = new Set(touchOwners.values());
    for (const b of touchButtons()) {
      const on = active.has(b.id) || (b.id === 'weap' && false);
      ctx.globalAlpha = on ? .75 : .45;
      ctx.fillStyle = b.id === 'quit' ? '#e63946' : '#1b1b2f';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = .9; ctx.lineWidth = 3; ctx.strokeStyle = on ? '#ffd166' : '#fff';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(b.r * (b.label.length > 2 ? .38 : .8))}px ui-monospace, Menlo, monospace`;
      ctx.fillText(b.label, b.x, b.y + 1);
      if (b.id === 'weap') {
        ctx.font = `bold ${Math.round(b.r * .34)}px ui-monospace, Menlo, monospace`; ctx.fillStyle = '#ffd166';
        ctx.fillText(WEAPONS[weapon].name, b.x, b.y + b.r + 12);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------------- H) OYUN DÖNGÜSÜ ----------------
  let last = performance.now();
  function loop(now) {
    if (!running) return;
    const dt = Math.min(.033, (now - last) / 1000); last = now;
    cooldown -= dt;
    if (!P.dead && weapon !== 5 && mouse.down && cooldown <= 0) { fire(); cooldown = WEAPONS[weapon].rate; }
    updatePlayer(dt);
    updateShots(dt);
    updateLaser(dt);
    updateSingularities(dt);
    updateBombs(dt);
    updateEnemies(dt);
    updateThrown(dt);
    updateEffects(dt);
    updateCamera();
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function quit() { running = false; cv.remove(); style.remove(); window.__DESTROY__ = false; }
})();
