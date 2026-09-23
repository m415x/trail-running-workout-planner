'use client'

import { UsersRound } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

interface CalendarGroup {
  id: string
  categoryCode: string
  levelCode: string
  isActive: boolean
}

interface GroupCalendarFilterProps {
  groups: CalendarGroup[]
  selectedGroupId: string
}

export function GroupCalendarFilter({ groups, selectedGroupId }: GroupCalendarFilterProps) {
  const t = useTranslations('Sessions')
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleGroupChange(groupId: string) {
    const params = new URLSearchParams(searchParams.toString())

    if (groupId) params.set('group', groupId)
    else params.delete('group')

    router.replace(params.size > 0 ? `${pathname}?${params.toString()}` : pathname)
  }

  return (
    <div className='flex items-center gap-2'>
      <UsersRound className='size-4 text-muted-foreground' aria-hidden='true' />
      <label htmlFor='calendar-group' className='text-sm font-medium'>{t('calendar.group')}</label>
      <select
        id='calendar-group'
        value={selectedGroupId}
        onChange={(event) => handleGroupChange(event.target.value)}
        className='border-input bg-background h-9 min-w-40 rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'
      >
        <option value=''>{t('calendar.allGroups')}</option>
        {groups.map((group) => {
          const code = `${group.categoryCode}${group.levelCode}`
          return <option key={group.id} value={group.id}>{code}{group.isActive ? '' : ` · ${t('calendar.inactive')}`}</option>
        })}
      </select>
    </div>
  )
}
