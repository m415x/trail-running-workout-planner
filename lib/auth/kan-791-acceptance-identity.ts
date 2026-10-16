export interface Kan791AcceptanceIdentity {
  email:string
  subject:string
}
/** Validates operator-supplied, dedicated identity attributes. It cannot authenticate Supabase. */
export function resolveKan791AcceptanceIdentity(input:Kan791AcceptanceIdentity):Kan791AcceptanceIdentity {
  const email=input.email.trim().toLowerCase()
  const subject=input.subject.trim().toLowerCase()
  if(!/^kan791[a-z0-9+._-]*@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(email) ||
    email.endsWith('@acceptance.invalid')) {
    throw new Error('Dedicated KAN-791 acceptance email required')
  }
  if(!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/.test(subject)) {
    throw new Error('Authentic Supabase subject UUID required')
  }
  return {email,subject}
}
