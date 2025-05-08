import winston from 'winston';
import config from '../config/config';

// Winston logger kurulumu
const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'turkce-kelime-database' },
  transports: [
    // Console'a hata mesajları yazdırma
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(info => {
          const { timestamp, level, message, ...rest } = info;
          return `[${timestamp}] ${level}: ${message} ${Object.keys(rest).length ? JSON.stringify(rest, null, 2) : ''}`;
        })
      )
    }),
    // Dosyaya log kaydetme
    new winston.transports.File({ 
      filename: 'errors.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({ 
      filename: 'app.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  ]
});

export default logger;
