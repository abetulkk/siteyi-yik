#!/bin/zsh
# Siteyi Yık! — çift tıkla, gerisini bu dosya yapar.
cd "$(dirname "$0")"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
for p in /opt/homebrew/bin /usr/local/bin; do [ -d "$p" ] && export PATH="$p:$PATH"; done

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "❌ Node.js bulunamadı. https://nodejs.org adresinden LTS sürümünü kur, sonra bu dosyaya tekrar çift tıkla."
  open "https://nodejs.org"
  read -k1 "?Kapatmak için bir tuşa bas..."
  exit 1
fi

echo "✅ Node $(node -v) bulundu"
if [ ! -d node_modules ]; then
  echo "📦 Gerekli paketler kuruluyor (ilk seferde 1 dakika sürebilir)..."
  npm install || { read -k1 "?Kurulum hatası. Ekranın fotoğrafını Claude'a gönder. Bir tuşa bas..."; exit 1; }
fi

echo "🚀 Oyun başlıyor... Tarayıcı birazdan açılacak."
echo "   Kapatmak için bu pencereyi kapat."
(sleep 2 && open "http://localhost:3000") &
npm start
