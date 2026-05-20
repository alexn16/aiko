export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { setupScheduler } = await import('./lib/scheduler')
    setupScheduler()
  }
}
