'use client'

import { createContext, useContext } from 'react'

/** Navigation discoverability from the authenticated Coach layout, never authorization. */
export const CoachHomeDestinationsContext = createContext<readonly string[]>([])

export function useCoachHomeDestinations() {
  return useContext(CoachHomeDestinationsContext)
}
