import { exec } from 'child_process';
import util from 'util';
import axios from 'axios';
import config from '../config/config';
import { LLMWordOutput, KelimeBilgisi, ApiError, NetworkError, NoWordGeneratedError, JsonParseError } from '../models/types';
import logger from '../utils/logger';

const execPromise = util.promisify(exec);

const MAX_RETRY_ATTEMPTS = config.api.maxRetryAttempts;
const REQUEST_DELAY_MS = config.api.requestDelayMs;
const CLI_TIMEOUT_MS = 20000; // 20 saniye timeout
const MAX_CACHE_SIZE = 50; // Önbellek boyutunu artırdık
const DEFAULT_BATCH_SIZE = 10; // Her seferde 10 kelime döndürüyoruz

/**
 * Ollama için prompt oluşturur.
 * Artık birden fazla benzersiz kelime isteyen bir format kullanır.
 */
function generateOllamaPrompt(): string {
  return `Lütfen 10 tane az bilinen, çok farklı ve birbirinden benzersiz Türkçe kelime üret. 
Her bir kelime için anlamını, örnek cümlesini, varsa eş anlamlılarını, zıt anlamlılarını ve kategorisini belirt.
Kelimelerin ilgi alanları ve kategorileri çeşitli olsun (sanat, edebiyat, bilim, tıp, felsefe vb.).
Yanıtını aşağıdaki JSON formatında ver:

[
  {
    "kelime": "...",
    "tanim": "...",
    "ornek_cumle": "...",
    "es_anlamlilari": ["...", "..."],
    "zit_anlamlilari": ["...", "..."],
    "kategori": "..."
  },
  {
    "kelime": "...",
    "tanim": "...",
    "ornek_cumle": "...",
    "es_anlamlilari": ["...", "..."],
    "zit_anlamlilari": ["...", "..."],
    "kategori": "..."
  }
]

Lütfen çok nadir kullanılan, gerçek Türkçe kelimeler ver ve tüm kelimeler birbirinden tamamen farklı olsun.`;
}

/**
 * Groq API için prompt oluşturur.
 * Artık birden fazla benzersiz kelime isteyen bir format kullanır.
 */
function generateGroqPrompt(): string {
  return `Lütfen 10 tane az bilinen, çok farklı ve birbirinden benzersiz Türkçe kelime üret. 
Her bir kelime için anlamını, örnek cümlesini, varsa eş anlamlılarını, zıt anlamlılarını ve kategorisini belirt.
Kelimelerin ilgi alanları ve kategorileri çeşitli olsun (sanat, edebiyat, bilim, tıp, felsefe vb.).
Yanıtını aşağıdaki JSON formatında ver:

[
  {
    "kelime": "...",
    "tanim": "...",
    "ornek_cumle": "...",
    "es_anlamlilari": ["...", "..."],
    "zit_anlamlilari": ["...", "..."],
    "kategori": "..."
  },
  {
    "kelime": "...",
    "tanim": "...",
    "ornek_cumle": "...",
    "es_anlamlilari": ["...", "..."],
    "zit_anlamlilari": ["...", "..."],
    "kategori": "..."
  }
]

Lütfen çok nadir kullanılan, gerçek Türkçe kelimeler ver ve tüm kelimeler birbirinden tamamen farklı olsun. 
Sadece JSON dizisi döndür, başka açıklama ekleme.`;
}

// Komut satırı argümanları için kaçış fonksiyonu
function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

export class ApiService {
  private ollamaModelName: string | undefined;
  private groqConfig: {
    apiKey: string;
    apiUrl: string;
    modelName: string;
  } | undefined;
  private cachedWords: LLMWordOutput[] = [];
  private usedWords: Set<string> = new Set(); // Kullanılmış kelimeleri takip etmek için set

  constructor() {
    // Groq API kontrolü
    if (config.groq?.apiKey && config.groq?.apiUrl && config.groq?.modelName) {
      this.groqConfig = {
        apiKey: config.groq.apiKey,
        apiUrl: config.groq.apiUrl,
        modelName: config.groq.modelName
      };
      logger.info(`ApiService Groq API ile başlatıldı. Kullanılacak model: ${config.groq.modelName}`);
    } 
    // Ollama modelName kontrolü - geriye dönük uyumluluk
    else if (config.ollama?.modelName) {
      this.ollamaModelName = config.ollama.modelName;
      logger.info(`ApiService Ollama CLI ile başlatıldı. Kullanılacak model: ${config.ollama.modelName}`);
    }
    // Hiçbir API yapılandırılmamış
    else {
      logger.error('Groq API veya Ollama yapılandırması eksik. ApiService başlatılamadı.');
      throw new Error('API yapılandırması eksik. En az bir API yapılandırılmalıdır.');
    }
  }

