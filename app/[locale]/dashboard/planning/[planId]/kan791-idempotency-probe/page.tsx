import { notFound } from 'next/navigation'
import postgres from 'postgres'
import { Kan791IdempotencyProbeButton } from './probe-button'

const PLAN = 'kan791-annual-pg-239-plan'
const SNAPSHOT = '7939a67f-51f9-49f8-ba76-4f9b82ee5ed4'

/**
 * Development-only E2E entry. It supplies a genuine Next.js Server Action
 * reference by normal React bundling, never a reconstructed action ID.
 * The product action retains all H2/H3/H4A checks.
 */
export default async function Kan791IdempotencyProbePage({
  params,
}: { params: Promise<{ locale: string; planId: string }> }) {
  if (process.env.NODE_ENV !== 'development' ||
      process.env.KAN791_ENABLE_IDEMPOTENCY_PROBE !== '1') notFound()

  const { locale, planId } = await params
  if (planId !== PLAN || !['es', 'en'].includes(locale)) notFound()

  const url = process.env.SUPABASE_DATABASE_URL
  if (!url) notFound()
  const target = new URL(url)
  if (!['postgres:', 'postgresql:'].includes(target.protocol) ||
      target.hostname !== '127.0.0.1' ||
      target.port !== '55439' ||
      target.pathname !== '/kan791_acceptance_v2' ||
      target.search || target.hash) notFound()

  const sql = postgres(url, { max: 1, prepare: false })
  try {
    const rows = await sql.begin(async tx => {
      await tx`SET TRANSACTION READ ONLY`
      return tx<{ status: string; resultReference: string | null; consumedAt: string | null }[]>`
        SELECT status, result_reference AS "resultReference",
          consumed_at AS "consumedAt"
        FROM session_generation_review_snapshots
        WHERE id = ${SNAPSHOT} AND group_training_plan_id = ${PLAN}
      `
    })
    if (rows.length !== 1 || rows[0].status !== 'consumed' ||
        !rows[0].resultReference || !rows[0].consumedAt) notFound()
    return (
      <main className="p-8 space-y-4">
        <h1>KAN-791 — idempotency E2E probe (development only)</h1>
        <p>Consumed snapshot: {SNAPSHOT}</p>
        <p>Expected durable reference: {rows[0].resultReference}</p>
        <Kan791IdempotencyProbeButton planId={PLAN} snapshotId={SNAPSHOT} locale={locale}/>
      </main>
    )
  } finally {
    await sql.end()
  }
}
