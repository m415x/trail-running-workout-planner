'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'

import {
  completePasswordRecoveryAction,
  type PasswordRecoveryUpdateActionState,
} from '@/app/actions/auth-actions'

const initialState: PasswordRecoveryUpdateActionState = { status: 'idle' }

export function RecoveryResetForm({ locale }: { locale: 'es' | 'en' }) {
  const t = useTranslations('Recovery')
  const [state, action, pending] = useActionState(
    completePasswordRecoveryAction,
    initialState,
  )

  return (
    <form action={action} className='flex w-full max-w-sm flex-col gap-4'>
      <input type='hidden' name='locale' value={locale} />

      <div className='flex flex-col gap-2'>
        <label htmlFor='password' className='text-sm font-medium'>
          {t('newPassword')}
        </label>
        <input
          id='password'
          name='password'
          type='password'
          autoComplete='new-password'
          required
          className='h-10 rounded-md border bg-background px-3 text-sm'
        />
      </div>

      {state.status === 'invalid' ? (
        <p role='alert' className='text-sm text-destructive'>
          {t('invalidReset')}
        </p>
      ) : null}

      <button
        type='submit'
        disabled={pending}
        className='h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60'
      >
        {pending ? t('resetSubmitting') : t('resetSubmit')}
      </button>
    </form>
  )
}
