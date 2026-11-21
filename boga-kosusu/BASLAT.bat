@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Boga Kosusu

rem 0) Node.js kurulu mu?
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js bulunamadi. https://nodejs.org adresinden LTS surumunu kurup tekrar dene.
  echo.
  pause
  exit /b
)

rem 1) Ilk acilis: ayarlar dosyasini olustur ve Not Defteri'nde ac
if not exist ayarlar.json (
  copy /y ayarlar.ornek.json ayarlar.json >nul
  echo.
  echo  ayarlar.json olusturuldu ve simdi Not Defteri'nde acilacak.
  echo  TikTok kullanici adini ve Euler anahtarini tirnaklarin arasina yaz,
  echo  Ctrl+S ile KAYDET ve Not Defteri'ni KAPAT. Oyun sonra kendiliginden acilir.
  echo.
  start /wait notepad ayarlar.json
)

rem 2) Ilk acilis: gerekli paketleri kur
if not exist node_modules (
  echo  Gerekli paketler kuruluyor, 1-2 dakika surebilir...
  call npm install --no-audit --no-fund
)

rem 3) Sunucu: ayri pencerede. Yayin boyunca KAPATMA.
start "Boga Kosusu - SUNUCU (kapatma)" cmd /k node server.js
timeout /t 2 /nobreak >nul

rem 4) Sahne penceresi: kenarliksiz, dikey 9:16. TikTok LIVE Studio'da BU pencereyi yakala.
set "SAHNE=http://localhost:3400/sahne"
set "PROFIL=%~dp0.sahne-tarayici"
set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "CHROME=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined CHROME if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "CHROME=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if defined CHROME (
  start "" "%CHROME%" --app="%SAHNE%" --user-data-dir="%PROFIL%" --window-size=608,1080 --window-position=0,0 --autoplay-policy=no-user-gesture-required --no-first-run --no-default-browser-check
) else (
  start "" "%SAHNE%"
)

rem 5) Kontrol paneli: normal tarayicinda. Bunu YAYINA VERME.
start "" "http://localhost:3400/"
