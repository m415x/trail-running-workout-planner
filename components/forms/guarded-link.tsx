'use client'

import Link, { type LinkProps } from 'next/link'
import type { ComponentProps } from 'react'
import { useDirtyFormGuard } from './dirty-form-guard'

type GuardedLinkProps = LinkProps & Omit<ComponentProps<'a'>, keyof LinkProps>

export function GuardedLink({ onNavigate, ...props }: GuardedLinkProps) {
  const { guardNavigation } = useDirtyFormGuard()

  return (
    <Link
      {...props}
      onNavigate={(event) => {
        onNavigate?.(event)
        if (event.defaultPrevented) return

        event.preventDefault()
        guardNavigation(() => {
          window.location.assign(event.currentTarget.href)
        })
      }}
    />
  )
}
