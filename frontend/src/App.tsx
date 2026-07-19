import { useEffect, useState } from 'react'
import { createItem, deleteItem, fetchItems } from './api'
import type { InventoryItem } from './types'
import './App.css'

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
    if (!form.name || !form.category || !form.quantity || !form.unit) return

    try {
      await createItem({
        name: form.name,
        category: form.category,
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

      {error && <p className="error">{error}</p>}

      <form className="add-form" onSubmit={handleSubmit}>
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          placeholder="Category"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />
        <input
          placeholder="Quantity"
          type="number"
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
        />
        <input
          placeholder="Unit"
          value={form.unit}
          onChange={(e) => setForm({ ...form, unit: e.target.value })}
        />
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
              <span className="item-details">
                {item.quantity} {item.unit} · {item.category}
                {item.expiry_date && ` · expires ${item.expiry_date}`}
              </span>
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
