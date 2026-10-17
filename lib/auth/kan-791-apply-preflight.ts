import type {Kan791AcceptanceIdentity} from './kan-791-acceptance-identity'

/** Fail closed before constructing a database client if real identity proof fails. */
export async function authorizeKan791ApplyBeforeDatabase<T>(
 identity:Kan791AcceptanceIdentity,
 deps:{
  verifyIdentity:(identity:Kan791AcceptanceIdentity)=>Promise<void>
  openDatabase:()=>T
 },
):Promise<T> {
 await deps.verifyIdentity(identity)
 return deps.openDatabase()
}
