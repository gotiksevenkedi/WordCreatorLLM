# WordCreatorLLM - Türkçe Kelime Veritabanı

Bu uygulama ile herhangi bir API bağlanarak kelime yaratması sağlanabilir.
Uygulama Tamamen Cursor ve Claude 3.7 ile kodlanmıştır.
Ollama ve API desteği yer alır kendiniz modelleri ve API keyleri değiştirerek kullanabilirsiniz.

## Proje Hakkında

Bu uygulama, "kelimeler" dizininde A'dan Z'ye sıralanmış .txt dosyalarındaki Türkçe kelimeleri okur, her kelime için OpenRouter API üzerinden Mistral gibi gelişmiş LLM modellerini kullanarak detaylı bilgiler alır ve bu bilgileri yapılandırılmış bir SQLite veritabanında saklar.

### Temel Özellikler

- A'dan Z'ye sıralanmış .txt dosyalarından kelimeleri okuma
- OpenRouter API üzerinden gelişmiş LLM entegrasyonu ile her kelime için otomatik olarak:
  - Anlamı (TDK'ya uygun, sade açıklama)
  - Örnek cümle (doğal, günlük Türkçe)
  - Kategori (yalnızca yedi kategoriden biri: duygular, iş, sağlık, edebiyat, doğa, sanat, iletişim)
  - Zorluk seviyesi (basit, deneyimli, uzman) bilgilerini elde etme
- Kelime bilgilerini SQLite veritabanında saklama
- Kapsamlı hata yönetimi ve loglama
- İşlem sonu istatistikler

## Kurulum

### Gereksinimler

- Node.js (v16.0.0 veya üzeri)
- npm (v7.0.0 veya üzeri)
- OpenRouter API anahtarı (https://openrouter.ai adresinden ücretsiz olarak alabilirsiniz)

### Adımlar

1. Projeyi bilgisayarınıza klonlayın:
   ```bash
   git clone https://github.com/kullanici/turkce-kelime-database.git
   cd turkce-kelime-database
   ```

2. Gerekli paketleri yükleyin:
   ```bash
   npm install
   ```

3. `.env.example` dosyasını `.env` olarak kopyalayın ve OpenRouter API anahtarınızı ekleyin:
   ```bash
   cp .env.example .env
   # .env dosyasını açın ve OPENROUTER_API_KEY değişkenini API anahtarınızla güncelleyin
   ```

4. Kelime dosyalarını `kelimeler/` dizinine ekleyin:
   - Her dosya bir harfle başlayan kelimeleri içermelidir (örn. a.txt, b.txt, ..., z.txt)
   - Her kelime yeni bir satırda yer almalıdır

## Kullanım

Uygulamayı başlatmak için:

```bash
npm run start
```

Bu komut:
1. Kelime dosyalarını okur
2. Her kelime için OpenRouter API'sine istek gönderir
3. Alınan yanıtları ayrıştırır ve veritabanına kaydeder
4. İşlem sonunda istatistikler gösterir

## Veritabanı Yapısı

Uygulama, SQLite kullanarak `sozluk.db` adlı bir veritabanı oluşturur. Bu veritabanında `sozluk` adlı bir tablo bulunur ve şu kolonları içerir:

- `kelime` (PRIMARY KEY, TEXT): Türkçe kelime
- `anlam` (TEXT): Kelimenin anlamı
- `ornek` (TEXT): Örnek cümle
- `kategori` (TEXT): Kategori (duygular, iş, sağlık, edebiyat, doğa, sanat, iletişim)
- `zorluk` (TEXT): Zorluk seviyesi (basit, deneyimli, uzman)

## Proje Yapısı

```
turkce-kelime-database/
├── src/
│   ├── config/
│   │   └── config.ts         # Uygulama yapılandırma ayarları
│   ├── models/
│   │   └── types.ts          # TypeScript tip tanımlamaları
│   ├── services/
│   │   ├── fileService.ts    # Dosya okuma işlemleri
│   │   ├── apiService.ts     # Mistral API entegrasyonu
│   │   └── databaseService.ts # Veritabanı işlemleri
│   ├── utils/
│   │   └── logger.ts         # Loglama sistemi
│   └── index.ts              # Ana uygulama giriş noktası
├── kelimeler/
│   ├── a.txt                 # A harfiyle başlayan kelimeler
│   ├── b.txt                 # B harfiyle başlayan kelimeler
│   └── ...                   # Diğer harfler için dosyalar
├── .env                      # Çevre değişkenleri (gitignore'da)
├── .env.example              # Örnek çevre değişkenleri
├── package.json              # Npm paket yapılandırması
├── tsconfig.json             # TypeScript yapılandırması
└── README.md                 # Bu dosya
```

## Gelecek Geliştirmeler

- Web arayüzü: Veritabanını görüntülemek ve sorgulamak için basit bir web arayüzü
- İstatistik paneli: Kelime kategorileri ve zorluk seviyeleri hakkında istatistikler
- Genişletilmiş model entegrasyonu: Farklı LLM modelleri için destek (OpenRouter üzerinden erişilebilen GPU, Claude, Gemini vb.)
- Performans optimizasyonları: Daha büyük veri setleri için ek iyileştirmeler

## Hata Ayıklama

Uygulama çalışırken karşılaşılan hatalar hem konsola hem de `errors.log` ve `app.log` dosyalarına kaydedilir. Bir sorunla karşılaşırsanız, bu log dosyalarını kontrol edin.

## Lisans

MIT
