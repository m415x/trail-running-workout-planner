import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

describe('KAN-660 Next.js active-Team context wiring', () => {
  it('creates the production active-Team context from next/headers cookies and TeamMembership persistence', () => {
    const source = readFileSync(
      'lib/authorization/active-team-next-server.ts',
      'utf8',
    )

    assert.match(source, /from ['"]next\/headers['"]/)
    assert.match(source, /cookies/)
    assert.match(source, /teamMemberships/)
    assert.match(source, /createActiveTeamServerContext/)
    assert.match(source, /eq\(teamMemberships\.userId,\s*userId\)/)
    assert.doesNotMatch(source, /CURRENT_TEAM_ID/)
  })

  it('exposes a Server Action that derives actor from H2 before accepting a proposed Team', () => {
    const source = readFileSync(
      'app/actions/team-context-actions.ts',
      'utf8',
    )

    assert.match(source, /^['"]use server['"]/m)
    assert.match(source, /requireAuthenticatedEptAction/)
    assert.match(source, /readEptSessionAccessState/)
    assert.match(source, /createActiveTeamNextServerContext/)
    assert.match(source, /formData\.get\(['"]teamId['"]\)/)
    assert.match(source, /context\.select\(access\.userId,\s*proposedTeamId\)/)
    assert.doesNotMatch(source, /userId\s*=\s*stringValue\(formData\.get/)
  })

  it('clears active-Team context only after successful Supabase logout', () => {
    const source = readFileSync('app/actions/auth-actions.ts', 'utf8')
    const start = source.indexOf('export async function logoutAction')
    const end = source.indexOf('export type PasswordRecoveryRequestActionState', start)
    const logout = source.slice(start, end)

    assert.match(source, /createActiveTeamNextServerContext/)
    assert.match(logout, /signOut\(\)/)
    assert.match(logout, /signOutResult\.error/)
    assert.match(logout, /context\.clear\(\)/)
    assert.ok(
      logout.indexOf('context.clear()') > logout.indexOf('signOutResult.error'),
      'active-Team context must clear only after successful Supabase sign-out',
    )
    assert.ok(
      logout.indexOf('redirect(') > logout.indexOf('context.clear()'),
      'logout must clear active-Team context before redirecting',
    )
  })
})
