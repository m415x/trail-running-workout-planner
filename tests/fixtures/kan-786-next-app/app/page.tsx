import { submitProbe } from './probe-action'
export default function Page() {
  return <main><h1>KAN-786 Server Action transport fixture</h1><form action={submitProbe} method="post" encType="multipart/form-data"><input name="proposal" defaultValue="{}" /><input name="generationExplanations" defaultValue="[]" /><button type="submit">Confirm</button></form></main>
}
