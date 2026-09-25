import { db } from '@/db'
import { MembershipPolicyCard } from '@/features/memberships/components/MembershipPolicyCard'
import { TeamEconomicPolicyForm } from '@/features/memberships/components/TeamEconomicPolicyForm'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
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

  const es = supportedLocale === 'es'

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-3xl font-bold tracking-tight'>{model.title}</h2>
      </div>

      <section className='space-y-3'>
        <h3 className='text-lg font-semibold'>
          {es ? 'Política vigente' : 'Current policy'}
        </h3>
        <MembershipPolicyCard model={model.currentPolicy} />
        {model.currentPolicy.effectiveUntil ? (
          <p className='text-sm text-muted-foreground'>
            {es ? 'Vigente hasta' : 'Effective until'}{' '}
            {model.currentPolicy.effectiveUntil}
          </p>
        ) : null}
      </section>

      {model.scheduledPolicies.length > 0 ? (
        <Accordion>
          <AccordionItem value='scheduled-policies'>
            <AccordionTrigger>
              {es ? 'Cambios programados' : 'Scheduled changes'}
            </AccordionTrigger>
            <AccordionContent className='space-y-4'>
              {model.scheduledPolicies.map((policy) => (
                <MembershipPolicyCard
                  key={policy.effectiveFrom}
                  model={policy}
                />
              ))}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}

      {model.pastPolicies.length > 0 ? (
        <Accordion>
          <AccordionItem value='policy-history'>
            <AccordionTrigger>
              {es ? 'Historial de políticas' : 'Policy history'}
            </AccordionTrigger>
            <AccordionContent className='space-y-4'>
              {model.pastPolicies.map((policy) => (
                <MembershipPolicyCard
                  key={policy.effectiveFrom}
                  model={policy}
                />
              ))}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}

      <TeamEconomicPolicyForm
        model={model.form}
        locale={supportedLocale}
      />
    </div>
  )
}
