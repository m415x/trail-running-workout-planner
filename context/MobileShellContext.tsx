'use client'

import React, { createContext, useContext, useState } from 'react'

interface MobileShellContextType {
  shellBgColor: string
  setShellBgColor: (color: string) => void
}

const MobileShellContext = createContext<MobileShellContextType>({
  shellBgColor: 'bg-background',
  setShellBgColor: () => {},
})

export function MobileShellProvider({ children }: { children: React.ReactNode }) {
  const [shellBgColor, setShellBgColor] = useState('bg-background')

  return <MobileShellContext.Provider value={{ shellBgColor, setShellBgColor }}>{children}</MobileShellContext.Provider>
}

export const useMobileShell = () => useContext(MobileShellContext)
