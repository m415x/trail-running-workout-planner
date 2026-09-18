'use client'

import Link, { type LinkProps } from 'next/link'
import { useRouter } from 'next/navigation'
import type { ComponentProps } from 'react'
import { useDirtyFormGuard } from './dirty-form-guard'

type GuardedLinkProps = LinkProps & Omit<ComponentProps<'a'>, keyof LinkProps>

export function GuardedLink({ href, onNavigate, ...props }: GuardedLinkProps) {
  const router = useRouter()
  const { guardNavigation } = useDirtyFormGuard()

  return (
    <Link
      {...props}
      href={href}
      onNavigate={(event) => {
        onNavigate?.(event)
        event.preventDefault()

        guardNavigation(() => {
          router.push(href.toString())
        })
      }}
    />
  )
}
