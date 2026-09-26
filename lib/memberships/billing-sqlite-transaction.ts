type SqliteTransactionRunner = {
  transaction: <T>(
    operation: () => T,
    config?: { behavior?: 'deferred' | 'immediate' | 'exclusive' },
  ) => T
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object'
    && value !== null
    && 'then' in value
    && typeof (value as { then?: unknown }).then === 'function'
  )
}

export function createSqliteBillingTransaction(db: unknown) {
  const runner = db as SqliteTransactionRunner

  return function runBillingTransaction<T>(operation: () => T): T {
    return runner.transaction(() => {
      const result = operation()

      if (isPromiseLike(result)) {
        throw new Error('SQLite billing transaction operation must be synchronous')
      }

      return result
    }, { behavior: 'immediate' })
  }
}
