import type { ClaudexConfig } from './types.js';
export declare function resolveDataDir(): string;
export declare function getConfig(): ClaudexConfig;
export declare function ensureDataDir(): string;
export declare function getDbPath(): string;
export declare function isPrivacyExcluded(filePath: string): boolean;
export declare function saveConfig(updates: Partial<ClaudexConfig>): ClaudexConfig;
export declare function resetConfigCache(): void;
