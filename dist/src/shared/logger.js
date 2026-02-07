import fs from 'node:fs';
import path from 'node:path';
import { resolveDataDir } from './config.js';
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
let logLevel = process.env['CLAUDEX_LOG_LEVEL'] || 'info';
let logFile = null;
function getLogFile() {
    if (!logFile) {
        const dataDir = resolveDataDir();
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        logFile = path.join(dataDir, 'claudex.log');
    }
    return logFile;
}
function formatMessage(level, component, message, data) {
    const ts = new Date().toISOString();
    const base = `[${ts}] [${level.toUpperCase()}] [${component}] ${message}`;
    if (data !== undefined) {
        try {
            return `${base} ${JSON.stringify(data)}`;
        }
        catch {
            return `${base} [unstringifiable data]`;
        }
    }
    return base;
}
function writeLog(formatted) {
    try {
        fs.appendFileSync(getLogFile(), formatted + '\n');
    }
    catch {
        // Silently fail — logging should never break the app
    }
}
export function createLogger(component) {
    return {
        debug(message, data) {
            if (LEVELS[logLevel] <= LEVELS.debug) {
                writeLog(formatMessage('debug', component, message, data));
            }
        },
        info(message, data) {
            if (LEVELS[logLevel] <= LEVELS.info) {
                writeLog(formatMessage('info', component, message, data));
            }
        },
        warn(message, data) {
            if (LEVELS[logLevel] <= LEVELS.warn) {
                writeLog(formatMessage('warn', component, message, data));
            }
        },
        error(message, data) {
            if (LEVELS[logLevel] <= LEVELS.error) {
                writeLog(formatMessage('error', component, message, data));
            }
        },
    };
}
export function setLogLevel(level) {
    logLevel = level;
}
//# sourceMappingURL=logger.js.map