export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { runMigrations } = await import('./lib/db/migrate')
    await runMigrations().catch(err => console.error('[instrumentation] migrate error:', err))

    const { setupScheduler } = await import('./lib/scheduler')
    setupScheduler()
  }
}
