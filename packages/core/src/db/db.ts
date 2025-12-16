import initSqlJs, { Database, SqlValue } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseOptions } from '../model/types';

/**
 * Database service for managing SQLite connection and queries
 */
export class DatabaseService {
  private db: Database | null = null;
  private readonly dbPath: string;
  private initPromise: Promise<void>;

  constructor(options: DatabaseOptions) {
    this.dbPath = options.path;
    
    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Initialize database asynchronously
    this.initPromise = this.initializeDatabase(options.readonly || false);
  }

  /**
   * Wait for database to be initialized
   */
  async waitForInit(): Promise<void> {
    await this.initPromise;
  }

  /**
   * Initialize sql.js and load/create database
   */
  private async initializeDatabase(readonly: boolean): Promise<void> {
    const sqlJs = await initSqlJs();
    
    // Load existing database or create new one
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new sqlJs.Database(buffer);
    } else {
      this.db = new sqlJs.Database();
    }

    // Enable foreign keys
    this.db.run('PRAGMA foreign_keys = ON');
    
    // Initialize schema if needed
    this.initializeSchema();
    
    // Save to disk
    if (!readonly) {
      this.save();
    }
  }

  /**
   * Initialize database schema from SQL file
   */
  private initializeSchema(): void {
    if (!this.db) return;
    
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    this.db.run(schema);
  }

  /**
   * Save database to disk
   */
  private save(): void {
    if (!this.db) return;
    const data = this.db.export();
    fs.writeFileSync(this.dbPath, Buffer.from(data));
  }

  /**
   * Get the underlying database instance
   */
  getDatabase(): Database | null {
    return this.db;
  }

  /**
   * Execute a query that returns multiple rows
   */
  query<T = unknown>(sql: string, params: SqlValue[] = []): T[] {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      console.log('[DB] Executing query:', sql, 'with params:', params);
      
      // Use prepared statement for parameterized queries
      const stmt = this.db.prepare(sql);
      stmt.bind(params);
      
      const results: T[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push(row as T);
      }
      stmt.free();
      
      console.log('[DB] Query returned', results.length, 'rows');
      return results;
    } catch (error) {
      console.error('[DB] Query error:', error, 'SQL:', sql, 'Params:', params);
      return [];
    }
  }

  /**
   * Execute a query that returns a single row
   */
  queryOne<T = unknown>(sql: string, params: SqlValue[] = []): T | undefined {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      console.log('[DB] Executing queryOne:', sql, 'with params:', params);
      
      const stmt = this.db.prepare(sql);
      stmt.bind(params);
      
      let result: T | undefined;
      if (stmt.step()) {
        result = stmt.getAsObject() as T;
      }
      stmt.free();
      
      console.log('[DB] QueryOne result:', result);
      return result;
    } catch (error) {
      console.error('[DB] QueryOne error:', error, 'SQL:', sql, 'Params:', params);
      return undefined;
    }
  }

  /**
   * Execute a write operation (INSERT, UPDATE, DELETE)
   */
  execute(sql: string, params: SqlValue[] = []): { changes: number; lastInsertRowid: number } {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      console.log('[DB] Executing write:', sql, 'with params:', params);
      
      const stmt = this.db.prepare(sql);
      
      // Check if bind succeeded
      console.log('[DB] Binding params...');
      stmt.bind(params);
      
      // Execute the statement
      console.log('[DB] Executing step...');
      const hasRow = stmt.step();
      console.log('[DB] Step returned:', hasRow);
      
      stmt.free();
      
      // Check for errors using sqlite3 error functions
      const errorResult = this.db.exec('SELECT last_insert_rowid() as id, changes() as changes');
      console.log('[DB] Error check result:', errorResult);
      
      this.save();
      
      // Get last insert rowid
      const lastInsertRowid = errorResult[0]?.values[0]?.[0] as number || 0;
      
      // Get changes count
      const changes = errorResult[0]?.values[0]?.[1] as number || 0;
      
      console.log('[DB] Execute result: changes=', changes, 'lastInsertRowid=', lastInsertRowid);
      
      if (changes === 0 && sql.trim().toUpperCase().startsWith('INSERT')) {
        throw new Error('INSERT failed: no rows affected. Check constraints or SQL syntax.');
      }
      
      return { changes, lastInsertRowid };
    } catch (error) {
      console.error('[DB] Execute error:', error, 'SQL:', sql, 'Params:', params);
      throw error;
    }
  }

  /**
   * Execute multiple statements in a transaction
   */
  transaction<T>(fn: () => T): T {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run('BEGIN TRANSACTION');
    try {
      const result = fn();
      this.db.run('COMMIT');
      this.save();
      return result;
    } catch (error) {
      this.db.run('ROLLBACK');
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
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
    if (!this.db) return;
    this.db.run('VACUUM');
    this.save();
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
