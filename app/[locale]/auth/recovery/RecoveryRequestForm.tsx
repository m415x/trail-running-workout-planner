'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'

import {
  requestPasswordRecoveryAction,
  type PasswordRecoveryRequestActionState,
} from '@/app/actions/auth-actions'

const initialState: PasswordRecoveryRequestActionState = { status: 'idle' }

export function RecoveryRequestForm({ locale }: { locale: 'es' | 'en' }) {
  const t = useTranslations('Recovery')
  const [state, action, pending] = useActionState(
    requestPasswordRecoveryAction,
    initialState,
  )

  return (
    <form action={action} className='flex w-full max-w-sm flex-col gap-4'>
      <input type='hidden' name='locale' value={locale} />

      <div className='flex flex-col gap-2'>
        <label htmlFor='email' className='text-sm font-medium'>
          {t('email')}
        </label>
        <input
          id='email'
          name='email'
          type='email'
          autoComplete='email'
          required
          className='h-10 rounded-md border bg-background px-3 text-sm'
        />
      </div>

      {state.status === 'accepted' ? (
        <p role='status' className='text-sm text-muted-foreground'>
          {t('accepted')}
        </p>
      ) : null}

      {state.status === 'error' ? (
        <p role='alert' className='text-sm text-destructive'>
          {t('requestError')}
        </p>
      ) : null}

      <button
        type='submit'
        disabled={pending}
        className='h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60'
      >
        {pending ? t('requestSubmitting') : t('requestSubmit')}
      </button>
    </form>
  )
}
