import { getTranslations } from 'next-intl/server'
import { createSupabaseServerClient } from '@/lib/auth/supabase-server'
import { createExternalIdentityLookup } from '@/lib/auth/external-identity-lookup'
import { readEptSessionAccessState } from '@/lib/auth/ept-session-access'
import { requireAuthenticatedEptAction } from '@/lib/auth/require-authenticated-action'
import { createActiveTeamNextServerContext } from '@/lib/authorization/active-team-next-server'
import { createH4aAuthorizationAdapter } from '@/lib/authorization/h4a-authorization-adapter'
import { createH4aNextServerEvidenceSource } from '@/lib/authorization/h4a-next-server-authorization'
import { createMembershipAuthorizedPageReader } from '@/lib/memberships/membership-authorized-page-reader'
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
import { membershipPageCalendarDate } from '@/lib/memberships/membership-page-date'
import { APPLICATION_REGIONAL_FALLBACKS } from '@/lib/regionalization/application-regional-context'
import { createTeamEconomicPolicyQueryRepository } from '@/lib/memberships/membership-policy-drizzle-query'
import { TeamMonthlyMaterializationForm } from '@/features/memberships/components/TeamMonthlyMaterializationForm'

interface MembershipPageProps {
  params: Promise<{ locale: string }>
}

const loadMembershipPage = createMembershipPageLoader({
  createRepository: createTeamEconomicPolicyQueryRepository,
})

const readAuthorizedMembershipPage = createMembershipAuthorizedPageReader({
  authenticate: async () => {
    const supabase = await createSupabaseServerClient()
    return requireAuthenticatedEptAction({
      readAccess: () => readEptSessionAccessState(supabase.auth, createExternalIdentityLookup()),
    })
  },
  resolveActiveTeam: (userId) => createActiveTeamNextServerContext().resolve(userId),
  authorize: (access, teamId, at) => createH4aAuthorizationAdapter(
    createH4aNextServerEvidenceSource(),
  ).authorize(access, {
    teamId, capability: 'economic_policy.manage', resource: { teamId }, at,
  }),
  load: loadMembershipPage,
  hasData: (model) => Boolean(
    model.currentPolicy.effectiveFrom
    || model.scheduledPolicies.length
    || model.pastPolicies.length
    || model.globalDueDateExceptionHistory.length,
  ),
})

export default async function MembershipPage({ params }: MembershipPageProps) {
  const { locale } = await params
  const supportedLocale = locale === 'en' ? 'en' : 'es'
  const result = await readAuthorizedMembershipPage({
    db,
    locale: supportedLocale,
    onDate: membershipPageCalendarDate(APPLICATION_REGIONAL_FALLBACKS.timeZone),
  })
  if (result.status !== 'ready' && result.status !== 'empty') {
    const messages = supportedLocale === 'es'
      ? {
          selection_required: 'Seleccioná un equipo para consultar Membresía.',
          invalid_context: 'La selección del equipo no es válida.',
          denied: 'No tenés autorización para consultar esta sección.',
          error: 'No se pudo cargar la información de Membresía.',
        }
      : {
          selection_required: 'Select a team to view Membership.',
          invalid_context: 'The selected team is invalid.',
          denied: 'You are not authorized to view this section.',
          error: 'Membership information could not be loaded.',
        }
    return <p role='status' className='text-sm text-muted-foreground'>{messages[result.status]}</p>
  }
  const model = result.model
  const t = await getTranslations({ locale, namespace: 'Membership' })

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-3xl font-bold tracking-tight'>{model.title}</h2>
      </div>

      <section className='space-y-3'>
        <h3 className='text-lg font-semibold'>
          {t('page.currentPolicy')}
        </h3>
        <MembershipPolicyCard model={model.currentPolicy} />
        {model.currentPolicy.effectiveUntil ? (
          <p className='text-sm text-muted-foreground'>
            {t('page.effectiveUntil')}{' '}
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
              {t('page.scheduledChanges', { count: model.scheduledPolicies.length })}
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
              {t('page.policyHistory', { count: model.pastPolicies.length })}
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

      <TeamMonthlyMaterializationForm locale={supportedLocale} />

      <GlobalDueDateExceptionForm locale={supportedLocale} />
      {model.globalDueDateExceptionHistory.length > 0 ? (
        <section className='space-y-2'>
          <h3 className='font-medium'>{t('page.exceptionHistory')}</h3>
          <ul className='text-sm text-muted-foreground'>
            {model.globalDueDateExceptionHistory.map((revision) => (
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
