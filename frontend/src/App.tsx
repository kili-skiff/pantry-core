import { lazy, Suspense, useEffect, useState } from 'react'
import { createItem, deleteItem, fetchItems, lookupProduct } from './api'
import type { InventoryItem } from './types'
import './App.css'

// @zxing/library is large and only needed once someone actually scans -
// keep it out of the main bundle.
const BarcodeScanner = lazy(() => import('./BarcodeScanner'))

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
  const [productId, setProductId] = useState<number | null>(null)
  const [scanning, setScanning] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
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
        product_id: productId,
      })
      setForm(emptyForm)
      setProductId(null)
      setError(null)
      setFormOpen(false)
      loadItems()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add item.')
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteItem(id)
      loadItems()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete item.')
    }
  }

  async function handleBarcodeDetected(barcode: string) {
    setScanning(false)
    try {
      const product = await lookupProduct(barcode)
      if (product === null) {
        setError(`No product found for barcode ${barcode} - enter it manually.`)
        return
      }
      setError(null)
      setProductId(product.id)
      setForm({
        name: product.name,
        category: product.category ?? '',
        quantity: '1',
        unit: product.default_unit ?? 'pcs',
        expiry_date: '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not look up product.')
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

      {formOpen && (
        <div className="add-overlay" onClick={() => setFormOpen(false)}>
          <div className="add-panel" onClick={(e) => e.stopPropagation()}>
            <div className="add-panel-header">
              <h2>Add item</h2>
              <button
                type="button"
                className="add-panel-close"
                aria-label="Close"
                onClick={() => setFormOpen(false)}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <form className="add-form" onSubmit={handleSubmit}>
              <div className="name-field">
                <input
                  placeholder="Name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <button
                  type="button"
                  className="scan-button"
                  aria-label="Scan barcode"
                  onClick={() => setScanning(true)}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                    <path d="M7 8v8M10 8v8M13 8v8M16 8v8" />
                  </svg>
                </button>
              </div>
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
          </div>
        </div>
      )}

      {scanning && (
        <div className="scanner-overlay">
          <Suspense fallback={<p className="scanner-loading">Loading scanner...</p>}>
            <BarcodeScanner
              onDetected={handleBarcodeDetected}
              onClose={() => setScanning(false)}
            />
          </Suspense>
        </div>
      )}

      {!formOpen && (
        <button
          type="button"
          className="fab"
          aria-label="Add item"
          onClick={() => setFormOpen(true)}
        >
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}
    </main>
  )
}

export default App
