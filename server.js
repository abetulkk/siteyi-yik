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
app.use(express.static(path.join(__dirname, 'public')));

// Kendi bilgisayarına / yerel ağa istek atılmasın diye basit bir koruma
function isPrivateHost(hostname) {
  return /^(localhost|127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(hostname)
    || hostname === '[::1]';
}

// /play?url=wikipedia.org  → sitenin oynanabilir kopyası
app.get('/play', async (req, res) => {
  let target = String(req.query.url || '').trim();
  if (!target) return res.redirect('/');
  if (!/^https?:\/\//i.test(target)) target = 'https://' + target;

  let url;
  try { url = new URL(target); } catch { return res.status(400).send('Geçersiz adres'); }
  if (isPrivateHost(url.hostname)) return res.status(400).send('Bu adrese izin verilmiyor');

  try {
    // ADIM 1: Sayfayı normal bir tarayıcı gibi indir
    const r = await fetch(url.href, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
      },
    });
    const type = r.headers.get('content-type') || '';
    if (!type.includes('text/html')) return res.status(400).send('Bu adres bir web sayfası değil');

    let html = await r.text();
    const finalUrl = r.url; // yönlendirme olduysa son adres

    // ADIM 2: Sitenin kendi JavaScript'lerini sil.
    //  - Bizi başka sayfaya yönlendirmesinler
    //  - Kopyanın kendi adresimizde çalıştığını fark edip bozulmasınlar
    html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<script\b[^>]*\/>/gi, '');

    // ADIM 3: Engelleyici etiketleri sil (güvenlik politikası, otomatik yenileme, eski <base>)
    html = html.replace(/<meta[^>]+http-equiv=["']?(content-security-policy|refresh)["']?[^>]*>/gi, '');
    html = html.replace(/<base\b[^>]*>/gi, '');

    // ADIM 4: <base> ekle → resimler/CSS orijinal siteden yüklenir
    //         <script> ekle → oyunumuz sayfanın içine girer
    const self = `${req.protocol}://${req.get('host')}`;
    const safeUrl = finalUrl.replace(/"/g, '&quot;');
    const inject = `<base href="${safeUrl}"><script src="${self}/game.js" defer></script>`;

    if (/<head(\s[^>]*)?>/i.test(html)) html = html.replace(/<head(\s[^>]*)?>/i, m => m + inject);
    else html = inject + html;

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) {
    res.status(502).send('Site yüklenemedi: ' + e.message);
  }
});

app.listen(PORT, () => console.log(`Hazır → http://localhost:${PORT}`));
