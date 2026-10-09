'use client'

import { useTranslations } from 'next-intl'
import { currentUser } from '@/data/data'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ui/tabs'
import { ProfileHeader } from '@/features/profile/components/ProfileHeader'
import { AthleteTabContent, type AthleteSelfPerformance } from '@profile/components/AthleteTabContent'
import { GearTabContent } from '@profile/components/GearTabContent'
import { SettingsTabContent } from '@profile/components/SettingsTabContent'

export function ProfileTab({ membershipStatus, performance, performanceStatus }: { membershipStatus?: React.ReactNode; performance?: AthleteSelfPerformance | null; performanceStatus?: 'loaded' | 'unknown' | 'denied' | 'error' }) {
  const t = useTranslations('AthleteProfile')

  return (
    <div className='mx-auto w-full max-w-5xl space-y-4 px-4 py-6 sm:px-6'>
      {/* Hero Header */}
      <ProfileHeader user={currentUser} />

      {membershipStatus}

      {/* Profile Tabs */}
      <Tabs defaultValue='athlete' className='w-full'>
        <TabsList className='grid h-10 w-full grid-cols-3 rounded-2xl bg-secondary/60 p-1 sm:mx-auto sm:w-auto sm:gap-1 sm:rounded-[var(--radius-ept-overlay)] sm:border sm:shadow-[var(--elevation-ept-overlay)]'>
          <TabsTrigger value='athlete' className='rounded-xl text-xs font-semibold'>
            {t('tabs.physiology')}
          </TabsTrigger>
          <TabsTrigger value='gear' className='rounded-xl text-xs font-semibold'>
            {t('tabs.gear')}
          </TabsTrigger>
          <TabsTrigger value='settings' className='rounded-xl text-xs font-semibold'>
            {t('tabs.settings')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value='athlete'>
          <AthleteTabContent performance={performance} performanceStatus={performanceStatus} />
        </TabsContent>

        <TabsContent value='gear'>
          <GearTabContent />
        </TabsContent>

        <TabsContent value='settings'>
          <SettingsTabContent />
        </TabsContent>
      </Tabs>
    </div>
  )
}
