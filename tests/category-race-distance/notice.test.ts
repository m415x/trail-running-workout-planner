import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextIntlClientProvider } from 'next-intl'
import { RaceDistanceNotice } from '@/features/planning/components/RaceDistanceNotice'
import { validateRaceDistanceForCategory } from '@/lib/validate-race-distance-for-category'
import es from '@/messages/es.json'
import en from '@/messages/en.json'

function render(category: string, distance: number | null, locale: 'es' | 'en' = 'es') {
  const providerProps = {
    locale, messages: locale === 'es' ? es : en, timeZone: 'UTC',
    children: createElement(RaceDistanceNotice, {
    result: validateRaceDistanceForCategory(category, distance),
    groupCode: `${category}2`, distanceKm: distance,
    }),
  }
  return renderToStaticMarkup(createElement(NextIntlClientProvider, providerProps))
}

describe('avisos de distancia al entrenador', () => {
  it('muestra causa, rango, tolerancia y continuación en español', () => {
    const html = render('S', 42)
    assert.match(html, /role="status"/)
    assert.match(html, /42 km/)
    assert.match(html, /S2/)
    assert.match(html, /5–15 km/)
    assert.match(html, /10%/)
    assert.match(html, /Podés continuar y guardar/)
    assert.doesNotMatch(html, /disabled|checkbox/)
  })
  it('traduce el aviso al inglés sin mensajes faltantes', () => {
    const html = render('U', 10, 'en')
    assert.match(html, /outside the usual range/)
    assert.match(html, /from 42 km/)
    assert.match(html, /You may continue and save/)
    assert.doesNotMatch(html, /RaceDistancePolicy\./)
  })
  it('oculta avisos compatibles, sin restricción y sin carrera', () => {
    for (const [category, distance] of [['S', 12], ['S', 16.5], ['H', 21.0975], ['M', 42.195], ['E', 100], ['B', null]] as const) {
      assert.equal(render(category, distance), '')
    }
  })
  it('distingue política pendiente de compatibilidad y de errores', () => {
    assert.match(render('B', 10), /pendiente de definición/)
    assert.match(render('B', 10, 'en'), /has not been defined/)
    assert.match(render('S', 0), /No se pudo evaluar/)
    assert.match(render('S', 0, 'en'), /could not be evaluated/)
  })
  it('recalcula presentación al cambiar distancia sin dejar avisos obsoletos', () => {
    assert.match(render('S', 16.501), /fuera del rango/)
    assert.equal(render('S', 16.5), '')
    assert.match(render('H', 50), /fuera del rango/)
    assert.equal(render('E', 50), '')
  })
})
