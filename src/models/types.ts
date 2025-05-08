/**
 * Gemini API'den ve veritabanından gelen kelime bilgisi için tip tanımı
 */
export interface KelimeBilgisi {
  tanim: string;
  es_anlamlilari?: string[];
  zit_anlamlilari?: string[];
  ornek_cumle?: string;
  kaynak: string; // API kaynağını belirtmek için (örn: gemini-1.5-flash)
  kategori?: string; // Kategori alanı eklendi
}

/**
 * LLM API'den (Gemini, Ollama vb.) gelen kelime ve bilgilerini bir arada tutan yapı.
 */
export interface LLMWordOutput {
  kelime: string;
  bilgi: KelimeBilgisi;
}

/**
 * Kelime bilgisinin veritabanına kaydedilecek formatını tanımlar.
 */
export interface KelimeKaydi extends KelimeBilgisi {
  id?: number;
  kelime: string;
  eklenme_tarihi?: string; // ISO 8601 formatında tarih
}

/**
 * Uygulama konfigürasyonu için tip tanımı
 */
export interface AppConfig {
  env: string;
  logLevel: string;
  db: {
    path: string;
  };
  api: {
    maxConcurrentRequests: number;
    requestDelayMs: number;
    maxRetryAttempts: number;
  };
  groq?: { // Groq API ayarları
    apiKey: string;
    apiUrl: string;
    modelName: string;
  };
  ollama?: { // Ollama ayarları artık daha basit
    modelName: string;
  };
}

// --- Hata Sınıfları ---

/**
 * Genel API hatası sınıfı.
 */
export class ApiError extends Error {
  public readonly statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Ağ ile ilgili hatalar için sınıf.
 */
export class NetworkError extends ApiError {
  constructor(message: string, statusCode?: number) {
    super(message, statusCode);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * LLM'den beklenen kelime veya bilgi üretilemediğinde fırlatılacak hata.
 */
export class NoWordGeneratedError extends ApiError {
  constructor(message: string) {
    super(message);
    this.name = 'NoWordGeneratedError';
    Object.setPrototypeOf(this, NoWordGeneratedError.prototype);
  }
}

/**
 * JSON ayrıştırma hataları için sınıf.
 */
export class JsonParseError extends ApiError {
  public readonly rawResponse?: string;
  constructor(message: string, rawResponse?: string) {
    super(message);
    this.name = 'JsonParseError';
    this.rawResponse = rawResponse;
    Object.setPrototypeOf(this, JsonParseError.prototype);
  }
}

/**
 * Veritabanı ile ilgili hatalar için sınıf.
 */
export class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Dosya ile ilgili hatalar için sınıf.
 */
export class FileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileError';
  }
}