  /**
   * Groq API kullanarak Türkçe kelime bilgisi listesi alır.
   */
  private async getWordsFromGroq(): Promise<LLMWordOutput[]> {
    if (!this.groqConfig) {
      throw new Error('Groq API yapılandırması eksik.');
    }

    const prompt = generateGroqPrompt();
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.groqConfig.apiKey}`
    };

    const data = {
      model: this.groqConfig.modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9, // Çeşitlilik için sıcaklığı artırıyoruz
      max_tokens: 2000 // 10 kelime için daha fazla token gerekli
    };

    logger.info('Groq API isteği hazırlanıyor...', { model: this.groqConfig.modelName });

    const requestStartTime = Date.now();
    logger.info(`[${requestStartTime}] Groq API isteği gönderiliyor...`);

    try {
      const response = await axios.post(this.groqConfig.apiUrl, data, { 
        headers,
        timeout: 60000 // 60 saniye timeout (daha uzun bir işlem)
      });

      const requestEndTime = Date.now();
      logger.info(`[${requestEndTime}] Groq API yanıtı alındı. Süre: ${requestEndTime - requestStartTime}ms`);

      const responseContent = response.data?.choices?.[0]?.message?.content;
      if (!responseContent) {
        logger.error('Groq API yanıtı geçersiz:', response.data);
        throw new NoWordGeneratedError('Groq API geçersiz yanıt döndürdü.');
      }

      logger.debug('Groq API Ham Yanıt:', responseContent);

      // JSON formatını içeren metin parçasını ayıkla - dizi formatı için düzenlenmiş regex
      const jsonMatch = responseContent.match(/\[\s*{[\s\S]*}\s*\]/);
      
      if (!jsonMatch || !jsonMatch[0]) {
        logger.error('Groq API yanıtında JSON dizisi formatı bulunamadı.', responseContent);
        throw new JsonParseError('Groq API yanıtında JSON dizisi formatı bulunamadı.');
      }

      const jsonString = jsonMatch[0];
      try {
        const wordsArray = JSON.parse(jsonString);
        
        if (!Array.isArray(wordsArray) || wordsArray.length === 0) {
          logger.warn('Kelime dizisi boş veya geçersiz:', wordsArray);
          throw new NoWordGeneratedError('Groq API geçersiz bir kelime dizisi döndürdü.');
        }
        
        const result: LLMWordOutput[] = [];
        
        // Her kelimeyi LLMWordOutput formatına dönüştür
        for (const wordObj of wordsArray) {
          if (!wordObj.kelime || !wordObj.tanim) {
            logger.warn('Kelime nesnesi gerekli alanları içermiyor:', wordObj);
            continue; // Bu kelimeyi atla ama tamamen başarısız olma
          }
          
          const kelimeBilgisi: KelimeBilgisi = {
            tanim: wordObj.tanim,
            ornek_cumle: wordObj.ornek_cumle || "Örnek cümle bulunamadı.",
            kategori: wordObj.kategori || 'edebiyat',
            es_anlamlilari: Array.isArray(wordObj.es_anlamlilari) ? wordObj.es_anlamlilari : [],
            zit_anlamlilari: Array.isArray(wordObj.zit_anlamlilari) ? wordObj.zit_anlamlilari : [],
            kaynak: `Groq-API/${this.groqConfig.modelName}`,
          };
          
          result.push({
            kelime: wordObj.kelime,
            bilgi: kelimeBilgisi,
          });
        }
        
        logger.info(`Groq API'den ${result.length} kelime başarıyla alındı.`);
        return result;
        
      } catch (parseError) {
        logger.error('JSON parse hatası:', parseError);
        throw new JsonParseError(`JSON parse hatası: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
    } catch (error: any) {
      const requestEndTime = Date.now();
      logger.error(`[${requestEndTime}] Groq API isteği başarısız. Süre: ${requestEndTime - requestStartTime}ms. Hata:`, error);
      const errorMessage = error.response?.data?.error?.message || error.message;
      throw new NetworkError(`Groq API isteği başarısız: ${errorMessage}`);
    }
  }

  /**
   * Ollama CLI kullanarak Türkçe kelime bilgisi listesi alır.
   */
  private async getWordsFromOllama(): Promise<LLMWordOutput[]> {
    if (!this.ollamaModelName) {
      throw new Error('Ollama model adı yapılandırması eksik.');
    }

    const prompt = generateOllamaPrompt();
    const escapedPrompt = escapeShellArg(prompt);
    // Birden fazla kelime için daha uzun bir timeout değeri
    const command = `ollama run ${this.ollamaModelName} ${escapedPrompt}`;

    logger.info('Ollama CLI komutu hazırlanıyor...', { model: this.ollamaModelName });
    logger.debug('Çalıştırılacak Komut:', command);

    const requestStartTime = Date.now();
    logger.info(`[${requestStartTime}] Ollama CLI komutu çalıştırılıyor...`);

    try {
      const { stdout, stderr } = await execPromise(command, { timeout: CLI_TIMEOUT_MS * 3 }); // Daha uzun timeout

      const requestEndTime = Date.now();
      logger.info(`[${requestEndTime}] Ollama CLI yanıtı alındı. Süre: ${requestEndTime - requestStartTime}ms`);

      if (stderr) {
        logger.warn(`Ollama CLI stderr çıktısı: ${stderr}`);
      }

      if (stdout) {
        const responseContent = stdout.trim();
        logger.debug('Ollama CLI Ham Yanıt:', responseContent);

        // JSON formatını içeren metin parçasını ayıkla - dizi formatı için düzenlenmiş regex
        const jsonMatch = responseContent.match(/\[\s*{[\s\S]*}\s*\]/);
        
        if (!jsonMatch || !jsonMatch[0]) {
          logger.error('Ollama CLI yanıtında JSON dizisi formatı bulunamadı.', responseContent);
          throw new JsonParseError('Ollama CLI yanıtında JSON dizisi formatı bulunamadı.');
        }

        const jsonString = jsonMatch[0];
        try {
          const wordsArray = JSON.parse(jsonString);
          
          if (!Array.isArray(wordsArray) || wordsArray.length === 0) {
            logger.warn('Kelime dizisi boş veya geçersiz:', wordsArray);
            throw new NoWordGeneratedError('Ollama CLI geçersiz bir kelime dizisi döndürdü.');
          }
          
          const result: LLMWordOutput[] = [];
          
          // Her kelimeyi LLMWordOutput formatına dönüştür
          for (const wordObj of wordsArray) {
            if (!wordObj.kelime || !wordObj.tanim) {
              logger.warn('Kelime nesnesi gerekli alanları içermiyor:', wordObj);
              continue; // Bu kelimeyi atla ama tamamen başarısız olma
            }
            
            const kelimeBilgisi: KelimeBilgisi = {
              tanim: wordObj.tanim,
              ornek_cumle: wordObj.ornek_cumle || "Örnek cümle bulunamadı.",
              kategori: wordObj.kategori || 'edebiyat',
              es_anlamlilari: Array.isArray(wordObj.es_anlamlilari) ? wordObj.es_anlamlilari : [],
              zit_anlamlilari: Array.isArray(wordObj.zit_anlamlilari) ? wordObj.zit_anlamlilari : [],
              kaynak: `Ollama-CLI/${this.ollamaModelName}`,
            };
            
            result.push({
              kelime: wordObj.kelime,
              bilgi: kelimeBilgisi,
            });
          }
          
          logger.info(`Ollama CLI'dan ${result.length} kelime başarıyla alındı.`);
          return result;
          
        } catch (parseError) {
          logger.error('JSON parse hatası:', parseError);
          throw new JsonParseError(`JSON parse hatası: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        }
      } else {
        logger.warn('Ollama CLI stdout çıktısı boş.');
        throw new NoWordGeneratedError('Ollama CLI çıktısı boş.');
      }

    } catch (error: any) {
      const requestEndTime = Date.now();
      logger.error(`[${requestEndTime}] Ollama CLI komutu çalıştırılırken hata oluştu. Süre: ${requestEndTime - requestStartTime}ms. Hata:`, error);
      const errorMessage = error.killed ? 'Timeout' : (error.stderr || error.message);
      throw new NetworkError(`Ollama CLI komutu başarısız: ${errorMessage}`);
    }
  }

  /**
   * Tercih edilen API'den bir dizi kelime almayı dener, başarısız olursa alternatiflere geçer.
   */
  private async getWords(): Promise<LLMWordOutput[]> {
    try {
      // Öncelikle Groq API kullan
      if (this.groqConfig) {
        return await this.getWordsFromGroq();
      }
      // Eğer Groq yoksa Ollama'yı dene
      else if (this.ollamaModelName) {
        return await this.getWordsFromOllama();
      }
      // Her ikisi de yoksa acil duruma geç
      else {
        logger.error('Hiçbir API yapılandırılmamış. Acil durum moduna geçiliyor.');
        return this.getEmergencyWordData();
      }
    } catch (error) {
      logger.error('Tercih edilen API ile kelimeler alma başarısız:', error);
      
      // Eğer Groq hata verdi ve Ollama yapılandırılmışsa Ollama'yı dene
      if (this.groqConfig && this.ollamaModelName) {
        try {
          logger.info('Groq API başarısız oldu, Ollama CLI ile deneniyor...');
          return await this.getWordsFromOllama();
        } catch (ollamaError) {
          logger.error('Ollama CLI de başarısız oldu:', ollamaError);
          return this.getEmergencyWordData();
        }
      }

      // Diğer durumlarda acil durum kelimelerine dön
      return this.getEmergencyWordData();
    }
  }
  
  /**
   * Eğer model başarısız olursa kullanmak için varsayılan kelimeler
   */
  private getEmergencyWordData(): LLMWordOutput[] {
    const emergencyWords = [
      {
        kelime: "müstesna",
        bilgi: {
          tanim: "Ayrık, ayrıcalıklı, seçkin.",
          ornek_cumle: "Bu müstesna durumda size yardımcı olabilirim.",
          kategori: "edebiyat",
          es_anlamlilari: ["ayrıcalıklı", "seçkin"],
          zit_anlamlilari: ["sıradan", "alelade"],
          kaynak: 'Acil Durum Önbelleği',
        }
      },
      {
        kelime: "müşkül",
        bilgi: {
          tanim: "Güç, zorluk, zor, güç bir durum.",
          ornek_cumle: "Bu müşkül durumdan nasıl çıkacağımı bilmiyorum.",
          kategori: "edebiyat",
          es_anlamlilari: ["zor", "çetin"],
          zit_anlamlilari: ["kolay", "basit"],
          kaynak: 'Acil Durum Önbelleği',
        }
      },
      {
        kelime: "mütemadiyen",
        bilgi: {
          tanim: "Sürekli olarak, durmadan, aralıksız.",
          ornek_cumle: "Son günlerde mütemadiyen yağmur yağıyor.",
          kategori: "edebiyat",
          es_anlamlilari: ["sürekli", "devamlı"],
          zit_anlamlilari: ["ara sıra", "kesintili"],
          kaynak: 'Acil Durum Önbelleği',
        }
      },
      {
        kelime: "mütevekkil",
        bilgi: {
          tanim: "Her şeyi Allah'tan bilen, kadere inanmış",
          ornek_cumle: "Mütevekkil bir tavırla sonucu bekliyordu.",
          kategori: "felsefe",
          es_anlamlilari: ["teslimiyetçi", "kaderci"],
          zit_anlamlilari: ["isyankâr", "asi"],
          kaynak: 'Acil Durum Önbelleği',
        }
      },
      {
        kelime: "mücbir",
        bilgi: {
          tanim: "Zorlayıcı, zorunlu kılan, mecbur eden.",
          ornek_cumle: "Mücbir sebepler nedeniyle uçuş iptal edildi.",
          kategori: "hukuk",
          es_anlamlilari: ["zorlayıcı", "kaçınılmaz"],
          zit_anlamlilari: ["isteğe bağlı", "ihtiyari"],
          kaynak: 'Acil Durum Önbelleği',
        }
      },
      {
        kelime: "münferit",
        bilgi: {
          tanim: "Ayrı, tek, yalnız, bağımsız.",
          ornek_cumle: "Bu münferit olay bizi endişelendirmemeli.",
          kategori: "edebiyat",
          es_anlamlilari: ["tek", "biricik"],
          zit_anlamlilari: ["toplu", "birleşik"],
          kaynak: 'Acil Durum Önbelleği',
        }
      },
      {
        kelime: "mütevazı",
        bilgi: {
          tanim: "Alçakgönüllü, gösterişsiz, iddiasız.",
          ornek_cumle: "Mütevazı bir evde yaşamayı tercih ediyordu.",
          kategori: "psikoloji",
          es_anlamlilari: ["alçakgönüllü", "gösterişsiz"],
          zit_anlamlilari: ["kibirli", "gösterişli"],
          kaynak: 'Acil Durum Önbelleği',
        }
      },
      {
        kelime: "müştak",
        bilgi: {
          tanim: "Özleyen, hasretle bekleyen, arzulayan.",
          ornek_cumle: "Seni görmeye müştak gözlerle bekliyordu.",
          kategori: "edebiyat",
          es_anlamlilari: ["özlem duyan", "hasret çeken"],
          zit_anlamlilari: ["bıkmış", "bezmiş"],
          kaynak: 'Acil Durum Önbelleği',
        }
      },
      {
        kelime: "müsrif",
        bilgi: {
          tanim: "Savurgan, tutumsuz, israf eden.",
          ornek_cumle: "Müsrif davranışları nedeniyle tüm servetini kaybetti.",
          kategori: "ekonomi",
          es_anlamlilari: ["savurgan", "hovarda"],
          zit_anlamlilari: ["tutumlu", "cimri"],
          kaynak: 'Acil Durum Önbelleği',
        }
      },
      {
        kelime: "mübrem",
        bilgi: {
          tanim: "Kaçınılmaz, çok gerekli, şart olan.",
          ornek_cumle: "Bu konunun çözümü mübrem bir ihtiyaçtır.",
          kategori: "edebiyat",
          es_anlamlilari: ["zorunlu", "gerekli"],
          zit_anlamlilari: ["gereksiz", "önemsiz"],
          kaynak: 'Acil Durum Önbelleği',
        }
      }
    ];
    
    // Acil durum kelimelerini döndür
    return emergencyWords;
  }

  /**
   * Belirtilen bir işlemi başarısız olması durumunda yeniden dener.
   */
  private async retryOperation<T>(operation: () => Promise<T>, fallback: () => T): Promise<T> {
      let lastError: Error | undefined;
      for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
          try {
              return await operation();
          } catch (error) {
              lastError = error instanceof Error ? error : new Error(String(error));
              logger.warn(`İşlem denemesi ${attempt} başarısız oldu: ${lastError.message}`);
              if (attempt < MAX_RETRY_ATTEMPTS) {
                  const waitTime = REQUEST_DELAY_MS * Math.pow(2, attempt - 1);
                  logger.info(`${waitTime}ms sonra yeniden denenecek...`);
                  await new Promise((resolve) => setTimeout(resolve, waitTime));
              } else {
                  logger.error(`İşlem ${MAX_RETRY_ATTEMPTS} denemeden sonra kalıcı olarak başarısız oldu. Yedek veriye geçiliyor.`);
                  return fallback();
              }
          }
      }
      return fallback();
  }

  /**
   * Önbellekten ve kullanılmış kelimeler dışında belirtilen sayıda kelime döndürür.
   * Önbellek yetersizse yeni kelimeler alır.
   */
  private async getUniqueWords(count: number = DEFAULT_BATCH_SIZE): Promise<LLMWordOutput[]> {
    // Önbellekteki kullanılmamış kelimeleri filtrele
    const unusedCachedWords = this.cachedWords.filter(word => !this.usedWords.has(word.kelime));
    
    // Eğer önbellekte yeterli sayıda kullanılmamış kelime varsa, onları kullan
    if (unusedCachedWords.length >= count) {
      logger.info(`Önbellekte ${unusedCachedWords.length} kullanılmamış kelime var, ${count} kelime döndürülüyor.`);
      const selectedWords = unusedCachedWords.slice(0, count);
      
      // Seçilen kelimeleri kullanılmış olarak işaretle
      selectedWords.forEach(word => this.usedWords.add(word.kelime));
      
      return selectedWords;
    }
    
    // Yeni kelimeler al ve mevcut kullanılmamış kelimelerle birleştir
    try {
      logger.info(`Önbellekte yeterli kullanılmamış kelime yok. API'den yeni kelimeler alınıyor.`);
      const newWords = await this.getWords();
      
      // Önbelleği güncelle ama maksimum boyutu aşma
      this.updateCache(newWords);
      
      // Tüm kullanılabilir kelimeleri filtreleyerek al
      const allAvailableWords = this.cachedWords.filter(word => !this.usedWords.has(word.kelime));
      
      // Rastgele seçim yapmak için kelimeleri karıştır
      const shuffledWords = this.shuffleArray([...allAvailableWords]);
      
      // İstenen sayıda kelime seç, yeterli sayıda yoksa tüm mevcut kelimeleri kullan
      const selectedWords = shuffledWords.slice(0, Math.min(count, shuffledWords.length));
      
      // Seçilen kelimeleri kullanılmış olarak işaretle
      selectedWords.forEach(word => this.usedWords.add(word.kelime));
      
      logger.info(`${selectedWords.length} benzersiz kelime seçildi ve döndürülüyor.`);
      
      return selectedWords;
    } catch (error) {
      logger.error('Yeni kelimeler alınamadı:', error);
      
      // Acil durum kelimelerini kullan
      const emergencyWords = this.getEmergencyWordData();
      
      // Daha önce kullanılmamış acil durum kelimeleri
      const unusedEmergencyWords = emergencyWords.filter(word => !this.usedWords.has(word.kelime));
      
      if (unusedEmergencyWords.length > 0) {
        const selectedWords = unusedEmergencyWords.slice(0, Math.min(count, unusedEmergencyWords.length));
        selectedWords.forEach(word => this.usedWords.add(word.kelime));
        return selectedWords;
      }
      
      // Tüm acil durum kelimeleri kullanılmışsa, kullanım kaydını sıfırla ve yeniden kullan
      logger.warn('Tüm acil durum kelimeleri kullanılmış, kullanım kaydı sıfırlanıyor.');
      emergencyWords.forEach(word => this.usedWords.delete(word.kelime));
      
      const reselectedWords = emergencyWords.slice(0, Math.min(count, emergencyWords.length));
      reselectedWords.forEach(word => this.usedWords.add(word.kelime));
      
      return reselectedWords;
    }
  }
  
  /**
   * Önbelleği yeni kelimelerle günceller, aynı zamanda önbellek boyutunu kontrol eder.
   */
  private updateCache(newWords: LLMWordOutput[]): void {
    // Önbellekte olmayan yeni kelimeleri ekle
    const addedCount = newWords.reduce((count, word) => {
      if (!this.cachedWords.some(cached => cached.kelime === word.kelime)) {
        this.cachedWords.push(word);
        return count + 1;
      }
      return count;
    }, 0);
    
    logger.info(`Önbelleğe ${addedCount} yeni kelime eklendi. Toplam önbellek boyutu: ${this.cachedWords.length}`);
    
    // Önbellek boyutu sınırı aşıldıysa, en eski kelimeleri çıkar
    if (this.cachedWords.length > MAX_CACHE_SIZE) {
      const removeCount = this.cachedWords.length - MAX_CACHE_SIZE;
      this.cachedWords = this.cachedWords.slice(removeCount);
      logger.info(`Önbellek boyutu sınırlandırıldı. ${removeCount} eski kelime kaldırıldı.`);
    }
  }
  
  /**
   * Diziyi karıştırma yardımcı metodu (Fisher-Yates algoritması)
   */
  private shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * API'den Türkçe kelimeler ve bilgilerini alır.
   * Artık her seferinde DEFAULT_BATCH_SIZE (10) kelime döndürür.
   */
  public async fetchNicheTurkishWords(count: number = DEFAULT_BATCH_SIZE): Promise<LLMWordOutput[]> {
    return await this.getUniqueWords(count);
  }
  
  /**
   * Geriye dönük uyumluluk için tek bir kelime döndüren fonksiyon.
   */
  public async fetchNicheTurkishWord(): Promise<LLMWordOutput> {
    const words = await this.getUniqueWords(1);
    return words[0];
  }
  
  /**
   * Kullanılmış kelime kaydını sıfırlar, böylece tüm kelimeler tekrar kullanılabilir.
   */
  public resetUsedWords(): void {
    const previousCount = this.usedWords.size;
    this.usedWords.clear();
    logger.info(`Kullanılmış kelime kaydı sıfırlandı. ${previousCount} kelime tekrar kullanılabilir.`);
  }
  
  /**
   * Önbelleği tamamen temizler. Test ve özel durumlar için kullanılır.
   */
  public clearCache(): void {
    const previousCount = this.cachedWords.length;
    this.cachedWords = [];
    logger.info(`Önbellek tamamen temizlendi. ${previousCount} kelime kaldırıldı.`);
  }
}
