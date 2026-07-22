import type {
  InventoryItem,
  InventoryItemInput,
  InventoryItemUpdate,
  Product,
  ProductUpdate,
} from './types'

// Dev server (:5173) and backend (:8000) run separately, so the dev server
// needs the full URL. In the production build, FastAPI serves frontend and
// API from the same origin, so a relative path is enough there.
const API_BASE = import.meta.env.DEV ? 'http://127.0.0.1:8000' : ''

// FastAPI's error body is either {detail: string} (HTTPException) or
// {detail: [{msg, loc, ...}]} (Pydantic validation errors).
async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json()
    const detail = body?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail
        .map((d) => {
          const field = Array.isArray(d?.loc) ? d.loc.at(-1) : undefined
          return field ? `${field}: ${d.msg}` : d.msg
        })
        .join(', ')
    }
  } catch {
    // response wasn't JSON (e.g. network error page) - fall through
  }
  return fallback
}

export async function fetchItems(): Promise<InventoryItem[]> {
  const res = await fetch(`${API_BASE}/items`)
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to load items'))
  return res.json()
}

export async function createItem(input: InventoryItemInput): Promise<InventoryItem> {
  const res = await fetch(`${API_BASE}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to create item'))
  return res.json()
}

export async function updateItem(id: number, input: InventoryItemUpdate): Promise<InventoryItem> {
  const res = await fetch(`${API_BASE}/items/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to update item'))
  return res.json()
}

export async function deleteItem(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/items/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to delete item'))
}

export async function searchProducts(query: string): Promise<Product[]> {
  const res = await fetch(`${API_BASE}/products?${new URLSearchParams({ q: query })}`)
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to search products'))
  return res.json()
}

export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch(`${API_BASE}/products`)
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to load products'))
  return res.json()
}

export async function updateProduct(id: number, input: ProductUpdate): Promise<Product> {
  const res = await fetch(`${API_BASE}/products/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to update product'))
  return res.json()
}

// null means the barcode isn't known locally or on Open Food Facts - that's
// an expected outcome (fall back to manual entry), not an error.
export async function lookupProduct(barcode: string): Promise<Product | null> {
  const res = await fetch(`${API_BASE}/products/${encodeURIComponent(barcode)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to look up product'))
  return res.json()
}
