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
    if (['1', '2', '3'].includes(k)) weapon = +k;
    if (k === 'escape') quit();
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
  const P = { x: scrollX + W / 2, y: scrollY + 80, vx: 0, vy: 0, onGround: false, face: 1, walk: 0, fuel: 100, jumpHeld: false, flying: false, kick: 0 };

  function landOn(prevY, newY) {
    let floor = null;
    for (const b of blocks) {
      if (b.el.__dead) continue;
      if (P.x < b.x - 4 || P.x > b.x + b.w + 4) continue;
      if (prevY <= b.y + 1 && newY >= b.y && (floor === null || b.y < floor)) floor = b.y;
    }
    return floor;
  }

  function updatePlayer(dt) {
    const dir = (right() ? 1 : 0) - (left() ? 1 : 0);
    P.vx += (dir * SPEED - P.vx) * Math.min(1, dt * 18); // yumuşak hızlanma
    if (dir) P.face = dir;

    if (jump() && P.onGround && !P.jumpHeld) { P.vy = -JUMP; P.onGround = false; }
    P.jumpHeld = jump();

    P.flying = false;
    if (jet() && P.fuel > 0) {
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
      const f = landOn(prevY, P.y);
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
  const WEAPONS = { 1: { name: 'Tabanca', rate: 0.1 }, 2: { name: 'Bomba', rate: 0.45 }, 3: { name: 'Roket', rate: 0.65 } };

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
    } else {
      shots.push({ kind: 'rocket', x: t.x, y: t.y, vx: c * 380, vy: s * 380, life: 3 });
      P.vx -= c * 120; // geri tepme
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
      const nx = s.x + s.vx * dt, ny = s.y + s.vy * dt;
      const steps = Math.max(1, Math.ceil(Math.hypot(nx - s.x, ny - s.y) / 5));
      let done = false, bounced = false;

      for (let k = 1; k <= steps && !done && !bounced; k++) {
        const px = s.x + (nx - s.x) * k / steps, py = s.y + (ny - s.y) * k / steps;
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

  function knockLetters(worldPts, fromX, fromY, force) {
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
    score += count;
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

  function drawSprite(rows, x, y, flip) {
    for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) {
      const col = PAL[rows[r][c]];
      if (!col) continue;
      const cx = flip ? (rows[r].length - 1 - c) : c;
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(x + cx * SCALE), Math.round(y + r * SCALE), SCALE, SCALE);
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
      ctx.save(); ctx.translate(x, y); ctx.rotate(d.rot);
      ctx.globalAlpha = Math.min(1, d.life);
      if (d.type === 'letter') {
        ctx.font = d.font; ctx.fillStyle = d.color; ctx.fillText(d.ch, 0, 0);
      } else if (d.img) {
        const iw = d.img.naturalWidth, ih = d.img.naturalHeight;
        try { ctx.drawImage(d.img, d.sx * iw, d.sy * ih, d.sw * iw, d.sh * ih, -d.w / 2, -d.h / 2, d.w, d.h); }
        catch { ctx.fillStyle = d.color; ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h); }
      } else { ctx.fillStyle = d.color; ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h); }
      ctx.restore();
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

    drawPlayer(ox, oy);
    drawHUD();
  }

  function drawHUD() {
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(20,20,35,.85)'; ctx.fillRect(10, 10, 330, 80);
    ctx.font = 'bold 13px ui-monospace, Menlo, monospace';
    let x = 20;
    for (const k of [1, 2, 3]) {
      ctx.fillStyle = k === weapon ? '#ffd166' : '#888';
      const label = `[${k}] ${WEAPONS[k].name}`;
      ctx.fillText(label, x, 30); x += ctx.measureText(label).width + 12;
    }
    ctx.fillStyle = '#fff'; ctx.fillText(`Puan: ${score}`, 20, 52);
    ctx.fillStyle = '#333'; ctx.fillRect(140, 43, 100, 10);
    ctx.fillStyle = '#4fc3f7'; ctx.fillRect(140, 43, P.fuel, 10);
    ctx.font = '11px ui-monospace, Menlo, monospace'; ctx.fillStyle = '#bbb';
    ctx.fillText('←→ / A D yürü · ↑ / W zıpla · ↓ / S in', 20, 70);
    ctx.fillText('Shift jetpack · Fare nişan+ateş · ESC çık', 20, 84);
  }

  // ---------------- H) OYUN DÖNGÜSÜ ----------------
  let last = performance.now();
  function loop(now) {
    if (!running) return;
    const dt = Math.min(.033, (now - last) / 1000); last = now;
    cooldown -= dt;
    if (mouse.down && cooldown <= 0) { fire(); cooldown = WEAPONS[weapon].rate; }
    updatePlayer(dt);
    updateShots(dt);
    updateEffects(dt);
    updateCamera();
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function quit() { running = false; cv.remove(); style.remove(); window.__DESTROY__ = false; }
})();
