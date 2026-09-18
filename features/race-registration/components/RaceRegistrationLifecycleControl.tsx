'use client'

import { useRef } from 'react'

import { updateRaceRegistrationLifecycleFormAction } from '@/app/actions/race-registration-actions'
import { ConfirmActionDialog } from '@/components/ui/custom/confirm-dialog'
import { Button } from '@ui/button'

export function RaceRegistrationLifecycleControl({
  locale,
  registrationId,
  registrationStatus,
  athleteName,
  courseLabel,
  labels,
}: {
  locale: string
  registrationId: string
  registrationStatus: 'registered' | 'cancelled'
  athleteName: string
  courseLabel: string
  labels: {
    cancelRegistration: string
    reactivateRegistration: string
    cancelConfirmTitle: string
    cancelConfirmDescription: string
    cancelConfirmAction: string
    cancelConfirmKeep: string
  }
}) {
  const cancelFormRef = useRef<HTMLFormElement>(null)

  if (registrationStatus === 'cancelled') {
    return (
      <form action={updateRaceRegistrationLifecycleFormAction}>
        <input type='hidden' name='locale' value={locale} />
        <input type='hidden' name='registrationId' value={registrationId} />
        <input type='hidden' name='registrationStatus' value='registered' />
        <Button type='submit' size='sm' variant='outline'>
          {labels.reactivateRegistration}
        </Button>
      </form>
    )
  }

  return (
    <>
      <form ref={cancelFormRef} action={updateRaceRegistrationLifecycleFormAction} className='hidden'>
        <input type='hidden' name='locale' value={locale} />
        <input type='hidden' name='registrationId' value={registrationId} />
        <input type='hidden' name='registrationStatus' value='cancelled' />
      </form>

      <ConfirmActionDialog
        title={labels.cancelConfirmTitle}
        description={labels.cancelConfirmDescription
          .replace('{athlete}', athleteName)
          .replace('{course}', courseLabel)}
        confirmLabel={labels.cancelConfirmAction}
        cancelLabel={labels.cancelConfirmKeep}
        variant='destructive'
        onConfirm={() => cancelFormRef.current?.requestSubmit()}
        trigger={(openDialog) => (
          <Button type='button' size='sm' variant='outline' onClick={openDialog}>
            {labels.cancelRegistration}
          </Button>
        )}
      />
    </>
  )
}
