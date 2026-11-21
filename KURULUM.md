# Kurulum: Boğa Koşusu

Oyun `boga-kosusu` klasöründedir.

| Sayfa | Adres | Ne işe yarar |
|---|---|---|
| Kontrol paneli | http://localhost:3400/ | Bağlantı, deneme düğmeleri, hediye kaydı |
| Sahne | http://localhost:3400/sahne | Yayına verilecek dikey pencere |

---

## 1. Kodları indir

GitHub'daki depo sayfasında yeşil **Code** düğmesine bas, **Download ZIP** ile indir. ZIP'i ayıkla.

## 2. Node.js kur

https://nodejs.org adresinden **LTS** sürümünü indir ve kur.

## 3. Euler Stream'den ücretsiz API anahtarı al

Oyun, yayındaki yorum, beğeni ve hediyeleri okumak için bu anahtara ihtiyaç duyar.

1. https://www.eulerstream.com adresine git, ücretsiz üye ol.
2. Panelden yeni bir API anahtarı oluştur ve kopyala.

Anahtarı kimseyle paylaşma ve GitHub'a yükleme.

## 4. Başlat

**Windows:** `boga-kosusu` klasöründeki **`BASLAT.bat`**'a çift tıkla.

**Mac:** Terminal'i aç (Cmd + Boşluk → "Terminal"). `bash ` yaz (sonunda bir boşluk), `BASLAT-MAC.command` dosyasını Terminal'e sürükle, **Enter**'a bas.

İlk açılışta `ayarlar.json` açılır. Bilgilerini **tırnakların arasına** yaz:

```json
{
  "username": "kullanici_adin",
  "signApiKey": "euler_xxxxxxxxxxxx"
}
```

