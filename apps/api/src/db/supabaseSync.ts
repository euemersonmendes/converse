import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { env } from '../config/env.js';
import { getDb } from './database.js';

let pool: Pool | null = null;
let backupTimer: ReturnType<typeof setTimeout> | null = null;
let backupInFlight = false;

function getPool(): Pool | null {
  if (!env.DATABASE_URL) return null;
  if (pool) return pool;

  const isLocal = env.DATABASE_URL.includes('localhost') || env.DATABASE_URL.includes('127.0.0.1');
  pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 5,
  });
  return pool;
}

/**
 * Inicializa as tabelas no Supabase (PostgreSQL) e restaura o último snapshot
 * do banco SQLite antes do servidor iniciar.
 */
export async function initSupabaseAndRestore(): Promise<void> {
  const pg = getPool();
  if (!pg) return;

  try {
    await pg.query(`
      CREATE TABLE IF NOT EXISTS converse_users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        phone TEXT UNIQUE NOT NULL,
        avatar_url TEXT NOT NULL,
        bio TEXT NOT NULL DEFAULT '',
        age INTEGER NOT NULL DEFAULT 25,
        city TEXT NOT NULL DEFAULT '',
        verified BOOLEAN NOT NULL DEFAULT FALSE,
        last_seen_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS converse_db_snapshot (
        id TEXT PRIMARY KEY,
        db_bytes BYTEA NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const res = await pg.query<{ db_bytes: Buffer }>(
      `SELECT db_bytes FROM converse_db_snapshot WHERE id = 'primary' LIMIT 1`
    );
    const row = res.rows[0];
    if (row?.db_bytes && row.db_bytes.length > 0 && env.DB_PATH !== ':memory:') {
      fs.mkdirSync(path.dirname(env.DB_PATH), { recursive: true });
      for (const suffix of ['-wal', '-shm']) {
        const walPath = `${env.DB_PATH}${suffix}`;
        if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      }
      fs.writeFileSync(env.DB_PATH, row.db_bytes);
      console.info(`[Supabase] Banco restaurado (${row.db_bytes.length} bytes).`);
    } else {
      console.info('[Supabase] Conectado. Nenhum snapshot anterior encontrado; iniciando banco novo.');
    }
  } catch (err) {
    console.error('[Supabase] Erro ao restaurar snapshot inicial:', err);
  }
}

/** Sincroniza um usuário específico para a tabela `converse_users` no Supabase. */
export async function syncUserToSupabase(userId: string): Promise<void> {
  const pg = getPool();
  if (!pg) return;

  try {
    const db = getDb();
    const row = db
      .prepare(
        'SELECT id, username, display_name, phone, avatar_url, bio, age, city, verified, last_seen_at FROM users WHERE id = ?'
      )
      .get(userId) as
      | {
          id: string;
          username: string;
          display_name: string;
          phone: string;
          avatar_url: string;
          bio: string;
          age: number;
          city: string;
          verified: number;
          last_seen_at: string;
        }
      | undefined;

    if (!row) return;

    await pg.query(
      `INSERT INTO converse_users (id, username, display_name, phone, avatar_url, bio, age, city, verified, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         username = EXCLUDED.username,
         display_name = EXCLUDED.display_name,
         phone = EXCLUDED.phone,
         avatar_url = EXCLUDED.avatar_url,
         bio = EXCLUDED.bio,
         age = EXCLUDED.age,
         city = EXCLUDED.city,
         verified = EXCLUDED.verified,
         last_seen_at = EXCLUDED.last_seen_at`,
      [
        row.id,
        row.username,
        row.display_name,
        row.phone,
        row.avatar_url,
        row.bio,
        row.age,
        row.city,
        Boolean(row.verified),
        row.last_seen_at,
      ]
    );
  } catch (err) {
    console.error('[Supabase] Erro ao sincronizar usuário:', err);
  }
}

/** Faz checkpoint do SQLite e salva o snapshot completo no Supabase. */
export async function backupDbToSupabase(): Promise<void> {
  const pg = getPool();
  if (!pg || env.DB_PATH === ':memory:' || backupInFlight) return;

  backupInFlight = true;
  try {
    const db = getDb();
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    if (!fs.existsSync(env.DB_PATH)) return;
    const bytes = fs.readFileSync(env.DB_PATH);

    await pg.query(
      `INSERT INTO converse_db_snapshot (id, db_bytes, updated_at)
       VALUES ('primary', $1, NOW())
       ON CONFLICT (id) DO UPDATE SET
         db_bytes = EXCLUDED.db_bytes,
         updated_at = NOW()`,
      [bytes]
    );
  } catch (err) {
    console.error('[Supabase] Erro ao salvar snapshot do banco:', err);
  } finally {
    backupInFlight = false;
  }
}

/** Agenda backup imediato do usuário (se informado) e snapshot completo debounced. */
export function scheduleSupabaseSync(userId?: string): void {
  if (!env.DATABASE_URL) return;

  if (userId) {
    void syncUserToSupabase(userId);
  }

  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = setTimeout(() => {
    backupTimer = null;
    void backupDbToSupabase();
  }, 1200);
}
