import { browser } from "@wdio/globals"

export type EventuallyOptions = {
  timeout?: number
  interval?: number
  message?: string
}

const defaultTimeout = 10 * 1000

function formatValue(value: unknown): string {
  if (value === undefined) return "undefined"
  if (typeof value === "string") return JSON.stringify(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

async function retryUntil<T>(
  actual: () => Promise<T>,
  matches: (value: T) => boolean | Promise<boolean>,
  expected: string,
  options: EventuallyOptions = {},
) {
  let lastActual: T | undefined
  let lastError: unknown

  try {
    await browser.waitUntil(async () => {
      try {
        lastActual = await actual()
        lastError = undefined
        return await matches(lastActual)
      } catch (error) {
        lastError = error
        return false
      }
    }, {
      timeout: options.timeout ?? defaultTimeout,
      interval: options.interval,
      timeoutMsg: options.message ?? `Expected value to ${expected}`,
    })
  } catch {
    if (options.message) {
      throw new Error(`${options.message}. Last value was ${formatValue(lastActual)}`)
    }
    if (lastError) {
      throw new Error(`Expected value to ${expected}, but last read failed: ${lastError}`)
    }
    throw new Error(`Expected value to ${expected}, but last value was ${formatValue(lastActual)}`)
  }
}

export function eventually<T>(actual: () => Promise<T>) {
  return {
    async equals(expected: T, options: EventuallyOptions = {}) {
      await retryUntil(actual, (value) => value === expected, `equal ${formatValue(expected)}`, options)
    },

    async contains(expected: string, options: EventuallyOptions = {}) {
      await retryUntil(actual, (value) => String(value).includes(expected), `contain ${formatValue(expected)}`, options)
    },

    async matches(expected: RegExp, options: EventuallyOptions = {}) {
      await retryUntil(actual, (value) => expected.test(String(value)), `match ${expected}`, options)
    },

    async satisfies(expected: string, predicate: (value: T) => boolean | Promise<boolean>, options: EventuallyOptions = {}) {
      await retryUntil(actual, async (value) => await predicate(value), expected, options)
    },
  }
}
