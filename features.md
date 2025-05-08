# Türkçe Kelime Veritabanı - Özellikler

Bu doküman, Türkçe Kelime Veritabanı projesinin temel ve gelişmiş özelliklerini detaylandırmaktadır.

## Temel Özellikler (v1.0.0)

### 1. Kelime Dosyalarını Okuma
- **Özellik**: Projedeki "kelimeler" dizinindeki A'dan Z'ye kadar olan .txt dosyalarını okuma
- **Fayda**: Türkçe kelimeleri sistematik bir şekilde işleme
- **Kriterler**: 
  - Asenkron dosya okuma
  - Her kelimeyi ayrı ayrı işleme
  - Dosya okuma hatalarını yönetme

### 2. Mistral LLM API Entegrasyonu
- **Özellik**: Her kelime için Mistral LLM API'sinden veri çekme
- **Fayda**: Kelimelerin anlamını, örnek cümlelerini ve kategorilerini otomatik olarak elde etme
- **Kriterler**:
  - API istek hız sınırlamalarına uygun şekilde çalışma
  - Her kelime için aşağıdaki bilgileri çekme:
    - Anlamı (TDK'ya uygun, sade açıklama)
    - Örnek cümle (doğal, günlük Türkçe)
    - Kategori (yalnızca yedi kategoriden biri: duygular, iş, sağlık, edebiyat, doğa, sanat, iletişim)
    - Zorluk seviyesi (basit, deneyimli, uzman)

### 3. JSON Veri İşleme
- **Özellik**: API yanıtlarını JSON formatında ayrıştırma
- **Fayda**: Yapılandırılmış veri elde etme
- **Kriterler**:
  - Tip güvenliği sağlayan TypeScript arayüzleri
  - JSON ayrıştırma hatalarını yönetme

### 4. SQLite Veritabanı
- **Özellik**: Verileri `sozluk.db` adlı SQLite veritabanında saklama
- **Fayda**: Hızlı veri sorgulama ve yönetim
- **Kriterler**:
  - `sozluk` tablosu oluşturma
  - Aşağıdaki kolonları içeren tablo yapısı:
    - `kelime` (PRIMARY KEY, TEXT)
    - `anlam` (TEXT)
    - `ornek` (TEXT)
    - `kategori` (TEXT)
    - `zorluk` (TEXT)
  - Mükerrer kayıtları engelleme (PRIMARY KEY kontrolü)

### 5. Hata Yönetimi
- **Özellik**: Çeşitli hata senaryolarını yönetme
- **Fayda**: Uygulamanın kesintisiz çalışması
- **Kriterler**:
  - Dosya okuma hatalarını loglama ve devam etme
  - API hatalarını yönetme
  - JSON ayrıştırma hatalarını yönetme
  - Veritabanı hatalarını yönetme
  - Kritik olmayan hatalarda uygulamanın çökmeden devam etmesi

## Gelişmiş Özellikler (v1.1.0 ve v2.0.0)

### 1. Geliştirilmiş Hata İşleme (v1.1.0)
- **Özellik**: Daha kapsamlı hata yönetimi ve yeniden deneme mekanizmaları
- **Fayda**: Daha güvenilir ve dayanıklı uygulama
- **Kriterler**:
  - Hata alınan kelimeler için belirli sayıda yeniden deneme
  - Hata türüne göre özelleştirilmiş işleme stratejileri

### 2. Performans Optimizasyonları (v1.1.0)
- **Özellik**: Daha hızlı veri işleme ve API istekleri
- **Fayda**: Daha verimli kaynak kullanımı
- **Kriterler**:
  - Paralel API istekleri (hız sınırlamalarına dikkat ederek)
  - Toplu veritabanı işlemleri

### 3. Kapsamlı Loglama (v1.1.0)
- **Özellik**: Detaylı loglama sistemi
- **Fayda**: Daha iyi hata ayıklama ve izleme
- **Kriterler**:
  - Farklı log seviyeleri (bilgi, uyarı, hata)
  - Tarih ve saat damgalı loglar
  - İşlem istatistikleri

### 4. Web Arayüzü (v2.0.0)
- **Özellik**: Veritabanını görüntülemek için web tabanlı arayüz
- **Fayda**: Kullanıcı dostu veri erişimi
- **Kriterler**:
  - Kelime arama
  - Kategoriye ve zorluk seviyesine göre filtreleme
  - Kelime ekleme/düzenleme

### 5. İstatistik Paneli (v2.0.0)
- **Özellik**: Veritabanı içeriğiyle ilgili istatistikler
- **Fayda**: Veritabanının içeriğini analiz etme
- **Kriterler**:
  - Kategori dağılımı
  - Zorluk seviyesi dağılımı
  - Toplam kelime sayısı ve diğer ilgili metrikleri

### 6. Genişletilmiş API Entegrasyonu (v2.0.0)
- **Özellik**: Alternatif LLM API'leri desteği
- **Fayda**: Çeşitli veri kaynaklarından yararlanma
- **Kriterler**:
  - Farklı LLM API'leri için adaptörler
  - API yanıtlarını standartlaştırma
