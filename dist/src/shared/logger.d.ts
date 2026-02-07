export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export declare function createLogger(component: string): {
    debug(message: string, data?: unknown): void;
    info(message: string, data?: unknown): void;
    warn(message: string, data?: unknown): void;
    error(message: string, data?: unknown): void;
};
export declare function setLogLevel(level: LogLevel): void;
