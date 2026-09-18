'use client'

import { useRouter } from 'next/navigation'
import { useDirtyFormGuard } from './dirty-form-guard'

export function useGuardedRouter() {
  const router = useRouter()
  const { guardNavigation } = useDirtyFormGuard()

  return {
    push(href: string) {
      guardNavigation(() => router.push(href))
    },
    replace(href: string) {
      guardNavigation(() => router.replace(href))
    },
    back() {
      guardNavigation(() => router.back())
    },
  }
}
