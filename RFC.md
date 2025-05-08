# Türkçe Kelime Veritabanı - RFC (Request for Comments)

## 1. Özet

Bu RFC, Türkçe kelimeler için Mistral LLM API kullanarak anlamlandırma ve SQLite veritabanında saklama işlemlerini gerçekleştirecek bir Node.js/TypeScript uygulamasının teknik tasarımını detaylandırmaktadır. Uygulamanın amacı, Türkçe kelimeleri anlamları, örnek cümleleri, kategorileri ve zorluk seviyeleri ile birlikte yapılandırılmış bir veritabanında saklamaktır.

## 2. Motivasyon

Türkçe dilini öğrenen veya geliştirmek isteyen kişiler için kapsamlı bir sözlük veritabanı oluşturmak, dil öğrenimini kolaylaştıracak ve zenginleştirecektir. Modern LLM teknolojileri kullanarak otomatikleştirilmiş bir kelime anlamlandırma sistemi, manuel sözlük oluşturma sürecini hızlandıracak ve standartlaştıracaktır.

## 3. Tasarım Kararları

### 3.1. Teknoloji Seçimi

**Node.js/TypeScript**: Asenkron I/O operasyonları ve tip güvenliği için ideal bir kombinasyon sunar.

**SQLite**: Kurulum gerektirmeyen, taşınabilir ve yeterince hızlı bir veritabanı çözümü olarak seçilmiştir. Uygulama şu an için birden fazla kullanıcı tarafından eşzamanlı erişim gerektirmediği için uygun bir çözümdür.

**Mistral LLM API**: Türkçe dil desteği ve doğal dil işleme yetenekleri nedeniyle seçilmiştir.

### 3.2. Uygulama Mimarisi

Uygulama, aşağıdaki ana bileşenlerden oluşacaktır:

1. **Dosya Okuma Servisi**: Kelime dosyalarını asenkron olarak okuyacak.
2. **API Servisi**: Mistral LLM API ile iletişim kuracak.
3. **Veritabanı Servisi**: SQLite veritabanı işlemlerini yönetecek.
4. **Loglama Servisi**: Uygulama genelinde loglama sağlayacak.

Her bir servis, tek sorumluluk prensibi (SRP) doğrultusunda tasarlanacak ve aralarındaki bağımlılıklar dependency injection yöntemiyle yönetilecektir.

## 4. API İstek Formatı ve Yanıt İşleme

### 4.1. İstek Formatı

Mistral LLM API'sine gönderilecek istek formatı:

```typescript
interface ApiRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user';
    content: string;
  }>;
}
```

Sistem mesajı aşağıdaki gibi olacaktır:

```
Sen Türkçe Dil Kurumu standartlarına uygun, tutarlı bilgi veren bir dil asistanısın. Sana verilen Türkçe kelimeyle ilgili şu bilgileri JSON formatında sağlayacaksın:
1. Anlamı (TDK'ya uygun, sade açıklama)
2. Örnek cümle (doğal, günlük Türkçe)
3. Kategori (sadece bu seçeneklerden birini seç: duygular, iş, sağlık, edebiyat, doğa, sanat, iletişim)
4. Zorluk seviyesi (sadece bu seçeneklerden birini seç: basit, deneyimli, uzman)

Yanıtını şu JSON formatında ver, açıklama ekleme:
{
  "anlam": "kelimenin anlamı",
  "ornek": "örnek cümle",
  "kategori": "kategori adı",
  "zorluk": "zorluk seviyesi"
}
```

### 4.2. Yanıt İşleme

API yanıtları, sıkı bir TypeScript arayüzü ile doğrulanacaktır:

```typescript
interface KelimeBilgisi {
  anlam: string;
  ornek: string;
  kategori: 'duygular' | 'iş' | 'sağlık' | 'edebiyat' | 'doğa' | 'sanat' | 'iletişim';
  zorluk: 'basit' | 'deneyimli' | 'uzman';
}
```

### 4.3. Veritabanı Şeması

SQLite veritabanı aşağıdaki şema ile oluşturulacaktır:

```sql
CREATE TABLE IF NOT EXISTS sozluk (
  kelime TEXT PRIMARY KEY,
  anlam TEXT NOT NULL,
  ornek TEXT NOT NULL,
  kategori TEXT CHECK(kategori IN ('duygular', 'iş', 'sağlık', 'edebiyat', 'doğa', 'sanat', 'iletişim')) NOT NULL,
  zorluk TEXT CHECK(zorluk IN ('basit', 'deneyimli', 'uzman')) NOT NULL
);
```

## 5. İş Akışı

1. Uygulama başlatılır.
2. "kelimeler" dizinindeki .txt dosyaları taranır.
3. Her bir kelime dosyasındaki kelimeler okunur.
4. Her kelime için:
   - Veritabanında kelime kontrol edilir, varsa atlanır.
   - Mistral LLM API'sine istek gönderilir.
   - Yanıt JSON formatında ayrıştırılır.
   - Yanıt veritabanına kaydedilir.
5. Herhangi bir hata durumunda log kaydı tutulur ve işleme devam edilir.
6. Tüm dosyaların işlenmesi tamamlandığında özet istatistikler gösterilir.

## 6. Hız Sınırlaması ve Performans Optimizasyonları

### 6.1. API İstek Yönetimi

