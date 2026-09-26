import { db } from '@/db'
import { MembershipPolicyCard } from '@/features/memberships/components/MembershipPolicyCard'
import { TeamEconomicPolicyForm } from '@/features/memberships/components/TeamEconomicPolicyForm'
import { GlobalDueDateExceptionForm } from '@/features/memberships/components/GlobalDueDateExceptionForm'
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
  const globalDueDateExceptionHistory: Array<{
    id: string
    year: number
    month: number
    dueDate: string
    reason: string
    isCurrent: boolean
  }> = []

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
          <AccordionItem
            value='scheduled-policies'
            className='overflow-hidden rounded-lg border border-border bg-card'
          >
            <AccordionTrigger className='px-4 py-3 text-base font-semibold hover:no-underline'>
              {es
                ? `Cambios programados (${model.scheduledPolicies.length})`
                : `Scheduled changes (${model.scheduledPolicies.length})`}
            </AccordionTrigger>
            <AccordionContent className='px-4 pb-4'>
              <div className='divide-y divide-border'>
                {model.scheduledPolicies.map((policy) => (
                  <dl
                    key={policy.effectiveFrom}
                    className='grid gap-4 py-4 first:pt-2 last:pb-0 sm:grid-cols-2'
                  >
                    <div>
                      <dt className='text-sm text-muted-foreground'>{policy.monthlyAmountLabel}</dt>
                      <dd className='mt-1 font-medium'>{policy.monthlyAmount}</dd>
                    </div>
                    <div>
                      <dt className='text-sm text-muted-foreground'>{policy.currencyLabel}</dt>
                      <dd className='mt-1 font-medium'>{policy.currency}</dd>
                    </div>
                    <div>
                      <dt className='text-sm text-muted-foreground'>{policy.dueDayLabel}</dt>
                      <dd className='mt-1 font-medium'>{policy.dueDay}</dd>
                    </div>
                    <div>
                      <dt className='text-sm text-muted-foreground'>{policy.effectiveFromLabel}</dt>
                      <dd className='mt-1 font-medium'>{policy.effectiveFrom}</dd>
                    </div>
                  </dl>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}

      {model.pastPolicies.length > 0 ? (
        <Accordion>
          <AccordionItem
            value='policy-history'
            className='overflow-hidden rounded-lg border border-border bg-card'
          >
            <AccordionTrigger className='px-4 py-3 text-base font-semibold hover:no-underline'>
              {es
                ? `Historial de políticas (${model.pastPolicies.length})`
                : `Policy history (${model.pastPolicies.length})`}
            </AccordionTrigger>
            <AccordionContent className='px-4 pb-4'>
              <div className='divide-y divide-border'>
                {model.pastPolicies.map((policy) => (
                  <dl
                    key={policy.effectiveFrom}
                    className='grid gap-4 py-4 first:pt-2 last:pb-0 sm:grid-cols-2'
                  >
                    <div>
                      <dt className='text-sm text-muted-foreground'>{policy.monthlyAmountLabel}</dt>
                      <dd className='mt-1 font-medium'>{policy.monthlyAmount}</dd>
                    </div>
                    <div>
                      <dt className='text-sm text-muted-foreground'>{policy.currencyLabel}</dt>
                      <dd className='mt-1 font-medium'>{policy.currency}</dd>
                    </div>
                    <div>
                      <dt className='text-sm text-muted-foreground'>{policy.dueDayLabel}</dt>
                      <dd className='mt-1 font-medium'>{policy.dueDay}</dd>
                    </div>
                    <div>
                      <dt className='text-sm text-muted-foreground'>{policy.effectiveFromLabel}</dt>
                      <dd className='mt-1 font-medium'>{policy.effectiveFrom}</dd>
                    </div>
                  </dl>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}

      <GlobalDueDateExceptionForm locale={supportedLocale} />
      {globalDueDateExceptionHistory.length > 0 ? (
        <section className='space-y-2'>
          <h3 className='font-medium'>{es ? 'Historial de excepciones' : 'Exception history'}</h3>
          <ul className='text-sm text-muted-foreground'>
            {globalDueDateExceptionHistory.map((revision) => (
              <li key={revision.id}>
                {`${revision.year}-${String(revision.month).padStart(2, '0')} · ${revision.dueDate} · ${revision.reason}`}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <TeamEconomicPolicyForm
        model={model.form}
        locale={supportedLocale}
      />
    </div>
  )
}
