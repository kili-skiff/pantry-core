import { lazy, Suspense, useEffect, useState } from 'react'
import {
  createItem,
  deleteItem,
  fetchItems,
  fetchProducts,
  lookupProduct,
  searchProducts,
  updateItem,
  updateProduct,
} from './api'
import type { InventoryItem, Product } from './types'
import './App.css'

// @zxing/library is large and only needed once someone actually scans -
// keep it out of the main bundle.
const BarcodeScanner = lazy(() => import('./BarcodeScanner'))

const UNITS = ['g', 'kg', 'ml', 'l', 'pcs']
const THEME_KEY = 'pantry-core-theme'
const EXPIRY_SOON_DAYS = 7

function getInitialTheme(): 'light' | 'dark' {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const emptyForm = {
  name: '',
  category: '',
  quantity: '',
  unit: 'pcs',
  expiry_date: '',
  min_quantity: '',
}

interface ActivityEntry {
  id: string
  type: 'added' | 'removed'
  item: InventoryItem
}

// crypto.randomUUID() requires a secure context, which the kiosk browser
// doesn't have when talking to the Pi over plain http://<lan-ip> - so a
// plain counter instead of relying on it being available everywhere.
let activityIdCounter = 0
function nextActivityId(): string {
  activityIdCounter += 1
  return `${Date.now()}-${activityIdCounter}`
}

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((new Date(dateStr).getTime() - today.getTime()) / 86_400_000)
}

const CATEGORY_ICONS: Record<string, string> = {
  Dairy: '🥛',
  Bakery: '🍞',
  Produce: '🥕',
  Baking: '🧁',
  Grains: '🌾',
  Spices: '🧂',
  Pantry: '🥫',
  Beverages: '☕',
  Meat: '🥩',
  Vegan: '🌱',
}

// Category-level icons are too coarse once there's more than a couple of
// items per category (Kartoffeln and Karotten both just showed a carrot) -
// this covers the seeded staples by name, falling back to the category
// icon for anything not listed here (e.g. freshly scanned products).
const PRODUCT_ICONS: Record<string, string> = {
  milch: '🥛',
  butter: '🧈',
  eier: '🥚',
  käse: '🧀',
  bergkäse: '🧀',
  joghurt: '🥣',
  quark: '🥣',
  sahne: '🥛',
  brot: '🍞',
  brötchen: '🥐',
  toastbrot: '🍞',
  brezel: '🥨',
  reis: '🍚',
  nudeln: '🍝',
  spätzle: '🍝',
  haferflocken: '🌾',
  salz: '🧂',
  kartoffeln: '🥔',
  zwiebeln: '🧅',
  knoblauch: '🧄',
  tomaten: '🍅',
  äpfel: '🍎',
  bananen: '🍌',
  karotten: '🥕',
  zitronen: '🍋',
  gurken: '🥒',
  zucchini: '🥒',
  paprika: '🫑',
  pilze: '🍄',
  spinat: '🥬',
  salat: '🥬',
  sauerkraut: '🥬',
  radieschen: '🥕',
  zwetschgen: '🍑',
  birnen: '🍐',
  trauben: '🍇',
  olivenöl: '🫒',
  honig: '🍯',
  bier: '🍺',
  apfelschorle: '🧃',
  kaffee: '☕',
  tee: '🍵',
  speck: '🥓',
  'weißwürste': '🌭',
  'wiener würstchen': '🌭',
  kokosmilch: '🥥',
  hafermilch: '🥛',
  sojamilch: '🥛',
  mandelmilch: '🥛',
  'veganer käse': '🧀',
  erdnussbutter: '🥜',
}

function categoryIcon(category: string | null): string {
  return (category && CATEGORY_ICONS[category]) || '📦'
}

function itemIcon(name: string, category: string | null): string {
  return PRODUCT_ICONS[name.trim().toLowerCase()] ?? categoryIcon(category)
}

