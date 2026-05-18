import PQueue from 'p-queue'

// One browser task at a time (Playwright is a shared resource)
export const browserQueue = new PQueue({ concurrency: 1 })

// LLM-only tasks can run in parallel
export const llmQueue = new PQueue({ concurrency: 3 })

export function enqueueBrowserTask<T>(fn: () => Promise<T>): Promise<T> {
  return browserQueue.add(fn) as Promise<T>
}

export function enqueueLlmTask<T>(fn: () => Promise<T>): Promise<T> {
  return llmQueue.add(fn) as Promise<T>
}
