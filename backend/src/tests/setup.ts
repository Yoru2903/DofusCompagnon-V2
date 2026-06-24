import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

process.env.DATABASE_URL = 'file:./test.db';

const prismaDir = join(process.cwd(), 'prisma');
const databasePath = join(prismaDir, 'test.db');
const migrationsDir = join(prismaDir, 'migrations');
const db = new DatabaseSync(databasePath);

db.exec(`
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "checksum" TEXT NOT NULL,
  "finished_at" DATETIME,
  "migration_name" TEXT NOT NULL,
  "logs" TEXT,
  "rolled_back_at" DATETIME,
  "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);
`);

for (const migrationName of readdirSync(migrationsDir).sort()) {
  const migrationPath = join(migrationsDir, migrationName, 'migration.sql');

  if (!existsSync(migrationPath)) {
    continue;
  }

  const alreadyApplied = db
    .prepare('SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = ? LIMIT 1')
    .get(migrationName);

  if (alreadyApplied) {
    continue;
  }

  const sql = readFileSync(migrationPath, 'utf8');
  db.exec('BEGIN');

  try {
    db.exec(sql);
    db.prepare(
      `
      INSERT INTO "_prisma_migrations"
        ("id", "checksum", "finished_at", "migration_name", "applied_steps_count")
      VALUES
        (?, ?, CURRENT_TIMESTAMP, ?, 1)
      `,
    ).run(migrationName, 'vitest-sqlite-application', migrationName);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

db.close();
