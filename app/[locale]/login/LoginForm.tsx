'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'

import { loginAction, type LoginActionState } from '@/app/actions/auth-actions'

const initialState: LoginActionState = { status: 'idle' }

export function LoginForm({
  locale,
  returnTo,
}: {
  locale: 'es' | 'en'
  returnTo: string
}) {
  const t = useTranslations('Login')
  const [state, action, pending] = useActionState(loginAction, initialState)

  const message = state.status === 'invalid_credentials'
    ? t('invalidCredentials')
    : state.status === 'unlinked'
      ? t('unlinked')
      : state.status === 'invalid'
        ? t('invalid')
        : null

  return (
    <form action={action} className='flex w-full max-w-sm flex-col gap-4'>
      <input type='hidden' name='locale' value={locale} />
      <input type='hidden' name='returnTo' value={returnTo} />

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

      <div className='flex flex-col gap-2'>
        <label htmlFor='password' className='text-sm font-medium'>
          {t('password')}
        </label>
        <input
          id='password'
          name='password'
          type='password'
          autoComplete='current-password'
          required
          className='h-10 rounded-md border bg-background px-3 text-sm'
        />
      </div>

      <a
        href={locale === 'en' ? '/en/auth/recovery' : '/es/auth/recovery'}
        className='text-sm underline underline-offset-4'
      >
        {t('forgotPassword')}
      </a>

      {message ? (
        <p role='alert' className='text-sm text-destructive'>
          {message}
        </p>
      ) : null}

      <button
        type='submit'
        disabled={pending}
        className='h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60'
      >
        {pending ? t('submitting') : t('submit')}
      </button>
    </form>
  )
}
