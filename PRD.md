# Türkçe Kelime Veritabanı - Ürün Gereksinim Dokümanı (PRD)

## 1. Giriş

Türkçe Kelime Veritabanı, Türkçe kelimeleri Mistral LLM API kullanarak anlamlandıran ve SQLite veritabanında saklayan bir Node.js/TypeScript uygulamasıdır. Bu uygulama, Türkçe dilini öğrenen veya geliştirmek isteyen kullanıcılar için kapsamlı bir sözlük veritabanı oluşturmayı amaçlamaktadır.

## 2. Ürün Kapsamı

Bu proje, metin dosyalarından Türkçe kelimeleri okuyacak, her kelime için Mistral LLM API'sini kullanarak anlamsal veri toplayacak ve bu verileri yapılandırılmış bir SQLite veritabanında saklayacaktır.

## 3. Teknik Gereksinimler

### 3.1. Dosya Okuma Sistemi

- Uygulama, proje klasöründeki "kelimeler" dizininde bulunan .txt dosyalarını işleyecektir.
- Her .txt dosyası, belirli bir harfle başlayan kelimeleri içerecek şekilde A'dan Z'ye kadar isimlendirilmiştir.
- Dosya okuma işlemi asenkron olarak gerçekleştirilecek ve bellek verimliliği göz önünde bulundurulacaktır.

### 3.2. API Entegrasyonu

- Mistral LLM API'si ile entegrasyon yapılacaktır.
- Her kelime için API'ye şu bilgiler sorulacaktır:
  - Anlamı (TDK'ya uygun, sade açıklama)
  - Örnek cümle (doğal, günlük Türkçe)
  - Kategori (yalnızca şu yedi kategoriden biri: duygular, iş, sağlık, edebiyat, doğa, sanat, iletişim)
  - Zorluk seviyesi (basit, deneyimli, uzman)
- API istekleri, hız sınırlamaları ve sunucu yükünü dikkate alarak optimize edilecektir.

### 3.3. JSON Ayrıştırma

- API'den dönen yanıtlar JSON formatında ayrıştırılacaktır.
- Ayrıştırma işlemi tip güvenliği sağlayacak şekilde TypeScript arayüzleri kullanılarak yapılacaktır.

### 3.4. Veritabanı Yapılandırması

- SQLite veritabanı kullanılarak `sozluk.db` adlı bir veritabanı oluşturulacaktır.
- Veritabanında `sozluk` adlı bir tablo bulunacaktır.
- Tablo şu kolonlardan oluşacaktır:
  - `kelime` (PRIMARY KEY, TEXT): Türkçe kelime
  - `anlam` (TEXT): Kelimenin anlamı
  - `ornek` (TEXT): Örnek cümle
  - `kategori` (TEXT): Kategori (duygular, iş, sağlık, edebiyat, doğa, sanat, iletişim)
  - `zorluk` (TEXT): Zorluk seviyesi (basit, deneyimli, uzman)
- `kelime` alanı benzersiz olacak, bu sayede mükerrer kayıt engellenecektir.

### 3.5. Hata Yönetimi

- Uygulama, çeşitli hata durumlarını ele alacak şekilde tasarlanacaktır:
  - Dosya okuma hataları
  - API bağlantı hataları
  - API yanıt format hataları
  - JSON ayrıştırma hataları
  - Veritabanı işlem hataları
- Tüm hatalar loglama sistemi ile kaydedilecek ve uygulama hatalar nedeniyle çökmeden çalışmaya devam edecektir.
- Hata alınan kelimeler için tekrar deneme mekanizması eklenecektir.

## 4. Uygulama Mimarisi

### 4.1. Proje Yapısı

```
turkce-kelime-database/
├── src/
│   ├── config/
│   │   └── config.ts
│   ├── models/
│   │   └── types.ts
│   ├── services/
│   │   ├── fileService.ts
│   │   ├── apiService.ts
│   │   └── databaseService.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   └── helpers.ts
│   └── index.ts
├── kelimeler/
│   ├── a.txt
│   ├── b.txt
│   └── ...
├── package.json
├── tsconfig.json
└── README.md
```

### 4.2. Modüller ve Sorumluluklar

- **fileService**: Kelime dosyalarını okumak ve işlemekten sorumlu
- **apiService**: Mistral LLM API ile iletişim kurmak ve yanıtları almaktan sorumlu
- **databaseService**: SQLite veritabanı işlemlerini yönetmekten sorumlu
- **logger**: Uygulama genelinde loglama sağlamaktan sorumlu
- **config**: Uygulama yapılandırma parametrelerini içeren modül
- **types**: TypeScript tip tanımlamalarını içeren modül

## 5. Dış Bağımlılıklar

Proje aşağıdaki temel npm paketlerine ihtiyaç duyacaktır:

- `typescript`: TypeScript desteği
- `ts-node`: TypeScript kodunu çalıştırmak için
- `sqlite3`: SQLite veritabanı erişimi
- `axios`: HTTP istekleri için
- `dotenv`: Ortam değişkenleri için
- `winston`: Loglama için
- Mistral LLM API istemcisi veya uyumlu alternatif

## 6. Performans Gereksinimleri

- Uygulama, büyük kelime listeleriyle başa çıkabilecek şekilde optimize edilecektir.
- Veritabanı işlemleri toplu olarak gerçekleştirilerek performans artırılacaktır.
- API istekleri paralel olarak yönetilecek, ancak hız sınırlarına uyulacaktır.

## 7. Güvenlik Gereksinimleri

- API anahtarları ve diğer hassas bilgiler `.env` dosyasında saklanacaktır.
- `.env` dosyası git izleme sistemine dahil edilmeyecektir.
- Kullanıcı girdisi olan kelime dosyaları, güvenlik açıkları önlemek için düzgün şekilde doğrulanacaktır.

## 8. Kurulum ve Kullanım

- Proje, açık kaynak npm paketleri kullanılarak kolayca kurulabilecektir.
- Kurulum ve kullanım talimatları README.md dosyasında detaylı olarak belirtilecektir.
- `npm run start` komutu ile uygulama başlatılabilecektir.

## 9. Test Planı

- Birim testleri: Her bir hizmet modülü için birim testleri yazılacaktır.
- Entegrasyon testleri: API ve veritabanı entegrasyonları için testler yapılacaktır.
- Uçtan uca testler: Tam uygulama akışı için testler gerçekleştirilecektir.

## 10. Gelecek Geliştirmeler

- Web arayüzü: Veritabanını görüntülemek ve sorgulamak için basit bir web arayüzü eklenebilir.
- İstatistik paneli: Kelime kategorileri ve zorluk seviyeleri hakkında istatistikler sunulabilir.
- Genişletilmiş API entegrasyonu: Alternatif LLM API'leri için destek eklenebilir.
- Performans optimizasyonları: Daha büyük veri setleri için ek optimizasyonlar yapılabilir.

## 11. Sürüm Planlaması

**v1.0.0 (İlk Sürüm)**
- Temel dosya okuma işlevselliği
- Mistral LLM API entegrasyonu
- SQLite veritabanı entegrasyonu
- Temel hata yönetimi

**v1.1.0**
- Geliştirilmiş hata işleme
- Performans optimizasyonları
- Daha kapsamlı loglama

**v2.0.0**
- Web arayüzü
- İstatistik paneli
- Genişletilmiş API desteği
