import type { InventoryItem, InventoryItemInput } from './types'

// Dev-Server (:5173) und Backend (:8000) laufen getrennt, brauchen also die
// volle URL. Im Production-Build liefert FastAPI Frontend und API von
// derselben Origin aus, daher reicht dort ein relativer Pfad.
const API_BASE = import.meta.env.DEV ? 'http://127.0.0.1:8000' : ''

export async function fetchItems(): Promise<InventoryItem[]> {
  const res = await fetch(`${API_BASE}/items`)
  if (!res.ok) throw new Error('Failed to load items')
  return res.json()
}

export async function createItem(input: InventoryItemInput): Promise<InventoryItem> {
  const res = await fetch(`${API_BASE}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Failed to create item')
  return res.json()
}

export async function deleteItem(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/items/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete item')
}
