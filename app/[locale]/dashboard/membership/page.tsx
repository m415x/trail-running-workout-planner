import { db } from '@/db'
import { MembershipPolicyCard } from '@/features/memberships/components/MembershipPolicyCard'
import { TeamEconomicPolicyForm } from '@/features/memberships/components/TeamEconomicPolicyForm'
import { createMembershipPageLoader } from '@/lib/memberships/membership-page-loader'
import { todayInArgentina } from '@/lib/memberships/membership-page-date'
import { createTeamEconomicPolicyQueryRepository } from '@/lib/memberships/membership-policy-drizzle-query'

interface MembershipPageProps {
  params: Promise<{ locale: string }>
}

const loadMembershipPage = createMembershipPageLoader({
  createRepository: createTeamEconomicPolicyQueryRepository,
})

export default async function MembershipPage({ params }: MembershipPageProps) {
  const { locale } = await params
  const supportedLocale = locale === 'en' ? 'en' : 'es'
  const model = await loadMembershipPage({
    db,
    locale: supportedLocale,
    teamId: 'team_1',
    onDate: todayInArgentina(),
  })

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-3xl font-bold tracking-tight'>{model.title}</h2>
      </div>

      <MembershipPolicyCard model={model.policy} />
      <TeamEconomicPolicyForm
        model={model.form}
        locale={supportedLocale}
      />
    </div>
  )
}
