'use client'

import { useState, useTransition } from 'react'
import { confirmCoachSessionReviewSnapshot } from '@/app/actions/coach-session-review-snapshot-actions'

/** No CREATE import. Normal Next.js client bundling supplies the authentic action reference. */
export function Kan791IdempotencyProbeButton({
  planId,snapshotId,locale,
}: { planId:string; snapshotId:string; locale:string }) {
  const [busy,startTransition] = useTransition()
  const [error,setError] = useState<string|null>(null)
  return (
    <form action={data => {
      setError(null)
      startTransition(async () => {
        try {
          const result = await confirmCoachSessionReviewSnapshot(data)
          // A successful consumed/already_consumed result redirects inside
          // the production action. Observe the internal branch with debugger.
          setError('No redirect: '+result.kind)
        } catch {
          setError('Server Action failed: check the Network request and Node debugger')
        }
      })
    }}>
      <input type="hidden" name="planId" value={planId}/>
      <input type="hidden" name="snapshotId" value={snapshotId}/>
      <input type="hidden" name="locale" value={locale}/>
      <button type="submit" disabled={busy}>Repeat authenticated CONFIRM (existing consumed snapshot)</button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
