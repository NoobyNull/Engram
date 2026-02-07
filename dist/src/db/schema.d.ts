import type Database from 'better-sqlite3';
export declare function initializeSchema(db: Database.Database): void;
export declare function initializeVectorTable(db: Database.Database): boolean;
