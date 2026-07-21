import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

afterEach(cleanup)

// jsdom 29 + Node's own (still gated behind --localstorage-file) global
// localStorage step on each other and leave `localStorage` undefined in
// tests - App.tsx reads it on mount for the theme, so stub a minimal
// in-memory Storage instead of chasing the Node flag.
class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length() {
    return this.store.size
  }

  clear = () => this.store.clear()
  getItem = (key: string) => this.store.get(key) ?? null
  key = (index: number) => [...this.store.keys()][index] ?? null
  removeItem = (key: string) => void this.store.delete(key)
  setItem = (key: string, value: string) => void this.store.set(key, String(value))
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  writable: true,
  configurable: true,
})

// jsdom doesn't implement matchMedia - App.tsx uses it as a fallback for the
// initial theme when localStorage has nothing stored yet.
Object.defineProperty(window, 'matchMedia', {
  value: (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
  writable: true,
  configurable: true,
})