Mistral LLM API'nin hız sınırlamalarını aşmamak için bir istek kuyruğu (request queue) ve hız sınırlayıcı (rate limiter) mekanizması uygulanacaktır:

```typescript
class ApiRateLimiter {
  private queue: Array<() => Promise<void>> = [];
  private processing: boolean = false;
  private readonly requestsPerMinute: number = 60; // Örnek değer, API sağlayıcısına göre ayarlanmalı
  
  async enqueue(apiCall: () => Promise<any>): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await apiCall();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      if (!this.processing) {
        this.processQueue();
      }
    });
  }
  
  private async processQueue() {
    this.processing = true;
    
    while (this.queue.length > 0) {
      const apiCall = this.queue.shift();
      if (apiCall) {
        await apiCall();
        await new Promise(resolve => setTimeout(resolve, 60000 / this.requestsPerMinute));
      }
    }
    
    this.processing = false;
  }
}
```

### 6.2. Veritabanı Optimizasyonları

Veritabanı işlemlerinde performansı artırmak için:

1. İşlemleri tek bir transaction içinde yürütme
2. Prepared statement kullanımı
3. İndeksleme stratejileri

```typescript
async function storeWordBatch(words: Array<{ kelime: string, bilgi: KelimeBilgisi }>): Promise<void> {
  const db = await openDatabase();
  
  try {
    await db.run('BEGIN TRANSACTION');
    
    const stmt = await db.prepare(
      'INSERT OR IGNORE INTO sozluk (kelime, anlam, ornek, kategori, zorluk) VALUES (?, ?, ?, ?, ?)'
    );
    
    for (const { kelime, bilgi } of words) {
      await stmt.run(kelime, bilgi.anlam, bilgi.ornek, bilgi.kategori, bilgi.zorluk);
    }
    
    await stmt.finalize();
    await db.run('COMMIT');
  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  } finally {
    await db.close();
  }
}
```

## 7. Hata Yönetimi Stratejisi

### 7.1. Hata Kategorileri

1. **Dosya Erişim Hataları**: Dosya bulunamadığında veya okunamadığında
2. **API Hataları**: API yanıt vermediğinde veya beklenmeyen yanıt döndüğünde
3. **JSON Ayrıştırma Hataları**: API yanıtı beklenen formatta olmadığında
4. **Veritabanı Hataları**: Veritabanı işlemleri başarısız olduğunda

### 7.2. Hata İşleme Stratejisi

```typescript
async function processWord(kelime: string): Promise<boolean> {
  try {
    // Kelimeyi işle
    const apiResponse = await apiService.queryWord(kelime);
    const parsedResponse = parseApiResponse(apiResponse);
    await dbService.storeWord(kelime, parsedResponse);
    return true;
  } catch (error) {
    if (error instanceof ApiError) {
      logger.error(`API error for word "${kelime}": ${error.message}`);
      // API hatası için yeniden deneme mantığı
      return await retryApiCall(kelime, MAX_RETRY_ATTEMPTS);
    } else if (error instanceof JsonParseError) {
      logger.error(`JSON parsing error for word "${kelime}": ${error.message}`);
      // JSON yanıtını düzeltme veya alternatif çözümler
    } else if (error instanceof DatabaseError) {
      logger.error(`Database error for word "${kelime}": ${error.message}`);
      // Veritabanı hatası için yeniden deneme veya geçici çözümler
    } else {
      logger.error(`Unexpected error processing word "${kelime}": ${error.message}`);
    }
    return false;
  }
}
```

## 8. Alternatifler ve Tartışma Konuları

### 8.1. Alternatif Veritabanı Çözümleri

**SQLite Yerine PostgreSQL**:
- Avantajlar: Daha güçlü sorgu yetenekleri, çoklu eşzamanlı erişim.
- Dezavantajlar: Kurulum gerektirmesi, daha karmaşık yapılandırma.

**SQLite Yerine JSON Dosyası**:
- Avantajlar: Kurulum gerektirmemesi, basitlik.
- Dezavantajlar: Sorgu yeteneklerinin sınırlı olması, performans sorunları.

### 8.2. Alternatif API Yaklaşımları

**Toplu API İstekleri**:
- Avantajlar: Daha az API çağrısı, potansiyel olarak daha düşük maliyet.
- Dezavantajlar: Daha karmaşık istek ve yanıt yapısı, hata yönetiminin zorlaşması.

## 9. Güvenlik Konuları

1. **API Anahtarı Yönetimi**: API anahtarları `.env` dosyasında saklanacak ve git kontrolünden hariç tutulacaktır.
2. **Kullanıcı Girdisi Doğrulama**: Dosyalardan okunan kelimeler işlenmeden önce doğrulanacaktır.
3. **SQL Enjeksiyon Koruması**: Parametreli sorgular (prepared statements) kullanılarak SQL enjeksiyon saldırılarına karşı koruma sağlanacaktır.

## 10. Sonuç

Bu RFC, Türkçe Kelime Veritabanı uygulamasının teknik yaklaşımını ve tasarım kararlarını belgelemektedir. Burada tanımlanan teknolojiler ve yaklaşımlar, projenin başarılı bir şekilde uygulanması için uygun bir temel oluşturmaktadır.

Uygulanacak olan yapı, gelecekteki genişletmelere (web arayüzü, istatistik paneli, alternatif API entegrasyonları) izin verecek şekilde modüler ve esnek olarak tasarlanmıştır.
