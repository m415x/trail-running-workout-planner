'use server'
import Database from 'better-sqlite3'

export async function submitProbe(data: FormData): Promise<void> {
  const path = process.env.KAN786_SQLITE_PATH
  if (!path) throw new Error('KAN786_SQLITE_PATH required')
  const proposal = data.get('proposal')
  const explanations = data.get('generationExplanations')
  if (typeof proposal !== 'string' || typeof explanations !== 'string') throw new Error('Missing string fields')
  JSON.parse(proposal)
  JSON.parse(explanations)
  const db = new Database(path, { fileMustExist: true })
  try { db.prepare('INSERT INTO receipts (proposal_bytes, explanation_bytes) VALUES (?, ?)').run(Buffer.byteLength(proposal), Buffer.byteLength(explanations)) }
  finally { db.close() }
}
