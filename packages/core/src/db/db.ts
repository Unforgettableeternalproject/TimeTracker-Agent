import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseOptions } from '../model/types';

/**
 * Database service for managing SQLite connection and queries
 */
export class DatabaseService {
  private db: Database.Database;
  private readonly dbPath: string;

  constructor(options: DatabaseOptions) {
    this.dbPath = options.path;
    
    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Initialize database
    this.db = new Database(this.dbPath, {
      readonly: options.readonly || false,
      fileMustExist: false,
    });

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');
    
    // Initialize schema if needed
    this.initializeSchema();
  }

  /**
   * Initialize database schema from SQL file
   */
  private initializeSchema(): void {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    this.db.exec(schema);
  }

  /**
   * Get the underlying database instance
   */
  getDatabase(): Database.Database {
    return this.db;
  }

  /**
   * Execute a query that returns multiple rows
   */
  query<T = unknown>(sql: string, params: unknown[] = []): T[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  /**
   * Execute a query that returns a single row
   */
  queryOne<T = unknown>(sql: string, params: unknown[] = []): T | undefined {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params) as T | undefined;
  }

  /**
   * Execute a write operation (INSERT, UPDATE, DELETE)
   */
  execute(sql: string, params: unknown[] = []): Database.RunResult {
    const stmt = this.db.prepare(sql);
    return stmt.run(...params);
  }

  /**
   * Execute multiple statements in a transaction
   */
  transaction<T>(fn: () => T): T {
    const txn = this.db.transaction(fn);
    return txn();
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get database metadata
   */
  getMetadata(key: string): string | undefined {
    const result = this.queryOne<{ value: string }>(
      'SELECT value FROM db_metadata WHERE key = ?',
      [key]
    );
    return result?.value;
  }

  /**
   * Set database metadata
   */
  setMetadata(key: string, value: string): void {
    this.execute(
      'INSERT OR REPLACE INTO db_metadata (key, value) VALUES (?, ?)',
      [key, value]
    );
  }

  /**
   * Vacuum the database to reclaim space
   */
  vacuum(): void {
    this.db.exec('VACUUM');
  }

  /**
   * Get database file path
   */
  getPath(): string {
    return this.dbPath;
  }
}

/**
 * Get default database path
 */
export function getDefaultDatabasePath(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  return path.join(homeDir, '.timesheet-agent', 'timesheet.db');
}

/**
 * Create a database service with default options
 */
export function createDatabase(dbPath?: string): DatabaseService {
  return new DatabaseService({
    path: dbPath || getDefaultDatabasePath(),
  });
}
