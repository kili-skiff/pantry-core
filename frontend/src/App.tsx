import { useEffect, useState } from 'react'
import { createItem, deleteItem, fetchItems } from './api'
import type { InventoryItem } from './types'
import './App.css'

const UNITS = ['g', 'kg', 'ml', 'l', 'pcs']

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
      <h1>pantry-core</h1>
      <p className="subtitle">Kitchen inventory</p>

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
