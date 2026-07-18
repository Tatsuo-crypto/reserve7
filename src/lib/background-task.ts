type BackgroundTask = () => Promise<void>

export function runBackgroundTask(label: string, task: BackgroundTask) {
  const promise = task().catch(error => {
    console.error(`[background:${label}] failed`, error)
  })

  const waitUntil = (globalThis as any).waitUntil
  if (typeof waitUntil === 'function') {
    waitUntil(promise)
  } else {
    void promise
  }
}

