import { useEffect, useState } from 'react'
import { createItem, deleteItem, fetchItems } from './api'
import type { InventoryItem } from './types'
import './App.css'

const UNITS = ['g', 'kg', 'ml', 'l', 'pcs']
const THEME_KEY = 'pantry-core-theme'

function getInitialTheme(): 'light' | 'dark' {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const emptyForm = {
  name: '',
  category: '',
  quantity: '',
  unit: '',
  expiry_date: '',
}

function App() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  function loadItems() {
    fetchItems()
      .then(setItems)
      .catch(() => setError('Could not load items from backend.'))
  }

  useEffect(loadItems, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.quantity || !form.unit) return

    try {
      await createItem({
        name: form.name,
        category: form.category || null,
        quantity: Number(form.quantity),
        unit: form.unit,
        expiry_date: form.expiry_date || null,
      })
      setForm(emptyForm)
      loadItems()
    } catch {
      setError('Could not add item.')
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteItem(id)
      loadItems()
    } catch {
      setError('Could not delete item.')
    }
  }

  return (
    <main className="app">
      <header className="header">
        <div>
          <h1>pantry-core</h1>
          <p className="subtitle">Kitchen inventory</p>
        </div>
        <button
          className="theme-toggle"
          type="button"
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-pressed={theme === 'dark'}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M20.35 14.5A8.5 8.5 0 0 1 9.5 3.65 8.5 8.5 0 1 0 20.35 14.5Z" />
            </svg>
          )}
        </button>
      </header>

      {error && <p className="error">{error}</p>}

      <form className="add-form" onSubmit={handleSubmit}>
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          placeholder="Category (optional)"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />
        <input
          placeholder="Quantity"
          type="number"
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
        />
        <select
          value={form.unit}
          onChange={(e) => setForm({ ...form, unit: e.target.value })}
        >
          <option value="" disabled>
            Unit
          </option>
          {UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={form.expiry_date}
          onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
        />
        <button type="submit">Add</button>
      </form>

      <ul className="item-list">
        {items.map((item) => (
          <li key={item.id} className="item">
            <div className="item-info">
              <span className="item-name">{item.name}</span>
              <div className="item-details">
                <span>
                  {item.quantity} {item.unit}
                </span>
                {item.category && <span className="pill">{item.category}</span>}
                {item.expiry_date && (
                  <span className="pill pill-expiry">expires {item.expiry_date}</span>
                )}
              </div>
            </div>
            <button className="delete" onClick={() => handleDelete(item.id)}>
              Remove
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="empty">No items yet.</li>}
      </ul>
    </main>
  )
}

export default App
