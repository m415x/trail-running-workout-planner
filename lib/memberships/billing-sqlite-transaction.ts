type SqliteTransactionRunner = {
  transaction: <T>(operation: () => T) => {
    immediate: () => T
  }
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object'
    && value !== null
    && 'then' in value
    && typeof (value as { then?: unknown }).then === 'function'
  )
}

export function createSqliteBillingTransaction(db: SqliteTransactionRunner) {
  return function runBillingTransaction<T>(operation: () => T): T {
    return db.transaction(() => {
      const result = operation()

      if (isPromiseLike(result)) {
        throw new Error('SQLite billing transaction operation must be synchronous')
      }

      return result
    }).immediate()
  }
}
