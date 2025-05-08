import { DatabaseService } from './services/databaseService';
import { KelimeBilgisi } from './models/types';
import logger from './utils/logger';

/**
 * Basit kelimeler için manuel veri ekleme
 */
async function manuelKelimelerEkle(): Promise<void> {
  try {
    logger.info('Manuel kelimeler ekleniyor...');
    
    const dbService = new DatabaseService();
    await dbService.initialize();

    // Basit kelimeler listesi ve bilgileri
    const kelimeler: Array<{kelime: string, bilgi: KelimeBilgisi}> = [
      {
        kelime: 'aile',
        bilgi: {
          anlam: 'Evlilik ve kan bağına dayanan, karı, koca, çocuklar, kardeşler arasındaki ilişkilerin oluşturduğu toplum içindeki en küçük birlik',
          ornek: 'Bu hafta sonu ailemle pikniğe gideceğiz.',
          kategori: 'duygular',
          zorluk: 'basit'
        }
      },
      {
        kelime: 'akıl',
        bilgi: {
          anlam: 'Düşünme, anlama ve kavrama yeteneği, us',
          ornek: 'Bu sorunun çözümünü bulmak için aklımı çok yordum.',
          kategori: 'sağlık',
          zorluk: 'basit'
        }
      },
      {
        kelime: 'su',
        bilgi: {
          anlam: 'Hidrojen ve oksijenden oluşan, renksiz, kokusuz, tatsız sıvı',
          ornek: 'Her gün en az iki litre su içmeye çalışıyorum.',
          kategori: 'doğa',
          zorluk: 'basit'
        }
      },
      {
        kelime: 'kitap',
        bilgi: {
          anlam: 'Ciltli veya ciltsiz olarak bir araya getirilmiş, basılı veya yazılı sayfalardan oluşan yayın',
          ornek: 'Akşamları yatmadan önce kitap okumayı seviyorum.',
          kategori: 'edebiyat',
          zorluk: 'basit'
        }
      },
      {
        kelime: 'güneş',
        bilgi: {
          anlam: 'Gezegenlere ve yer yüzüne ısı ve ışık veren büyük gök cismi',
          ornek: 'Güneş batarken manzara çok güzeldi.',
          kategori: 'doğa',
          zorluk: 'basit'
        }
      }
    ];

    // Kelimeleri veritabanına ekle
    await dbService.kelimeTopluEkle(kelimeler);
    
    logger.info('Manuel kelimeler başarıyla eklendi');
    
    // Bilgileri göster
    const toplamKelime = await dbService.kelimeSayisiniGetir();
    logger.info(`Veritabanında toplam ${toplamKelime} kelime var`);
    
    // Veritabanı bağlantısını kapat
    await dbService.close();
    
  } catch (error) {
    logger.error(`Manuel kelimeler eklenirken hata: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Fonksiyonu çağır
manuelKelimelerEkle();
