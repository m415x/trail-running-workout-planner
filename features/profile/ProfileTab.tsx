'use client'

import { currentUser } from '@/data/data'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ui/tabs'
import { ProfileHeader } from '@/features/profile/components/ProfileHeader'
import { AthleteTabContent } from '@profile/components/AthleteTabContent'
import { GearTabContent } from '@profile/components/GearTabContent'
import { SettingsTabContent } from '@profile/components/SettingsTabContent'

export function ProfileTab() {
  return (
    <div className='space-y-4'>
      {/* Hero Header */}
      <ProfileHeader user={currentUser} />

      {/* Profile Tabs */}
      <Tabs defaultValue='athlete' className='w-full'>
        <TabsList className='w-full grid grid-cols-3 bg-secondary/60 p-1 rounded-2xl h-10'>
          <TabsTrigger value='athlete' className='rounded-xl text-xs font-semibold'>
            Fisiología
          </TabsTrigger>
          <TabsTrigger value='gear' className='rounded-xl text-xs font-semibold'>
            Material
          </TabsTrigger>
          <TabsTrigger value='settings' className='rounded-xl text-xs font-semibold'>
            Ajustes
          </TabsTrigger>
        </TabsList>

        <TabsContent value='athlete'>
          <AthleteTabContent />
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