Kaydet ve kapat (Mac'te sonra Terminal'e dönüp Enter'a bas). Paketler kurulur, ardından iki pencere açılır:

- **Sahne penceresi** (kenarlıksız, dikey): yayına verilecek pencere.
- **Kontrol paneli** (tarayıcıda): sadece senin için. Yayına verme.

Sunucu penceresini (Windows'ta siyah pencere, Mac'te Terminal) yayın boyunca **kapatma**.

## 5. Yayın açmadan dene

Kontrol panelindeki **Yayın açmadan dene** düğmeleriyle izleyici ekleyip yorum, beğeni ve hediye gönderebilirsin. Sağdaki önizleme anında değişir.

## 6. TikTok LIVE Studio'da yayına ver

1. LIVE Studio'yu aç, sahneyi **dikey (9:16)** yap.
2. **Kaynak ekle → Pencere yakalama** seç ve **Boğa Koşusu** penceresini seç.
3. Görüntüyü sahneyi kaplayacak şekilde büyüt ve yayını başlat. Oyun yayına kendisi bağlanır.

Mac'te ekran yakalama için ilk seferde izin istenir: **Sistem Ayarları → Gizlilik ve Güvenlik → Ekran ve Sistem Ses Kaydı**'ndan LIVE Studio'ya izin ver.

---

## Oyun nasıl oynanır?

Oyun turlar halinde döner: **lobi (30 sn) → 3-2-1 → yarış (~2 dk) → sonuç kartı (10 sn) → yeni lobi.** Bir tur yaklaşık 2,5-3 dakika sürer. Yarış bilerek uzun tutuldu: izleyiciler yarış boyunca beğeni ve hediye göndererek koşucularını öne taşıyabilir.

- **Lobi:** Yorum yazan izleyici yarışa katılır. Az kişi varsa boş yerleri isimsiz koşucular doldurur.
- **Yarış:** Koşucular 700 metrelik köy yolunda kameraya doğru koşar, boğa arkalarından gelir. Boğa zamanla hızlanır ve sondakilerden çok geride kalırsa atak yapar. Yakalanan koşucu havaya savrulur ve yarıştan çıkar.
- **Bitiş:** İlk varan kazanır. İlk koşucu bitişe ulaştıktan 12 saniye sonra ya da herkes bitirince veya yakalanınca yarış biter.
- **Sonuç kartı:** Kazananın süresi, toplam galibiyet sayısı ve ilk 5 gösterilir. Kimse bitiremezse "Boğa kazandı" yazar. Galibiyetler saklanır; panelden **Galibiyetleri sıfırla** ile silebilirsin.
- **Sonraki tur:** Yarış sürerken yorum yazan izleyici sonraki yarışa otomatik yazılır.

Hiç etkileşim olmasa bile genellikle 1-4 koşucu bitişe ulaşır. Beğeni, `koş` yorumları ve hediyeler bitirme şansını belirgin şekilde artırır.

**Komutlar:** Yarışta `koş`, `hızlan`, `hadi` ya da `gaz` yazan koşucu kısa süre hızlanır; başka bir yorum da biraz hız verir. Büyük/küçük harf, Türkçe karakter ve harf uzatma fark etmez.

## Hediyeler (`hediyeler.json`)

| Eylem | Yarışta |
|---|---|
| `katil` | Lobideyse yarışa katılır. Yarış sürüyorsa boğanın hemen önünden yarışa dalar ve turbo alır |
| `turbo` | 4 saniye boyunca çok hızlı koşar |
| `kalkan` | 12 saniye boyunca boğa yakalayamaz |
| `jetpack` | 30 metre ileri uçar |
| `pelerin` | Boğa 5 saniye oyalanır |
| `roket` | En öndekinin önüne uçar |

Lobide ya da sonuç kartı sırasında atılan hediye kaybolmaz; güçlendirme yarış başlarken işler. Takip ve paylaşım turbo verir. Listede olmayan hediyeler de turbo olur.

Dosyadaki her hediyenin `jeton`, `ad` ve `id` alanları eşleştirme içindir; ekranda jeton değeri gösterilmez. Gelen hediyelerin adı ve numarası kontrol panelindeki **Hediye kaydı** tablosunda görünür. Dosyayı değiştirince panelde **Hediyeleri yeniden oku**'ya bas.

## 3B ve performans

Oyun gerçek 3B çizilir (Three.js; kütüphane proje içinde gelir). Ekran kartı olan her bilgisayarda akıcı çalışır.

- Bilgisayar zorlanırsa oyun 3B çözünürlüğü kendiliğinden düşürür.
- Kaliteyi elle sabitlemek için sahne adresinin sonuna `?kalite=0.7` gibi bir değer ekle (1 = en yüksek, 0.5 = en hafif).
- Kontrol panelindeki önizleme bilerek düşük çözünürlüklüdür.

## Müzik

`boga-kosusu/muzik` klasörüne müziklerini at (mp3, m4a, wav, ogg, flac). Klasör boşsa oyun kendi ritmini üretir. Canlı yayında telifli müzik yayının sessize alınmasına yol açabilir.

## Sorun çözme

| Sorun | Çözüm |
|---|---|
| "Node.js bulunamadı" | Node.js'i kur, bilgisayarı yeniden başlat. |
| "Euler API anahtarı eksik" | `ayarlar.json`'daki `signApiKey` alanını doldur, sunucu penceresini kapatıp oyunu yeniden başlat. |
| "ayarlar.json okunamadı" | Dosyada bir tırnak veya virgül silinmiş. `ayarlar.ornek.json`'a bakıp düzelt ya da `ayarlar.json`'u silip oyunu yeniden başlat. |
| "şu an yayında değil" | Normal. Yayını açınca 30 saniye içinde kendisi bağlanır. |
| "3400 portu kullanımda" | Oyun zaten açık. Açık olan sunucu penceresini kapatıp tekrar başlat. |
| Görüntü takılıyor | Sahne adresine `?kalite=0.6` ekle ya da yayında başka ağır programları kapat. |
| Müzik çalmıyor | Sahne penceresinde "Müziği başlatmak için tıkla" çıkarsa bir kez tıkla. |
| Hediye tepki vermiyor | Panelde **Hediye kaydı**'na bak, hediyenin adını, numarasını ve jetonunu `hediyeler.json`'a yaz, **Hediyeleri yeniden oku**'ya bas. |
