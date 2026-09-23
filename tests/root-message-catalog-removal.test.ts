import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const locales = ['es', 'en'] as const

test('legacy root message catalogs no longer own translations', () => {
  for (const locale of locales) {
    const rootPath = path.join(process.cwd(), `messages/${locale}.json`)
    assert.equal(fs.existsSync(rootPath), false, rootPath)
  }
})

test('former root namespaces are owned by modular fragments', () => {
  for (const locale of locales) {
    const common = JSON.parse(fs.readFileSync(path.join(process.cwd(), `messages/${locale}/common/common.json`), 'utf8'))
    const weather = JSON.parse(fs.readFileSync(path.join(process.cwd(), `messages/${locale}/common/weather.json`), 'utf8'))
    const workouts = JSON.parse(fs.readFileSync(path.join(process.cwd(), `messages/${locale}/realized-training/workouts.json`), 'utf8'))

    assert.ok(common.Common)
    assert.ok(weather.Weather)
    assert.ok(workouts.Workouts)
  }
})
