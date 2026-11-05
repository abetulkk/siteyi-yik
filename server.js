// =====================================================================
//  DERS 1 — SUNUCU (PROXY)
//  Neden lazım? Tarayıcı, başka bir sitenin sayfasına kendi kodumuzu
//  sokmamıza izin vermez (güvenlik). O yüzden sayfayı BİZİM sunucumuz
//  indirir, içine oyun kodunu ekler ve kendi adresinden geri sunar.
//  Yani oyuncu gerçek siteyi değil, o sitenin bir KOPYASINI yıkar.
// =====================================================================
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// public klasöründeki dosyaları (index.html, game.js, demo.html) doğrudan sun
const ROOT = require('fs').existsSync(path.join(__dirname, 'public')) ? path.join(__dirname, 'public') : __dirname; app.use(express.static(ROOT));

// =====================================================================
//  GÜVENLİK
//  1) Özel ağ koruması: sunucu, Render'ın kendi iç ağına ya da başka gizli
//     adreslere istek atmasın. Adres isimden değil, DNS'ten çıkan gerçek IP'ye
//     göre kontrol edilir; yönlendirmelerin her adımı da ayrıca kontrol edilir.
//  2) Hız sınırı: bir kişi dakikada en fazla 30 sayfa açabilir.
//  3) Sayfa kopyalarında SADECE bizim oyun kodumuz çalışabilir (CSP).
//     Böylece kimse bu siteyi sahte giriş sayfası göstermek için kullanamaz.
//  4) Kopyalardaki formlar hiçbir yere gönderilemez (şifre girilse bile).
//  5) Kopyalar Google'da listelenmez.
// =====================================================================
const dns = require('dns').promises;
const net = require('net');

function isPrivateIP(ip) {
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    const m = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (m) ip = m[1];
    else return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || a >= 224 ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

async function isSafeUrl(u) {
  if (!/^https?:$/.test(u.protocol)) return false;
  if (u.port && !['80', '443'].includes(u.port)) return false;
  if (u.username || u.password) return false;
  try {
    const addrs = await dns.lookup(u.hostname, { all: true });
    return addrs.length > 0 && addrs.every(a => !isPrivateIP(a.address));
  } catch { return false; }
}

const hits = new Map(); // ip → [zamanlar]
function rateLimited(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 30;
}

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'no-referrer');
  next();
});

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
};
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB'tan büyük sayfaları alma

// /play?url=wikipedia.org  → sitenin oynanabilir kopyası
app.get('/play', async (req, res) => {
  if (rateLimited(req)) return res.status(429).send('Çok hızlı! Bir dakika bekleyip tekrar dene.');

  let target = String(req.query.url || '').trim().slice(0, 2000);
  if (!target) return res.redirect('/');
  if (!/^https?:\/\//i.test(target)) target = 'https://' + target;

  let current;
  try { current = new URL(target); } catch { return res.status(400).send('Geçersiz adres'); }

  try {
    // ADIM 1: Sayfayı indir. Yönlendirmeleri kendimiz takip ediyoruz ki
    // her adımda adresin güvenli olduğunu kontrol edebilelim.
    let r;
    for (let i = 0; ; i++) {
      if (i > 5) return res.status(400).send('Çok fazla yönlendirme');
      if (!(await isSafeUrl(current))) return res.status(400).send('Bu adrese izin verilmiyor');
      r = await fetch(current.href, { redirect: 'manual', headers: HEADERS, signal: AbortSignal.timeout(12000) });
      const loc = r.headers.get('location');
      if (r.status >= 300 && r.status < 400 && loc) { current = new URL(loc, current); continue; }
      break;
    }

    const type = r.headers.get('content-type') || '';
    if (!type.includes('text/html')) return res.status(400).send('Bu adres bir web sayfası değil');
    if (Number(r.headers.get('content-length') || 0) > MAX_BYTES) return res.status(400).send('Sayfa çok büyük');

    let html = await r.text();
    if (html.length > MAX_BYTES) return res.status(400).send('Sayfa çok büyük');
    const finalUrl = current.href;

    // ADIM 2: Sitenin kendi JavaScript'lerini sil.
    html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<script\b[^>]*\/>/gi, '');

    // ADIM 3: Engelleyici etiketleri sil (güvenlik politikası, otomatik yenileme, eski <base>)
    html = html.replace(/<meta[^>]+http-equiv=["']?(content-security-policy|refresh)["']?[^>]*>/gi, '');
    html = html.replace(/<base\b[^>]*>/gi, '');

    // ADIM 3b: JavaScript'siz içerikleri göster (<noscript> etiketlerini aç)
    html = html.replace(/<\/?noscript[^>]*>/gi, '');

    // ADIM 4: <base> + oyun kodu
    const self = '//' + req.get('host');
    const safeUrl = finalUrl.replace(/"/g, '&quot;');
    const inject = `<base href="${safeUrl}"><script src="${self}/game.js" defer></script>`;
    if (/<head(\s[^>]*)?>/i.test(html)) html = html.replace(/<head(\s[^>]*)?>/i, m => m + inject);
    else html = inject + html;

    // GÜVENLİK BAŞLIKLARI
    res.set('Content-Security-Policy', [
      "script-src 'self'",     // yalnızca bizim game.js çalışır; sayfadaki onclick vb. çalışmaz
      "object-src 'none'",     // eski eklenti içerikleri (Flash vb.) yok
      "form-action 'none'",    // formlar hiçbir yere gönderilemez
      "frame-ancestors 'none'",// bu sayfa başka sitelere gömülemez
    ].join('; '));
    res.set('X-Robots-Tag', 'noindex, nofollow'); // Google kopyaları listelemesin
    res.set('Cache-Control', 'no-store');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) {
    res.status(502).send('Site yüklenemedi. Adresi kontrol et ya da başka bir site dene.');
  }
});

app.listen(PORT, () => console.log(`Hazır → http://localhost:${PORT}`));