function expiryLabel(dateStr: string): string {
  const days = daysUntil(dateStr)
  if (days < 0) return 'expired'
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days}d`
}

// Weight/volume items get adjusted in finer steps than piece-counted ones.
function quantityStep(unit: string): number {
  return unit === 'kg' || unit === 'l' ? 0.1 : 1
}

// 0.1 isn't exactly representable in binary floating point, so repeated
// +/- via quantityStep() drifts (1.9000000000000008). Round away the drift
// after each step instead of storing/displaying it.
function roundQuantity(value: number): number {
  return Math.round(value * 100) / 100
}

function groupByCategory(items: InventoryItem[]): [string, InventoryItem[]][] {
  const groups = new Map<string, InventoryItem[]>()
  for (const item of items) {
    const key = item.category ?? 'Uncategorized'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
}

type View = 'dashboard' | 'all-items' | 'products'
const VIEW_ORDER: View[] = ['dashboard', 'all-items', 'products']

function nextView(current: View): View {
  return VIEW_ORDER[(VIEW_ORDER.indexOf(current) + 1) % VIEW_ORDER.length]
}

function App() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [form, setForm] = useState(emptyForm)
  const [productId, setProductId] = useState<number | null>(null)
  const [suggestions, setSuggestions] = useState<Product[]>([])
  const [scanning, setScanning] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [itemsQuery, setItemsQuery] = useState('')
  const [fabExpanded, setFabExpanded] = useState(false)
  const [view, setView] = useState<View>('dashboard')
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [productForm, setProductForm] = useState({ name: '', category: '', default_unit: '' })
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [theme, setTheme] = useState(getInitialTheme)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  function loadItems() {
    fetchItems()
      .then((items) => {
        setItems(items)
        setError(null)
      })
      .catch(() => setError('Could not load items from backend.'))
  }

  useEffect(loadItems, [])

  function loadProducts() {
    fetchProducts()
      .then(setProducts)
      .catch(() => setError('Could not load products from backend.'))
  }

  useEffect(loadProducts, [])

  function openProduct(product: Product) {
    setSelectedProduct(product)
    setProductForm({
      name: product.name,
      category: product.category ?? '',
      default_unit: product.default_unit ?? '',
    })
  }

  async function handleUpdateProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProduct || !productForm.name) return

    try {
      const updated = await updateProduct(selectedProduct.id, {
        name: productForm.name,
        category: productForm.category || null,
        default_unit: productForm.default_unit || null,
      })
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      setSelectedProduct(null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update product.')
    }
  }

  // Debounced name search for autocomplete - skipped once a product is
  // already tied to the form (e.g. right after a barcode scan prefilled it),
  // since there's nothing left to suggest at that point.
  useEffect(() => {
    if (!formOpen || productId !== null) {
      setSuggestions([])
      return
    }
    const query = form.name.trim()
    if (query.length < 2) {
      setSuggestions([])
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      searchProducts(query).then(
        (results) => {
          if (!cancelled) setSuggestions(results)
        },
        () => {
          if (!cancelled) setSuggestions([])
        },
      )
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [form.name, formOpen, productId])

  function selectSuggestion(product: Product) {
    setProductId(product.id)
    setForm((prev) => ({
      ...prev,
      name: product.name,
      category: product.category ?? '',
      unit: product.default_unit ?? prev.unit,
    }))
    setSuggestions([])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.quantity || !form.unit) return

    try {
      const created = await createItem({
        name: form.name,
        category: form.category || null,
        quantity: Number(form.quantity),
        unit: form.unit,
        expiry_date: form.expiry_date || null,
        min_quantity: form.min_quantity === '' ? null : Number(form.min_quantity),
        product_id: productId,
      })
      setForm(emptyForm)
      setProductId(null)
      setError(null)
      setFormOpen(false)
      setActivity((prev) => [{ id: nextActivityId(), type: 'added', item: created }, ...prev])
      loadItems()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add item.')
    }
  }

  async function handleDelete(item: InventoryItem) {
    try {
      await deleteItem(item.id)
      setActivity((prev) => [{ id: nextActivityId(), type: 'removed', item }, ...prev])
      setSelectedItem((prev) => (prev?.id === item.id ? null : prev))
      loadItems()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete item.')
    }
  }

  async function handleUpdateItem(
    id: number,
    patch: { quantity?: number; expiry_date?: string | null; min_quantity?: number | null },
  ) {
    const current = items.find((i) => i.id === id)
    if (!current) return

    try {
      const updated = await updateItem(id, {
        quantity: patch.quantity ?? current.quantity,
        expiry_date: patch.expiry_date !== undefined ? patch.expiry_date : current.expiry_date,
        min_quantity: patch.min_quantity !== undefined ? patch.min_quantity : current.min_quantity,
      })
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)))
      setSelectedItem((prev) => (prev && prev.id === id ? updated : prev))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update item.')
    }
  }

  async function undoAdd(entry: ActivityEntry) {
    try {
      await deleteItem(entry.item.id)
      setActivity((prev) => prev.filter((e) => e.id !== entry.id))
      loadItems()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not undo add.')
    }
  }

  async function restoreRemovedItem(entry: ActivityEntry): Promise<InventoryItem | null> {
    try {
      const restored = await createItem({
        name: entry.item.name,
        category: entry.item.category,
        quantity: entry.item.quantity,
        unit: entry.item.unit,
        expiry_date: entry.item.expiry_date,
        min_quantity: entry.item.min_quantity,
        product_id: entry.item.product_id,
      })
      setActivity((prev) => prev.filter((e) => e.id !== entry.id))
      loadItems()
      return restored
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not undo removal.')
      return null
    }
  }

  async function undoRemove(entry: ActivityEntry) {
    await restoreRemovedItem(entry)
  }

  function editAddedEntry(entry: ActivityEntry) {
    setSelectedItem(items.find((i) => i.id === entry.item.id) ?? entry.item)
  }

  async function editRemovedEntry(entry: ActivityEntry) {
    const restored = await restoreRemovedItem(entry)
    if (restored) setSelectedItem(restored)
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
        min_quantity: '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not look up product.')
    }
  }

  const expiringSoon = items
    .filter((item) => item.expiry_date && daysUntil(item.expiry_date) <= EXPIRY_SOON_DAYS)
    .sort((a, b) => daysUntil(a.expiry_date as string) - daysUntil(b.expiry_date as string))

  const lowStock = items
    .filter((item) => item.min_quantity != null && item.quantity <= item.min_quantity)
    .sort((a, b) => a.quantity - (a.min_quantity ?? 0) - (b.quantity - (b.min_quantity ?? 0)))

  const addedRecent = activity.filter((e) => e.type === 'added').slice(0, 5)
  const removedRecent = activity.filter((e) => e.type === 'removed').slice(0, 5)

  const timeLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dateLabel = now.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: '2-digit' })

  const overlayOpen =
    formOpen ||
    removeOpen ||
    activityOpen ||
    selectedItem !== null ||
    selectedProduct !== null ||
    scanning

  const allItemsSorted = [...items].sort((a, b) => a.name.localeCompare(b.name))
  const visibleItems = itemsQuery.trim()
    ? allItemsSorted.filter((item) =>
        item.name.toLowerCase().includes(itemsQuery.trim().toLowerCase()),
      )
    : allItemsSorted

  return (
    <main className="app">
      <header className="header">
        <button
          type="button"
          className="logo"
          aria-label="pantry core - back to dashboard"
          onClick={() => setView('dashboard')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2.5" width="6" height="2.5" rx="0.6" />
            <path d="M9.5 5v2.3a1.2 1.2 0 0 1-.5 1L7.4 9.6A2 2 0 0 0 6.5 11.2V19.5a2.5 2.5 0 0 0 2.5 2.5h6a2.5 2.5 0 0 0 2.5-2.5v-8.3a2 2 0 0 0-.9-1.6L15 8.3a1.2 1.2 0 0 1-.5-1V5" />
            <path d="M6.7 14h10.6" />
          </svg>
        </button>
        <div className="clock">
          <span className="clock-time">{timeLabel}</span>
          <span className="clock-date">{dateLabel}</span>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      {view === 'all-items' ? (
        <div className="all-items-page">
          <section className="board-column">
            <h2 className="board-title">All items</h2>
            <div className="search-field">
              <input
                className="search-bar"
                placeholder="Search items..."
                value={itemsQuery}
                onChange={(e) => setItemsQuery(e.target.value)}
              />
              {itemsQuery && (
                <button
                  type="button"
                  className="search-clear"
                  aria-label="Clear search"
                  onClick={() => setItemsQuery('')}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              )}
            </div>
            <ul className="all-items-list">
              {visibleItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="all-items-row"
                    onClick={() => setSelectedItem(item)}
                  >
                    <span className="item-tile-name">{item.name}</span>
                    <span className="item-tile-meta">
                      {item.quantity} {item.unit}
                    </span>
                    {item.category && <span className="pill">{item.category}</span>}
                    {item.expiry_date && (
                      <span className="pill pill-expiry">{expiryLabel(item.expiry_date)}</span>
                    )}
                  </button>
                </li>
              ))}
              {items.length === 0 && <li className="empty-hint">No items yet.</li>}
              {items.length > 0 && visibleItems.length === 0 && (
                <li className="empty-hint">No items match "{itemsQuery}".</li>
              )}
            </ul>
          </section>
        </div>
      ) : view === 'products' ? (
        <div className="all-items-page">
          <section className="board-column">
            <h2 className="board-title">Products</h2>
            <ul className="all-items-list">
              {[...products]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      className="all-items-row"
                      onClick={() => openProduct(product)}
                    >
                      <span className="item-tile-name">{product.name}</span>
                      {product.category && <span className="pill">{product.category}</span>}
                      {product.default_unit && (
                        <span className="item-tile-meta">{product.default_unit}</span>
                      )}
                      <span className="pill">{product.barcode ? product.barcode : 'no barcode'}</span>
                    </button>
                  </li>
                ))}
              {products.length === 0 && <li className="empty-hint">No products yet.</li>}
            </ul>
          </section>
        </div>
      ) : (
        <div className="dashboard">
          <section className="board-column">
            <h2 className="board-title">All items</h2>
            <div className="item-grid">
              {allItemsSorted.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="item-tile"
                  onClick={() => setSelectedItem(item)}
                >
                  <span className="item-tile-icon">{itemIcon(item.name, item.category)}</span>
                  <span className="item-tile-name">{item.name}</span>
                  <span className="item-tile-meta">
                    {item.quantity} {item.unit}
                  </span>
                  {item.expiry_date && (
                    <span className="pill pill-expiry">{expiryLabel(item.expiry_date)}</span>
                  )}
                </button>
              ))}
              {items.length === 0 && <p className="empty-hint">No items yet.</p>}
            </div>
          </section>

          <section className="board-column">
            <h2 className="board-title">Low on stock</h2>
            <div className="item-grid">
              {lowStock.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="item-tile"
                  onClick={() => setSelectedItem(item)}
                >
                  <span className="item-tile-icon">{itemIcon(item.name, item.category)}</span>
                  <span className="item-tile-name">{item.name}</span>
                  <span className="item-tile-meta">
                    {item.quantity} {item.unit}
                  </span>
                  {item.expiry_date && (
                    <span className="pill pill-expiry">{expiryLabel(item.expiry_date)}</span>
                  )}
                </button>
              ))}
              {lowStock.length === 0 && <p className="empty-hint">Nothing low on stock.</p>}
            </div>
          </section>

          <section className="board-column">
            <h2 className="board-title">Expiring soon</h2>
            <div className="item-grid">
              {expiringSoon.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="item-tile"
                  onClick={() => setSelectedItem(item)}
                >
                  <span className="item-tile-icon">{itemIcon(item.name, item.category)}</span>
                  <span className="item-tile-name">{item.name}</span>
                  <span className="item-tile-meta">
                    {item.quantity} {item.unit}
                  </span>
                  <span className="pill pill-expiry">
                    {expiryLabel(item.expiry_date as string)}
                  </span>
                </button>
              ))}
              {expiringSoon.length === 0 && <p className="empty-hint">Nothing expiring soon.</p>}
            </div>
          </section>
        </div>
      )}

      {activityOpen && (
        <div className="add-overlay" onClick={() => setActivityOpen(false)}>
          <div className="add-panel" onClick={(e) => e.stopPropagation()}>
            <div className="add-panel-header">
              <h2>Recent activity</h2>
              <button
                type="button"
                className="add-panel-close"
                aria-label="Close"
                onClick={() => setActivityOpen(false)}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="board-activity">
              <div className="activity-block">
                <h2 className="board-title">Added recently</h2>
                <ul className="activity-list">
                  {addedRecent.map((entry) => (
                    <li key={entry.id}>
                      <span>{entry.item.name}</span>
                      <div className="activity-actions">
                        <button type="button" onClick={() => editAddedEntry(entry)}>
                          edit
                        </button>
                        <button type="button" onClick={() => undoAdd(entry)}>
                          undo
                        </button>
                      </div>
                    </li>
                  ))}
                  {addedRecent.length === 0 && <li className="empty-hint">-</li>}
                </ul>
              </div>
              <div className="activity-block">
                <h2 className="board-title">Removed recently</h2>
                <ul className="activity-list">
                  {removedRecent.map((entry) => (
                    <li key={entry.id}>
                      <span>{entry.item.name}</span>
                      <div className="activity-actions">
                        <button type="button" onClick={() => editRemovedEntry(entry)}>
                          edit
                        </button>
                        <button type="button" onClick={() => undoRemove(entry)}>
                          undo
                        </button>
                      </div>
                    </li>
                  ))}
                  {removedRecent.length === 0 && <li className="empty-hint">-</li>}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedItem && (
        <div className="add-overlay" onClick={() => setSelectedItem(null)}>
          <div className="add-panel item-detail-panel" onClick={(e) => e.stopPropagation()}>
            <div className="add-panel-header">
              <h2>{selectedItem.name}</h2>
              <button
                type="button"
                className="add-panel-close"
                aria-label="Close"
                onClick={() => setSelectedItem(null)}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="item-detail-pills">
              {selectedItem.category && <span className="pill">{selectedItem.category}</span>}
              <span className="pill">{selectedItem.source}</span>
            </div>

            <div className="item-detail-field">
              <span className="item-detail-label">Stock</span>
              <div className="quantity-stepper">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  disabled={selectedItem.quantity - quantityStep(selectedItem.unit) <= 0}
                  onClick={() =>
                    handleUpdateItem(selectedItem.id, {
                      quantity: roundQuantity(
                        Math.max(
                          quantityStep(selectedItem.unit),
                          selectedItem.quantity - quantityStep(selectedItem.unit),
                        ),
                      ),
                    })
                  }
                >
                  −
                </button>
                <span>
                  {selectedItem.quantity} {selectedItem.unit}
                </span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() =>
                    handleUpdateItem(selectedItem.id, {
                      quantity: roundQuantity(selectedItem.quantity + quantityStep(selectedItem.unit)),
                    })
                  }
                >
                  +
                </button>
              </div>
            </div>

            <label className="item-detail-field">
              <span className="item-detail-label">Expiration date</span>
              <input
                type="date"
                value={selectedItem.expiry_date ?? ''}
                onChange={(e) =>
                  handleUpdateItem(selectedItem.id, { expiry_date: e.target.value || null })
                }
              />
            </label>

            <label className="item-detail-field">
              <span className="item-detail-label">Low stock alert at</span>
              <input
                type="number"
                min="0"
                step={quantityStep(selectedItem.unit)}
                placeholder="not set"
                value={selectedItem.min_quantity ?? ''}
                onChange={(e) =>
                  handleUpdateItem(selectedItem.id, {
                    min_quantity: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
            </label>

            <button
              type="button"
              className="item-detail-remove"
              onClick={() => handleDelete(selectedItem)}
            >
              Remove item
            </button>
          </div>
        </div>
      )}

      {selectedProduct && (
        <div className="add-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="add-panel" onClick={(e) => e.stopPropagation()}>
            <div className="add-panel-header">
              <h2>Edit product</h2>
              <button
                type="button"
                className="add-panel-close"
                aria-label="Close"
                onClick={() => setSelectedProduct(null)}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="item-detail-pills">
              <span className="pill">
                {selectedProduct.barcode ? selectedProduct.barcode : 'no barcode'}
              </span>
            </div>

            <form className="add-form" onSubmit={handleUpdateProduct}>
              <input
                placeholder="Name"
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              />
              <input
                placeholder="Category (optional)"
                value={productForm.category}
                onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
              />
              <select
                value={productForm.default_unit}
                onChange={(e) => setProductForm({ ...productForm, default_unit: e.target.value })}
              >
                <option value="">No default unit</option>
                {UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
              <button type="submit">Save</button>
            </form>
          </div>
        </div>
      )}

      {removeOpen && (
        <div className="add-overlay" onClick={() => setRemoveOpen(false)}>
          <div className="add-panel" onClick={(e) => e.stopPropagation()}>
            <div className="add-panel-header">
              <h2>Remove item</h2>
              <button
                type="button"
                className="add-panel-close"
                aria-label="Close"
                onClick={() => setRemoveOpen(false)}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="category-groups">
              {groupByCategory(items).map(([category, groupItems]) => (
                <div key={category} className="category-group">
                  <h3>{category}</h3>
                  <ul className="category-item-list">
                    {groupItems.map((item) => (
                      <li key={item.id}>
                        <span>
                          {item.name} - {item.quantity} {item.unit}
                        </span>
                        <button type="button" className="delete" onClick={() => handleDelete(item)}>
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {items.length === 0 && <p className="empty-hint">No items to remove.</p>}
            </div>
          </div>
        </div>
      )}

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
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value })
                    // Editing the name after a scan/suggestion picked a
                    // product means that link is stale now - drop it so
                    // autocomplete can search again and the item doesn't
                    // get submitted tied to the wrong product.
                    if (productId !== null) setProductId(null)
                  }}
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
                {suggestions.length > 0 && (
                  <ul className="autocomplete-list">
                    {suggestions.map((product) => (
                      <li key={product.id}>
                        <button type="button" onClick={() => selectSuggestion(product)}>
                          <span>{product.name}</span>
                          {product.category && <span className="pill">{product.category}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
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
              <input
                placeholder="Low stock alert at (optional)"
                type="number"
                min="0"
                step="any"
                value={form.min_quantity}
                onChange={(e) => setForm({ ...form, min_quantity: e.target.value })}
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

      {!overlayOpen && (
        <div className="fab-stack">
          {fabExpanded && (
            <>
              <button
                type="button"
                className="fab fab-main fab-pop"
                aria-label="Add item"
                onClick={() => setFormOpen(true)}
              >
                +
              </button>
              <button
                type="button"
                className="fab fab-mini fab-remove fab-pop"
                aria-label="Remove item"
                onClick={() => setRemoveOpen(true)}
              >
                −
              </button>
              <button
                type="button"
                className="fab fab-mini fab-pop"
                aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M20.35 14.5A8.5 8.5 0 0 1 9.5 3.65 8.5 8.5 0 1 0 20.35 14.5Z" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                className="fab fab-mini fab-pop"
                aria-label={
                  view === 'dashboard'
                    ? 'Show all items'
                    : view === 'all-items'
                      ? 'Show products'
                      : 'Back to dashboard'
                }
                onClick={() => {
                  setView(nextView(view))
                  setFabExpanded(false)
                }}
              >
                {view === 'dashboard' ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                ) : view === 'all-items' ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 12.5l-7.5 7.5L4 11.5V4h7.5l8.5 8.5z" />
                    <circle cx="8" cy="8" r="1.5" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M8 6h13M8 12h13M8 18h13" />
                    <path d="M3 6h.01M3 12h.01M3 18h.01" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                className="fab fab-mini fab-pop"
                aria-label="Show recent activity"
                onClick={() => {
                  setActivityOpen(true)
                  setFabExpanded(false)
                }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 3" />
                </svg>
              </button>
            </>
          )}
          <button
            type="button"
            className="fab fab-mini fab-dots"
            aria-label={fabExpanded ? 'Hide actions' : 'Show actions'}
            onClick={() => setFabExpanded((v) => !v)}
          >
            {fabExpanded ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            ) : (
              '···'
            )}
          </button>
        </div>
      )}
    </main>
  )
}

export default App
