import Database from 'better-sqlite3';
export declare function getDb(): Database.Database;
export declare function isVectorsAvailable(): boolean;
export declare function closeDb(): void;
export declare function generateId(prefix?: string): string;
