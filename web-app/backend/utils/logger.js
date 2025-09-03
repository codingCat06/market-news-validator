const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
require('fs').mkdirSync(logsDir, { recursive: true });

// Custom log format
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'stock-analysis-api' },
    transports: [
        // Write all logs with importance level of `error` or less to `error.log`
        new winston.transports.File({ 
            filename: path.join(logsDir, 'error.log'), 
            level: 'error',
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5
        }),
        // Write all logs with importance level of `info` or less to `combined.log`
        new winston.transports.File({ 
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5
        }),
    ],
});

// If we're not in production then log to the `console`
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
                let log = `${timestamp} [${service}] ${level}: ${message}`;
                if (Object.keys(meta).length > 0) {
                    log += ` ${JSON.stringify(meta)}`;
                }
                return log;
            })
        )
    }));
}

module.exports = logger;
