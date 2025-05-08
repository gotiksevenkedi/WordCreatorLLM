import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import config from '../config/config';
import logger from '../utils/logger';
import { KelimeBilgisi, KelimeKaydi, DatabaseError } from '../models/types';

/**
 * SQLite veritabanı işlemleri için servis sınıfı
 */
export class DatabaseService {
  private readonly dbPath: string;
  private db: Database<sqlite3.Database> | null = null;

  /**
   * @param dbPath Veritabanı dosyasının yolu
   */
  constructor(dbPath: string = config.db.path) {
    this.dbPath = dbPath;
  }

  /**
   * Veritabanı bağlantısını açar ve şemayı oluşturur
   */
  async initialize(): Promise<void> {
    try {
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database
      });
      
      logger.info(`Veritabanı bağlantısı açıldı: ${this.dbPath}`);
      
      // Veritabanı tablosunu oluştur
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS sozluk (
          kelime TEXT PRIMARY KEY,
          tanim TEXT NOT NULL,
          es_anlamlilari TEXT,      -- JSON string olarak saklanacak (string[] | undefined)
          zit_anlamlilari TEXT,     -- JSON string olarak saklanacak (string[] | undefined)
          ornek_cumle TEXT,
          kaynak TEXT,
          kategori TEXT             -- Kategori alanı eklendi
        )
      `);
      
      logger.info('Veritabanı şeması oluşturuldu');
    } catch (error) {
      const errorMessage = `Veritabanı başlatılırken hata: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMessage);
      throw new DatabaseError(errorMessage);
    }
  }

  /**
   * Bağlantıyı kapatır
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      logger.info('Veritabanı bağlantısı kapatıldı');
    }
  }

  /**
   * Veritabanına bir kelime kaydı ekler
   * @param kelime Eklenecek kelime
   * @param bilgi Kelimenin bilgileri
   * @returns İşlem başarılı ise true, kelime zaten varsa false
   */
  async kelimeEkle(kelime: string, bilgi: KelimeBilgisi): Promise<boolean> {
    if (!this.db) {
      throw new DatabaseError('Veritabanı bağlantısı açık değil');
    }

    try {
      const esAnlamlilarJson = bilgi.es_anlamlilari ? JSON.stringify(bilgi.es_anlamlilari) : null;
      const zitAnlamlilarJson = bilgi.zit_anlamlilari ? JSON.stringify(bilgi.zit_anlamlilari) : null;

      const result = await this.db.run(
        'INSERT OR IGNORE INTO sozluk (kelime, tanim, es_anlamlilari, zit_anlamlilari, ornek_cumle, kaynak, kategori) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [kelime, bilgi.tanim, esAnlamlilarJson, zitAnlamlilarJson, bilgi.ornek_cumle, bilgi.kaynak, bilgi.kategori]
      );
      
      const eklendi = result.changes !== undefined && result.changes > 0;
      if (eklendi) {
        logger.debug(`"${kelime}" kelimesi veritabanına eklendi`);
      } else {
        logger.debug(`"${kelime}" kelimesi zaten veritabanında var`);
      }
      
      return eklendi;
    } catch (error) {
      const errorMessage = `"${kelime}" kelimesi eklenirken hata: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMessage);
      throw new DatabaseError(errorMessage);
    }
  }

  /**
   * Kelime toplu olarak ekleme işlemi
   * @param kelimeler Eklenecek kelime kayıtları
   * @returns Eklenen kelime sayısı
   */
  async kelimeTopluEkle(kelimeler: Array<{ kelime: string, bilgi: KelimeBilgisi }>): Promise<number> {
    if (!this.db) {
      throw new DatabaseError('Veritabanı bağlantısı açık değil');
    }

    try {
      let eklenenSayisi = 0;
      
      // Transaction başlat
      await this.db.run('BEGIN TRANSACTION');
      
      const stmt = await this.db.prepare(
        'INSERT OR IGNORE INTO sozluk (kelime, tanim, es_anlamlilari, zit_anlamlilari, ornek_cumle, kaynak, kategori) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      
      for (const { kelime, bilgi } of kelimeler) {
        const esAnlamlilarJson = bilgi.es_anlamlilari ? JSON.stringify(bilgi.es_anlamlilari) : null;
        const zitAnlamlilarJson = bilgi.zit_anlamlilari ? JSON.stringify(bilgi.zit_anlamlilari) : null;
        const result = await stmt.run(kelime, bilgi.tanim, esAnlamlilarJson, zitAnlamlilarJson, bilgi.ornek_cumle, bilgi.kaynak, bilgi.kategori);
        if (result.changes !== undefined && result.changes > 0) {
          eklenenSayisi++;
        }
      }
      
      await stmt.finalize();
      await this.db.run('COMMIT');
      
      logger.info(`${eklenenSayisi} kelime veritabanına toplu olarak eklendi`);
      
      return eklenenSayisi;
    } catch (error) {
      // Hata durumunda transaction'ı geri al
      if (this.db) {
        await this.db.run('ROLLBACK');
      }
      
      const errorMessage = `Kelimeler toplu olarak eklenirken hata: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMessage);
      throw new DatabaseError(errorMessage);
    }
  }

  /**
   * Veritabanında bir kelimenin olup olmadığını kontrol eder
   * @param kelime Kontrol edilecek kelime
   * @returns Kelime varsa true, yoksa false
   */
  async kelimeVarMi(kelime: string): Promise<boolean> {
    if (!this.db) {
      throw new DatabaseError('Veritabanı bağlantısı açık değil');
    }

    try {
      const result = await this.db.get('SELECT 1 FROM sozluk WHERE kelime = ?', [kelime]);
      return !!result;
    } catch (error) {
      const errorMessage = `"${kelime}" kelimesi kontrol edilirken hata: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMessage);
      throw new DatabaseError(errorMessage);
    }
  }

  /**
   * Veritabanındaki tüm kelimeleri getirir
   * @returns Tüm kelime kayıtları
   */
  async tumKelimeleriGetir(): Promise<KelimeKaydi[]> {
    if (!this.db) {
      throw new DatabaseError('Veritabanı bağlantısı açık değil');
    }

    try {
      const kelimeler = await this.db.all('SELECT kelime, tanim, es_anlamlilari, zit_anlamlilari, ornek_cumle, kaynak, kategori FROM sozluk ORDER BY kelime');
      logger.info(`Veritabanından ${kelimeler.length} kelime getirildi`);
      // KelimeKaydi tipi es_anlamlilari ve zit_anlamlilari alanlarını string? (JSON string veya undefined) olarak bekler.
      // Veritabanından zaten string (veya null) olarak gelirler.
      return kelimeler.map(k => ({
        id: 0, // ID veritabanından gelmiyor, bu modelde var ama kullanılmıyorsa sorun değil.
        kelime: k.kelime,
        tanim: k.tanim,
        es_anlamlilari: k.es_anlamlilari || undefined, // SQLite null değerini JS null olarak döndürür, bunu undefined yapalım
        zit_anlamlilari: k.zit_anlamlilari || undefined, // SQLite null değerini JS null olarak döndürür, bunu undefined yapalım
        ornek_cumle: k.ornek_cumle || undefined,
        kaynak: k.kaynak || 'Bilinmiyor', // kaynak null ise 'Bilinmiyor' ata
        kategori: k.kategori || undefined, // Kategori eklendi
        eklenme_tarihi: '' // eklenme_tarihi veritabanından gelmiyor, bu modelde var.
      })) as KelimeKaydi[];
    } catch (error) {
      const errorMessage = `Tüm kelimeler getirilirken hata: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMessage);
      throw new DatabaseError(errorMessage);
    }
  }

  /**
   * Veritabanındaki kelime sayısını döndürür
   * @returns Kelime sayısı
   */
  async kelimeSayisiniGetir(): Promise<number> {
    if (!this.db) {
      throw new DatabaseError('Veritabanı bağlantısı açık değil');
    }

    try {
      const result = await this.db.get('SELECT COUNT(*) as count FROM sozluk');
      return result?.count || 0;
    } catch (error) {
      const errorMessage = `Kelime sayısı alınırken hata: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMessage);
      throw new DatabaseError(errorMessage);
    }
  }

  /**
   * İzinli kategoriler dışında kalan tüm kelimeleri siler
   * @param izinliKategoriler Sadece bu kategorilerdeki kelimeler tutulur
   * @returns Silinen kelime sayısı
   */
  async kabulEdilmeyenKategorileriSil(izinliKategoriler: string[]): Promise<number> {
    if (!this.db) {
      throw new DatabaseError('Veritabanı bağlantısı açık değil');
    }
    try {
      // Kategori NULL olanlar da silinsin isteniyorsa, sorguya eklenebilir
      const placeholders = izinliKategoriler.map(() => '?').join(',');
      const query = `DELETE FROM sozluk WHERE kategori IS NULL OR kategori NOT IN (${placeholders})`;
      const result = await this.db.run(query, izinliKategoriler);
      logger.info(`${result.changes || 0} adet uygunsuz kategorideki kelime silindi.`);
      return result.changes || 0;
    } catch (error) {
      const errorMessage = `Kabul edilmeyen kategoriler silinirken hata: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMessage);
      throw new DatabaseError(errorMessage);
    }
  }
}
