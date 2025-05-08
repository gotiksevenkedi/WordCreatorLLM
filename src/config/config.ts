import dotenv from 'dotenv';
import { AppConfig } from '../models/types';

// .env dosyasını yükle
dotenv.config();

// Groq API ortam değişkenleri
const GROQ_API_KEY = process.env.GROQ_API_KEY || 'insert here';
const GROQ_API_URL = process.env.GROQ_API_URL || 'insert here';
const GROQ_MODEL_NAME = process.env.GROQ_MODEL_NAME || '';

// Ollama ortam değişkenleri (eski)
const OLLAMA_MODEL_NAME = process.env.OLLAMA_MODEL_NAME;

// Groq için uyarılar
if (!GROQ_API_KEY) {
  console.warn(
    'Uyarı: GROQ_API_KEY ortam değişkeni ayarlanmamış. API istekleri başarısız olabilir.'
  );
}

const config: AppConfig = {
  env: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  db: {
    path: process.env.DB_PATH || './database.sqlite',
  },
  api: {
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '5', 10), // Groq için değeri artıralım
    requestDelayMs: parseInt(process.env.REQUEST_DELAY_MS || '500', 10), // Hızlı API için gecikmeyi azaltalım
    maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3', 10),
  },
  groq: {
    apiKey: GROQ_API_KEY,
    apiUrl: GROQ_API_URL,
    modelName: GROQ_MODEL_NAME,
  },
  // Geriye dönük uyumluluk için Ollama yapılandırmasını koruyalım (opsiyonel)
  ollama: OLLAMA_MODEL_NAME
    ? {
        modelName: OLLAMA_MODEL_NAME,
      }
    : undefined,
};

export default config;
