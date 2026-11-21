# Boğa Koşusu — TikTok LIVE oyunu (3B)

İzleyicilerin yorum yazarak katıldığı, 3B bir canlı yayın yarışı. Köy yolunda bloklu koşucular kameraya doğru kaçar, arkalarından bir boğa gelir. Geride kalanı boğa yakalayıp havaya savurur; 700 metrelik bitişe ilk varan kazanır. Bir yarış yaklaşık 2 dakika sürer; izleyicilerin beğeni ve hediye göndermesi için bolca zaman kalır.

Oyun tur tur döner: **lobi → 3-2-1 → yarış → sonuç kartı → yeni lobi.**

## Hızlı kurulum

1. [Node.js](https://nodejs.org) (LTS) kur.
2. [Euler Stream](https://www.eulerstream.com)'den ücretsiz API anahtarı al.
3. `boga-kosusu` klasörüne gir. Windows'ta `BASLAT.bat`'a çift tıkla. Mac'te Terminal'e `bash ` yazıp `BASLAT-MAC.command` dosyasını sürükle ve Enter'a bas.
4. İlk açılışta `ayarlar.json` açılır: TikTok kullanıcı adını ve Euler anahtarını yaz, kaydet, kapat.
5. TikTok LIVE Studio'da **Pencere yakalama** ile **Boğa Koşusu** penceresini seç, yayını aç.

Adım adım anlatım ve sorun çözme: **[KURULUM.md](KURULUM.md)**

## İzleyici ne yapabilir?

| İzleyici | Yarışta |
|---|---|
| Lobi açıkken yorum yazar | Yarışa katılır, başlangıçta yerini alır |
| Yarışta `koş` / `hızlan` / `hadi` / `gaz` yazar | Kısa süre hızlanır |
| Beğeni atar | Koşucusu hızlanır |
| Takip eder / paylaşır | Turbo kazanır |
| Hediye atar | Turbo, kalkan (boğa yakalayamaz), jetpack, kırmızı pelerin (boğayı oyalar), roket (en öne uçar) |

Komutlarda büyük/küçük harf, Türkçe karakter ve harf uzatma fark etmez (`KOŞ`, `koşşş`, `Hızlan` hepsi çalışır).
