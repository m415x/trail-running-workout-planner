import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

describe('KAN-506 walkthrough residual i18n', () => {
  it('localizes the Coach Planning list and keeps routing locale-aware', async () => {
    const source = await readFile('app/[locale]/dashboard/planning/page.tsx', 'utf8')

    assert.match(source, /getTranslations/)
    assert.match(source, /from ['"]@\/i18n\/routing['"]/)
    assert.doesNotMatch(
      source,
      /Planificación|Nueva estrategia|Todavía no hay planificaciones|Ver planificación|Borrador|Activo|Completado|Cancelado/,
    )
  })

  it('removes residual Coach Planning detail UI copy from the route', async () => {
    const source = await readFile('app/[locale]/dashboard/planning/[planId]/page.tsx', 'utf8')

    assert.match(source, /getTranslations/)
    assert.doesNotMatch(
      source,
      /Vista previa no disponible|Horizonte configurado|Volumen objetivo|Semana|Fechas|Desnivel|Notas|Grupo \{groupCode\}/,
    )
  })

  it('localizes Athlete Home header and weekly calendar chrome', async () => {
    const header = await readFile('features/workouts/components/HomeHeader.tsx', 'utf8')
    const weekly = await readFile('features/workouts/components/WeeklyCalendarCard.tsx', 'utf8')
    const weeklyHook = await readFile('features/workouts/hooks/useWeeklyCalendarCard.ts', 'utf8')

    assert.match(header, /useTranslations/)
    assert.doesNotMatch(header, /Hola,|Ver team|Notificaciones/)
    assert.match(weekly, /useTranslations/)
    assert.doesNotMatch(weekly, /Progreso semanal/)
    assert.doesNotMatch(weeklyHook, /Fase |Objetivo /)
  })

  it('localizes Athlete Profile physiology, gear, settings and header UI', async () => {
    const paths = [
      'features/profile/components/AthleteTabContent.tsx',
      'features/profile/components/GearTabContent.tsx',
      'features/profile/components/SettingsTabContent.tsx',
      'features/profile/components/ProfileHeader.tsx',
    ] as const

    const sources = await Promise.all(paths.map(path => readFile(path, 'utf8')))

    for (const source of sources) {
      assert.match(source, /useTranslations/)
    }

    assert.doesNotMatch(
      sources.join('\n'),
      /Información Física|Zonas Cardíacas|Recuperación Activa|Zapatillas en Rotación|Dispositivos Vinculados|Sincronización automática activa|Configurar|Contacto de Emergencia|Grupo Sanguíneo|Seguro Médico|Preferencias de la Cuenta|Editar foto|Atleta desde/,
    )
  })
})
