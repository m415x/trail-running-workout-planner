import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const coachLayout = readFileSync('app/[locale]/dashboard/layout.tsx', 'utf8')
const coachSidebar = readFileSync('components/dashboard/app-sidebar.tsx', 'utf8')
const globalsCss = readFileSync('app/globals.css', 'utf8')

test('KAN-559 keeps Coach desktop-first IA while progressively compressing the shell', () => {
  assert.match(coachSidebar, /<Sidebar collapsible=['"]icon['"]>/)
  assert.match(coachLayout, /<SidebarTrigger/)
  assert.match(coachLayout, /h-14[\s\S]*md:h-16/)
  assert.match(coachLayout, /gap-3[\s\S]*p-3[\s\S]*sm:gap-4[\s\S]*sm:p-4[\s\S]*lg:gap-8[\s\S]*lg:p-8/)
})

test('KAN-559 keeps Coach compression independent from Athlete accessibility root scaling', () => {
  assert.match(globalsCss, /html\s*\{[\s\S]*font-size:\s*120%/)
  assert.match(
    globalsCss,
    /@media\s*\(min-width:\s*640px\)\s*\{[\s\S]*html\s*\{[\s\S]*font-size:\s*100%/,
  )

  assert.doesNotMatch(coachLayout, /font-size|text-size-adjust/)
  assert.doesNotMatch(coachSidebar, /font-size|text-size-adjust/)
})
