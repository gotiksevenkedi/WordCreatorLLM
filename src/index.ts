import { DatabaseService } from './services/databaseService';
import { ApiService } from './services/apiService';
import { 
  KelimeBilgisi, 
  LLMWordOutput, 
  KelimeKaydi, 
  ApiError, 
  JsonParseError, 
  NetworkError, 
  NoWordGeneratedError,
  DatabaseError,
  FileError 
} from './models/types';
import logger from './utils/logger';
import config from './config/config';

// Sadece bu kategoriler kabul edilecek
const KABUL_EDILEN_KATEGORILER = [
  'edebiyat', 'iletişim', 'tarih', 'sanat', 'müzik', 'yemek', 'tıp', 'iş', 'doğa', 'felsefe'
];

class TurkceKelimeDatabase {
  private dbService: DatabaseService;
  private apiService: ApiService;
  private readonly maxWords: number = 5000; 
  private readonly maxConsecutiveFailures = 20;

  constructor() {
    this.dbService = new DatabaseService(config.db.path);
    this.apiService = new ApiService();
  }

  async init(): Promise<void> {
    await this.dbService.initialize(); 
    logger.info('Veritabanı başarıyla başlatıldı.');
    // Eski kayıtlardan uygunsuz kategoride olanları sil
    const silinen = await this.dbService.kabulEdilmeyenKategorileriSil(KABUL_EDILEN_KATEGORILER);
    logger.info(`Veritabanı başlatılırken ${silinen} adet uygunsuz kategorideki kelime silindi.`);
  }

  async populateDatabaseWithLLM(): Promise<void> {
    logger.info(`Veritabanı LLM ile doldurulmaya başlanıyor. Hedef: ${this.maxWords} benzersiz kelime.`);
    let newWordsAddedThisSession = 0;
    let consecutiveFailures = 0;
    let totalAttempts = 0;
    const maxTotalAttempts = this.maxWords * 2; // Maksimum toplam deneme sayısı

    try {
      let currentWordCountInDb = await this.dbService.kelimeSayisiniGetir(); 

      while (currentWordCountInDb < this.maxWords && totalAttempts < maxTotalAttempts) {
        totalAttempts++;
        logger.info(
          `Mevcut kelime sayısı: ${currentWordCountInDb}. Kalan: ${this.maxWords - currentWordCountInDb}`
        );

        let llmOutputs: LLMWordOutput[] = [];
        try {
          llmOutputs = await this.apiService.fetchNicheTurkishWords();
          consecutiveFailures = 0; 
        } catch (error) {
          consecutiveFailures++;
          logger.error(`LLM'den kelime alma hatası (ardı ardına ${consecutiveFailures}. hata):`, error instanceof Error ? error.message : String(error));

          if (error instanceof NetworkError) {
            logger.warn('Ağ hatası oluştu. Bir süre sonra tekrar denenecek.');
            // Ağ hatalarında daha uzun süre bekleyelim
            const waitTime = config.api.requestDelayMs * Math.pow(2, Math.min(consecutiveFailures, 5));
            logger.info(`${waitTime}ms sonra tekrar denenecek.`);
            await new Promise(resolve => setTimeout(resolve, waitTime)); 
          } else if (error instanceof NoWordGeneratedError) {
            logger.warn('LLM bu denemede kelime üretemedi. Tekrar denenecek.');
          } else if (error instanceof JsonParseError) {
            logger.error('LLM yanıtı JSON olarak ayrıştırılamadı. Bu kelime atlanıyor. Detaylar loglarda.');
          } else if (error instanceof ApiError) {
            logger.error(`API Hatası: ${error.message}. Durum Kodu: ${error.statusCode || 'Bilinmiyor'}`);
            if (error.statusCode === 401 || error.statusCode === 403) {
              logger.error('Yetkilendirme hatası (401/403). API ayarlarınızı veya Ollama sunucu erişiminizi kontrol edin. İşlem durduruluyor.');
              break; 
            }
            
            // API hatalarında da biraz bekleyelim
            await new Promise(resolve => setTimeout(resolve, config.api.requestDelayMs * 2));
          } else {
            logger.error('Bilinmeyen bir hata türüyle karşılaşıldı. İşlem durduruluyor.');
            break; 
          }

          if (consecutiveFailures >= this.maxConsecutiveFailures) {
            logger.error(
              `${this.maxConsecutiveFailures} kez ardışık hata alındı. LLM API ile ilgili genel bir sorun olabilir veya yapılandırma hatalı. İşlem durduruluyor.`
            );
            break;
          }
          
          continue; 
        }

        // Birden fazla kelimeyi işle
        for (const llmOutput of llmOutputs) {
          if (llmOutput && llmOutput.kelime && llmOutput.bilgi) {
            const { kelime, bilgi } = llmOutput;
            // Kategori kontrolü
            const kategori = (bilgi.kategori || '').toLowerCase().trim();
            if (!KABUL_EDILEN_KATEGORILER.includes(kategori)) {
              logger.info(`Kelime "${kelime}" kategorisi ("${bilgi.kategori}") kabul edilenler arasında değil, eklenmeyecek.`);
              continue;
            }
            const isExisting = await this.dbService.kelimeVarMi(kelime); 

            if (isExisting) {
              logger.info(`Kelime "${kelime}" zaten veritabanında mevcut. Atlanıyor.`);
            } else {
              logger.info(`Yeni kelime "${kelime}" veritabanına ekleniyor.`);
              try {
                await this.dbService.kelimeEkle(kelime, bilgi); 
                newWordsAddedThisSession++;
                
                // Hedef sayıya ulaşıldıysa döngüden çık
                if (newWordsAddedThisSession + await this.dbService.kelimeSayisiniGetir() - 3 >= this.maxWords) {
                  logger.info(`Hedef kelime sayısına ulaşıldı (${this.maxWords}). İşlem tamamlanıyor.`);
                  break;
                }
              } catch (dbError) {
                logger.error(`Kelime "${kelime}" veritabanına eklenirken hata oluştu:`, dbError);
              }
            }
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, config.api.requestDelayMs / 2)); 
        currentWordCountInDb = await this.dbService.kelimeSayisiniGetir(); 
      }
    } catch (error) {
      logger.error('Veritabanı doldurulurken kritik bir hata oluştu:', error);
    } finally {
      const finalWordCount = await this.dbService.kelimeSayisiniGetir();
      logger.info(
        `Veritabanı doldurma işlemi sona erdi. Bu oturumda ${newWordsAddedThisSession} yeni kelime eklendi. Veritabanında toplam ${finalWordCount} kelime bulunuyor.`
      );
      await this.dbService.close(); 
    }
  }
}

(async () => {
  logger.info('Uygulama başlatılıyor...');
  const app = new TurkceKelimeDatabase();
  try {
    await app.init();
    await app.populateDatabaseWithLLM();
    logger.info('Uygulama başarıyla tamamlandı.');
    process.exit(0);
  } catch (error) {
    logger.error('Uygulama başlatılırken veya çalışırken kritik bir hata oluştu:', error);
    process.exit(1);
  }
})();
