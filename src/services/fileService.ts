import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger';
import { FileError } from '../models/types';

/**
 * Dosya işlemleri için servis sınıfı
 */
export class FileService {
  private readonly kelimelerDizini: string;

  /**
   * @param kelimelerDizini Kelimelerin (A.txt, B.txt vb.) bulunduğu ana dizinin yolu
   */
  constructor(kelimelerDizini: string = process.cwd()) { // Varsayılan dizin projenin ana dizini olarak değiştirildi
    this.kelimelerDizini = kelimelerDizini;
  }

  /**
   * Ana dizindeki A.txt'den Z.txt'ye kadar olan var olan kelime dosyalarını listeler.
   * @returns Var olan .txt dosyalarının yollarını içeren dizi
   */
  async getKelimeDosyalari(): Promise<string[]> {
    const harfler = [];
    for (let i = 'A'.charCodeAt(0); i <= 'Z'.charCodeAt(0); i++) {
      harfler.push(String.fromCharCode(i));
    }

    const bulunanDosyalar: string[] = [];
    for (const harf of harfler) {
      const dosyaAdi = `${harf}.txt`;
      const dosyaYolu = path.join(this.kelimelerDizini, dosyaAdi);
      try {
        await fs.access(dosyaYolu, fs.constants.F_OK); // Dosyanın varlığını kontrol et
        bulunanDosyalar.push(dosyaYolu);
      } catch (error) {
        // Dosya yoksa veya erişilemiyorsa, listeye ekleme (hata loglamaya gerek yok)
      }
    }
    
    logger.info(`${bulunanDosyalar.length} kelime dosyası bulundu (A.txt-Z.txt)`);
    return bulunanDosyalar;
  }

  /**
   * Belirtilen dosyadaki kelimeleri okur
   * @param dosyaYolu Okunacak dosyanın yolu
   * @returns Dosyadaki kelimeleri içeren dizi
   */
  async dosyadanKelimeleriOku(dosyaYolu: string): Promise<string[]> {
    try {
      const dosyaIcerigi = await fs.readFile(dosyaYolu, 'utf-8');
      const kelimeler = dosyaIcerigi
        .split('\n')
        .map(kelime => kelime.trim())
        .filter(kelime => kelime.length > 0);
      
      logger.info(`${dosyaYolu} dosyasından ${kelimeler.length} kelime okundu`);
      return kelimeler;
    } catch (error) {
      const errorMessage = `${dosyaYolu} dosyasından kelimeler okunurken hata oluştu: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMessage);
      throw new FileError(errorMessage);
    }
  }

  /**
   * Tüm kelime dosyalarını okur ve kelimeleri birleştirir
   * @returns Tüm dosyalardaki kelimeleri içeren dizi
   */
  async tumKelimeleriOku(): Promise<string[]> {
    try {
      const dosyalar = await this.getKelimeDosyalari();
      const tumKelimeler: string[] = [];

      for (const dosya of dosyalar) {
        const kelimeler = await this.dosyadanKelimeleriOku(dosya);
        tumKelimeler.push(...kelimeler);
      }

      logger.info(`Toplam ${tumKelimeler.length} kelime okundu`);
      return tumKelimeler;
    } catch (error) {
      if (error instanceof FileError) {
        throw error;
      }
      
      const errorMessage = `Tüm kelimeler okunurken hata oluştu: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMessage);
      throw new FileError(errorMessage);
    }
  }
}
