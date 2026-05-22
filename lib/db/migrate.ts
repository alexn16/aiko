import { db } from '@/lib/db/client'
import * as fs from 'fs'
import * as path from 'path'

export async function runMigrations() {
  // Create migrations tracking table
  await db.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  const migrationsDir = path.join(process.cwd(), 'lib', 'db', 'migrations')
  let files: string[]
  try {
    files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort()
  } catch {
    console.warn('[migrate] migrations dir not found, skipping')
    return
  }

  for (const file of files) {
    const applied = await db.query('SELECT 1 FROM _migrations WHERE filename=$1', [file])
    if (applied.rows.length > 0) continue

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    try {
      await db.query(sql)
      await db.query('INSERT INTO _migrations (filename) VALUES ($1)', [file])
      console.log(`[migrate] applied ${file}`)
    } catch (err) {
      console.error(`[migrate] error applying ${file}:`, err)
    }
  }
}
