import Link from 'next/link'
import { Copy, FilterX, Pencil, Plus, Search } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { duplicateWorkoutTemplate, getWorkoutTemplates } from '@/app/actions/workout-template-actions'
import type { WorkoutTemplateArchiveFilter, WorkoutTemplateCategory, WorkoutTemplateSearchCriteria, WorkoutType } from '@/types'
import { Badge } from '@ui/badge'
import { buttonVariants } from '@ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'

const categories: WorkoutTemplateCategory[] = ['endurance', 'quality', 'mountain', 'technique', 'recovery', 'competition']
const workoutTypes: WorkoutType[] = ['Base', 'Long', 'Intervals', 'Trail', 'Speed', 'Fartlek', 'PAM', 'Hills', 'Race', 'Rest']
const archiveFilters: WorkoutTemplateArchiveFilter[] = ['active', 'archived', 'all']

interface WorkoutTemplatesPageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function scalar(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : ''
}

function isCategory(value: string): value is WorkoutTemplateCategory {
  return categories.some((category) => category === value)
}

function isWorkoutType(value: string): value is WorkoutType {
  return workoutTypes.some((type) => type === value)
}

function isArchiveFilter(value: string): value is WorkoutTemplateArchiveFilter {
  return archiveFilters.some((filter) => filter === value)
}

export default async function WorkoutTemplatesPage({ params, searchParams }: WorkoutTemplatesPageProps) {
  const [{ locale }, query, t, workoutTypeLabel] = await Promise.all([
    params,
    searchParams,
    getTranslations('WorkoutTemplates'),
    getTranslations('Workouts.types'),
  ])
  const queryText = scalar(query.q).trim()
  const category = scalar(query.category)
  const workoutType = scalar(query.type)
  const tag = scalar(query.tag)
  const requestedArchive = scalar(query.archive)
  const archive = isArchiveFilter(requestedArchive) ? requestedArchive : 'active'
  const criteria: WorkoutTemplateSearchCriteria = {
    query: queryText,
    categories: isCategory(category) ? [category] : undefined,
    workoutTypes: isWorkoutType(workoutType) ? [workoutType] : undefined,
    tags: tag ? [tag] : undefined,
    archive,
  }
  const { templates, availableTags } = await getWorkoutTemplates(criteria)
  const templatesPath = locale === 'es' ? '/dashboard/templates' : `/${locale}/dashboard/templates`
  const hasFilters = Boolean(queryText || category || workoutType || tag || archive !== 'active')

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>{t('title')}</h2>
          <p className='text-muted-foreground'>{t('description')}</p>
        </div>
        <Link href={`${templatesPath}/new`} className={buttonVariants()}><Plus /> {t('new')}</Link>
      </div>

      <Card>
        <CardContent>
          <form method='get' className='grid gap-3 lg:grid-cols-[minmax(14rem,2fr)_repeat(4,minmax(9rem,1fr))_auto] lg:items-end'>
            <label className='space-y-1.5 text-sm font-medium'>
              <span>{t('filters.search')}</span>
              <div className='relative'>
                <Search className='pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground' />
                <input
                  name='q'
                  defaultValue={queryText}
                  placeholder={t('filters.searchPlaceholder')}
                  className='h-8 w-full rounded-lg border border-input bg-background py-1 pr-2.5 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'
                />
              </div>
            </label>
            <FilterSelect name='category' label={t('filters.category')} defaultValue={category}>
              <option value=''>{t('filters.allCategories')}</option>
              {categories.map((value) => <option key={value} value={value}>{t(`categories.${value}`)}</option>)}
            </FilterSelect>
            <FilterSelect name='type' label={t('filters.type')} defaultValue={workoutType}>
              <option value=''>{t('filters.allTypes')}</option>
              {workoutTypes.map((value) => <option key={value} value={value}>{workoutTypeLabel(value)}</option>)}
            </FilterSelect>
            <FilterSelect name='tag' label={t('filters.tag')} defaultValue={tag}>
              <option value=''>{t('filters.allTags')}</option>
              {availableTags.map((value) => <option key={value} value={value}>{value}</option>)}
            </FilterSelect>
            <FilterSelect name='archive' label={t('filters.status')} defaultValue={archive}>
              {archiveFilters.map((value) => <option key={value} value={value}>{t(`archive.${value}`)}</option>)}
            </FilterSelect>
            <div className='flex gap-2'>
              <button type='submit' className={buttonVariants()}>{t('filters.apply')}</button>
              {hasFilters && <Link href={templatesPath} aria-label={t('filters.clear')} title={t('filters.clear')} className={buttonVariants({ variant: 'outline', size: 'icon' })}><FilterX /></Link>}
            </div>
          </form>
        </CardContent>
      </Card>

      <p className='text-sm text-muted-foreground'>{t('results', { count: templates.length })}</p>

      {templates.length === 0 ? (
        <Card><CardHeader><CardTitle>{hasFilters ? t('empty.filteredTitle') : t('empty.title')}</CardTitle><CardDescription>{hasFilters ? t('empty.filteredDescription') : t('empty.description')}</CardDescription></CardHeader></Card>
      ) : (
        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
          {templates.map((template) => {
            const defaults = template.prescriptionDefaults
            const hasLoad = defaults.distanceKm != null || defaults.durationMin != null || defaults.elevationGain != null || defaults.intensity != null
            return (
              <Card key={template.id} className={template.archivedAt ? 'opacity-65' : undefined}>
                <CardHeader>
                  <div className='flex flex-wrap items-start justify-between gap-2'>
                    <Badge variant='outline'>{t(`categories.${template.category}`)}</Badge>
                    {template.archivedAt && <Badge variant='secondary'>{t('archive.archived')}</Badge>}
                  </div>
                  <CardTitle className='text-lg'>{template.sessionDefaults.title}</CardTitle>
                  <CardDescription>{workoutTypeLabel(template.sessionDefaults.type)}</CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <div className='flex flex-wrap gap-x-4 gap-y-1 text-sm'>
                    {defaults.distanceKm != null && <span>{defaults.distanceKm} km</span>}
                    {defaults.durationMin != null && <span>{defaults.durationMin} min</span>}
                    {defaults.elevationGain != null && <span>{defaults.elevationGain} m D+</span>}
                    {defaults.intensity?.method === 'hr_zone' && <span>{defaults.intensity.zone}</span>}
                    {defaults.intensity?.method === 'pam_percentage' && <span>{defaults.intensity.pamPercentage}% PAM</span>}
                    {!hasLoad && <span className='text-muted-foreground'>{t('withoutLoadDefaults')}</span>}
                  </div>
                  {template.tags.length > 0 && <div className='flex flex-wrap gap-1.5'>{template.tags.map((value) => <Badge key={value} variant='secondary'>{value}</Badge>)}</div>}
                  <div className='flex flex-wrap justify-end gap-2 pt-2'>
                    <form action={duplicateWorkoutTemplate}>
                      <input type='hidden' name='templateId' value={template.id} />
                      <input type='hidden' name='locale' value={locale} />
                      <button type='submit' className={buttonVariants({ variant: 'outline', size: 'sm' })}><Copy /> {t('duplicate')}</button>
                    </form>
                    <Link href={`${templatesPath}/${template.id}/edit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}><Pencil /> {t('edit')}</Link>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FilterSelect({ label, children, ...props }: React.ComponentProps<'select'> & { label: string }) {
  return <label className='space-y-1.5 text-sm font-medium'><span>{label}</span><select className='h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50' {...props}>{children}</select></label>
}
