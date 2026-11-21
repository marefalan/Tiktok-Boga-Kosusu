#!/bin/bash
# Boğa Koşusu — Mac başlatıcısı
# Çalıştırmak için: Terminal'i aç, "bash " yaz (sonunda boşluk), bu dosyayı pencereye sürükle, Enter'a bas.
cd "$(dirname "$0")" || exit 1
PORT=3400

echo ""
echo "  Boğa Koşusu başlatılıyor..."
echo ""

# 0) Node.js kurulu mu?
if ! command -v node >/dev/null 2>&1; then
  echo "  Node.js bulunamadı."
  echo "  https://nodejs.org adresinden LTS sürümünü indirip kur, sonra Terminal'i kapatıp tekrar dene."
  open "https://nodejs.org" 2>/dev/null
  echo ""
  read -r -p "  Kapatmak için Enter'a bas..."
  exit 1
fi

# 1) İlk açılış: ayarlar dosyasını oluştur ve TextEdit'te aç
if [ ! -f ayarlar.json ]; then
  cp ayarlar.ornek.json ayarlar.json
  echo "  ayarlar.json oluşturuldu ve TextEdit'te açılıyor."
  echo "  TikTok kullanıcı adını ve Euler anahtarını TIRNAKLARIN ARASINA yaz,"
  echo "  Cmd+S ile kaydet ve TextEdit penceresini kapat."
  echo ""
  open -e ayarlar.json
  read -r -p "  Kaydettikten sonra buraya dönüp Enter'a bas..."
  echo ""
fi

# 2) İlk açılış: gerekli paketleri kur
if [ ! -d node_modules ]; then
  echo "  Gerekli paketler kuruluyor, 1-2 dakika sürebilir..."
  npm install --no-audit --no-fund || { echo "  Paketler kurulamadı. İnternet bağlantını kontrol et."; read -r -p "  Enter..."; exit 1; }
fi

# 3) Sunucu (bu Terminal penceresinde çalışır; yayın boyunca KAPATMA)
node server.js &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT INT TERM
sleep 2

# 4) Sahne penceresi: kenarlıksız, dikey 9:16. Yayına BU pencereyi ver.
SAHNE="http://localhost:$PORT/sahne"
PROFIL="$(pwd)/.sahne-tarayici"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
EDGE="/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
[ -x "$CHROME" ] || CHROME="$HOME/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ -x "$CHROME" ]; then BROWSER="$CHROME"; elif [ -x "$EDGE" ]; then BROWSER="$EDGE"; else BROWSER=""; fi

if [ -n "$BROWSER" ]; then
  "$BROWSER" --app="$SAHNE" --user-data-dir="$PROFIL" --window-size=608,1080 --window-position=0,0 \
    --autoplay-policy=no-user-gesture-required --no-first-run --no-default-browser-check >/dev/null 2>&1 &
else
  echo "  Google Chrome bulunamadı; sahne varsayılan tarayıcıda açılıyor."
  echo "  En iyi sonuç için Google Chrome kurmanı öneririm."
  open "$SAHNE"
fi

# 5) Kontrol paneli (normal tarayıcıda; bunu YAYINA VERME)
open "http://localhost:$PORT/"

echo ""
echo "  Oyun çalışıyor. Bu Terminal penceresini yayın boyunca KAPATMA."
echo "  Durdurmak için bu pencerede Ctrl+C'ye bas."
echo ""
wait $SERVER_PID
