'use client'

import { useTranslations } from 'next-intl'
import type { ProfileSelfHeader } from '@/lib/athletes/profile-self-read'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ui/tabs'
import { ProfileHeader } from '@/features/profile/components/ProfileHeader'
import { AthleteTabContent, type AthleteSelfPerformance } from '@profile/components/AthleteTabContent'
import type { BiometricSelfState } from '@profile/components/BiometricSelfEditor'
import { SettingsTabContent } from '@profile/components/SettingsTabContent'

export function ProfileTab({ membershipStatus, performance, performanceStatus, athleteProfile, biometrics, biometricsStatus }: { membershipStatus?: React.ReactNode; performance?: AthleteSelfPerformance | null; performanceStatus?: 'loaded' | 'unknown' | 'denied' | 'error'; athleteProfile?: ProfileSelfHeader; biometrics?: BiometricSelfState | null; biometricsStatus?: 'loaded' | 'denied' | 'error' }) {
  const t = useTranslations('AthleteProfile')

  return (
    <div className='mx-auto w-full max-w-5xl space-y-4 px-4 py-6 sm:px-6'>
      {/* Hero Header */}
      {athleteProfile && <ProfileHeader athlete={athleteProfile} />}

      {membershipStatus}

      {/* Profile Tabs */}
      <Tabs defaultValue='athlete' className='w-full'>
        <TabsList className='grid h-auto min-w-0 max-w-full w-full grid-cols-2 rounded-2xl bg-secondary/60 p-1 group-data-horizontal/tabs:h-auto sm:mx-auto sm:gap-1 sm:rounded-[var(--radius-ept-overlay)] sm:border sm:shadow-[var(--elevation-ept-overlay)]'>
          <TabsTrigger value='athlete' className='min-w-0 min-h-11 h-auto rounded-xl text-center whitespace-normal break-words text-[length:var(--athlete-text-label)] font-semibold'>
            {t('tabs.physiology')}
          </TabsTrigger>
          <TabsTrigger value='settings' className='min-w-0 min-h-11 h-auto rounded-xl text-center whitespace-normal break-words text-[length:var(--athlete-text-label)] font-semibold'>
            {t('tabs.settings')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value='athlete'>
          <AthleteTabContent performance={performance} performanceStatus={performanceStatus} biometrics={biometrics} biometricsStatus={biometricsStatus} />
        </TabsContent>

        <TabsContent value='settings'>
          <SettingsTabContent />
        </TabsContent>
      </Tabs>
    </div>
  )
}
