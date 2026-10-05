import assert from 'node:assert/strict'
import test from 'node:test'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import * as schema from '../../db/schema'
import { associateAuthorizedExternalIdentity } from '../../lib/identity/external-identity-link'

function fixture() {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'athlete',
      user_name TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      avatar TEXT
    );

    CREATE TABLE external_identity_links (
      id TEXT PRIMARY KEY,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      subject TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
      UNIQUE (provider, subject)
    );
  `)

  const db = drizzle(sqlite, { schema })
  const insertUser = sqlite.prepare(`
    INSERT INTO users (
      id, created_at, updated_at, role, user_name, email, first_name, last_name
    ) VALUES (?, ?, ?, 'athlete', ?, ?, ?, ?)
  `)

  insertUser.run(
    'user-a',
    '2026-10-05T15:00:00.000Z',
    '2026-10-05T15:00:00.000Z',
    'user.a',
    'shared-contact-a@example.test',
    'User',
    'A',
  )
  insertUser.run(
    'user-b',
    '2026-10-05T15:00:00.000Z',
    '2026-10-05T15:00:00.000Z',
    'user.b',
    'shared-contact-b@example.test',
    'User',
    'B',
  )

  return { sqlite, db }
}

const association = {
  linkId: 'identity-link-1',
  userId: 'user-a',
  provider: 'supabase',
  subject: 'provider-subject-123',
  linkedAt: '2026-10-05T15:30:00.000Z',
}

test('KAN-616 persists an explicitly authorized provider+subject link to one EPT User', () => {
  const { sqlite, db } = fixture()

  try {
    const result = associateAuthorizedExternalIdentity(db, association)

    assert.deepEqual(result, {
      id: association.linkId,
      userId: 'user-a',
      provider: 'supabase',
      subject: 'provider-subject-123',
      createdAt: association.linkedAt,
    })

    const stored = sqlite.prepare(`
      SELECT id, user_id, provider, subject
      FROM external_identity_links
      WHERE provider = ? AND subject = ?
    `).get(association.provider, association.subject)

    assert.deepEqual(stored, {
      id: 'identity-link-1',
      user_id: 'user-a',
      provider: 'supabase',
      subject: 'provider-subject-123',
    })
  } finally {
    sqlite.close()
  }
})

test('KAN-616 treats replay of the same provider+subject to the same User as idempotent', () => {
  const { sqlite, db } = fixture()

  try {
    const first = associateAuthorizedExternalIdentity(db, association)
    const replay = associateAuthorizedExternalIdentity(db, {
      ...association,
      linkId: 'identity-link-replay',
      linkedAt: '2026-10-05T15:31:00.000Z',
    })

    assert.deepEqual(replay, first)

    const count = sqlite.prepare(`
      SELECT COUNT(*) AS count
      FROM external_identity_links
      WHERE provider = ? AND subject = ?
    `).get(association.provider, association.subject) as { count: number }

    assert.equal(count.count, 1)
  } finally {
    sqlite.close()
  }
})

test('KAN-616 rejects provider+subject collision with a different EPT User', () => {
  const { sqlite, db } = fixture()

  try {
    associateAuthorizedExternalIdentity(db, association)

    assert.throws(
      () => associateAuthorizedExternalIdentity(db, {
        ...association,
        linkId: 'identity-link-collision',
        userId: 'user-b',
      }),
      /external identity collision/i,
    )

    const stored = sqlite.prepare(`
      SELECT user_id
      FROM external_identity_links
      WHERE provider = ? AND subject = ?
    `).get(association.provider, association.subject) as { user_id: string }

    assert.equal(stored.user_id, 'user-a')
  } finally {
    sqlite.close()
  }
})
