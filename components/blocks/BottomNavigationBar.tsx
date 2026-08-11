'use client'

import { useState } from 'react'
import { colors, navItems } from '@/utils/constants'

export function BottomNavigationBar() {
  const [activeNav, setActiveNav] = useState<number>(0)
  return (
    <div
      className='absolute bottom-0 left-0 right-0 border-t border-border px-2 pb-8 pt-3'
      style={{ background: 'rgba(20,25,34,0.96)', backdropFilter: 'blur(20px)' }}
    >
      <div className='flex items-center justify-around'>
        {navItems.map(({ icon: Icon, label }, i) => {
          const isCenter = i === 2
          const isActive = activeNav === i
          return (
            <button
              key={i}
              onClick={() => setActiveNav(i)}
              className='flex flex-col items-center gap-1 transition-all duration-200'
              style={{
                ...(isCenter
                  ? {
                      background: colors.ORANGE,
                      borderRadius: '50%',
                      width: 52,
                      height: 52,
                      marginTop: -22,
                      boxShadow: `0 8px 24px ${colors.ORANGE}50`,
                      justifyContent: 'center',
                      display: 'flex',
                      alignItems: 'center',
                    }
                  : {}),
              }}
            >
              <Icon
                size={isCenter ? 22 : 20}
                style={{
                  color: isCenter ? 'white' : isActive ? colors.ORANGE : '#64748B',
                }}
              />
              {!isCenter && (
                <span
                  className='font-medium'
                  style={{
                    fontSize: 9,
                    color: isActive ? colors.ORANGE : '#64748B',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {label}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
