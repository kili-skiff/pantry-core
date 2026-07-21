import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import * as api from './api'
import type { InventoryItem, Product } from './types'

vi.mock('./api')

// BarcodeScanner talks to the camera via @zxing/browser, which doesn't exist
// in jsdom - stub it out to a button that fires onDetected on demand, so the
// scan -> lookup -> prefill flow can be tested without a real camera.
vi.mock('./BarcodeScanner', () => ({
  default: ({ onDetected }: { onDetected: (barcode: string) => void }) => (
    <button onClick={() => onDetected('4006381333931')}>trigger-scan-detect</button>
  ),
}))

const baseItem: InventoryItem = {
  id: 1,
  product_id: null,
  name: 'Milk',
  category: 'Dairy',
  quantity: 1,
  unit: 'l',
  expiry_date: null,
  min_quantity: null,
  added_at: '2026-07-01',
  source: 'manual',
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.fetchItems).mockResolvedValue([])
  vi.mocked(api.fetchProducts).mockResolvedValue([])
  vi.mocked(api.searchProducts).mockResolvedValue([])
})

// The add-item panel lives behind the collapsed FAB stack - handles both the
// first open (dots -> "Add item") and reopening after the stack was already
// expanded once in the same test.
async function openAddForm(user: ReturnType<typeof userEvent.setup>) {
  const addButton = screen.queryByRole('button', { name: 'Add item' })
  if (!addButton) {
    await user.click(screen.getByRole('button', { name: /show actions|hide actions/i }))
  }
  await user.click(await screen.findByRole('button', { name: 'Add item' }))
}

describe('add-item form', () => {
  it('does not submit when name or quantity is missing', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openAddForm(user)

    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(api.createItem).not.toHaveBeenCalled()
  })

  it('creates the item with the entered values and resets the form', async () => {
    const user = userEvent.setup()
    const created = { ...baseItem, id: 2, name: 'Eggs', quantity: 6 }
    vi.mocked(api.createItem).mockResolvedValue(created)
    // First call is the initial mount, second is the reload after a
    // successful create - that's when "Eggs" should show up in the
    // dashboard's "All items" column.
    vi.mocked(api.fetchItems).mockResolvedValueOnce([]).mockResolvedValueOnce([created])
    render(<App />)
    await openAddForm(user)

    await user.type(screen.getByPlaceholderText('Name'), 'Eggs')
    await user.type(screen.getByPlaceholderText('Quantity'), '6')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('Eggs')).toBeInTheDocument()
    expect(api.createItem).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Eggs', quantity: 6, unit: 'pcs' }),
    )

    await openAddForm(user)
    expect(screen.getByPlaceholderText('Name')).toHaveValue('')
  })

  it('shows the backend validation message verbatim on failure', async () => {
    const user = userEvent.setup()
    vi.mocked(api.createItem).mockRejectedValue(new Error('quantity: must be greater than 0'))
    render(<App />)
    await openAddForm(user)

    await user.type(screen.getByPlaceholderText('Name'), 'Eggs')
    await user.type(screen.getByPlaceholderText('Quantity'), '0')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('quantity: must be greater than 0')).toBeInTheDocument()
  })

  it('prefills the form from a scanned product', async () => {
    const user = userEvent.setup()
    const product: Product = {
      id: 5,
      barcode: '4006381333931',
      name: 'Oat Milk',
      category: 'Dairy',
      default_unit: 'l',
    }
    vi.mocked(api.lookupProduct).mockResolvedValue(product)
    render(<App />)
    await openAddForm(user)

    await user.click(screen.getByRole('button', { name: 'Scan barcode' }))
    await user.click(await screen.findByText('trigger-scan-detect'))

    expect(await screen.findByPlaceholderText('Name')).toHaveValue('Oat Milk')
    expect(screen.getByPlaceholderText('Category (optional)')).toHaveValue('Dairy')
  })

  it('shows a not-found message instead of crashing on an unknown barcode', async () => {
    const user = userEvent.setup()
    vi.mocked(api.lookupProduct).mockResolvedValue(null)
    render(<App />)
    await openAddForm(user)

    await user.click(screen.getByRole('button', { name: 'Scan barcode' }))
    await user.click(await screen.findByText('trigger-scan-detect'))

    expect(
      await screen.findByText('No product found for barcode 4006381333931 - enter it manually.'),
    ).toBeInTheDocument()
  })

  it('shows autocomplete suggestions while typing and prefills the form on selection', async () => {
    const user = userEvent.setup()
    const product: Product = {
      id: 7,
      barcode: '4000000000000',
      name: 'Oat Milk',
      category: 'Dairy',
      default_unit: 'l',
    }
    vi.mocked(api.searchProducts).mockResolvedValue([product])
    render(<App />)
    await openAddForm(user)

    await user.type(screen.getByPlaceholderText('Name'), 'Oat')

    const suggestion = await screen.findByRole('button', { name: /Oat Milk/ })
    await user.click(suggestion)

    expect(screen.getByPlaceholderText('Name')).toHaveValue('Oat Milk')
    expect(screen.getByPlaceholderText('Category (optional)')).toHaveValue('Dairy')
    expect(api.searchProducts).toHaveBeenCalledWith('Oat')
  })

  it('drops the linked product once the name is edited afterwards, so it can be searched again', async () => {
    const user = userEvent.setup()
    const product: Product = {
      id: 7,
      barcode: '4000000000000',
      name: 'Oat Milk',
      category: 'Dairy',
      default_unit: 'l',
    }
    vi.mocked(api.searchProducts).mockResolvedValue([product])
    render(<App />)
    await openAddForm(user)

    await user.type(screen.getByPlaceholderText('Name'), 'Oat')
    await user.click(await screen.findByRole('button', { name: /Oat Milk/ }))

    vi.mocked(api.searchProducts).mockClear()
    await user.type(screen.getByPlaceholderText('Name'), 'x')

    await waitFor(() => expect(api.searchProducts).toHaveBeenCalled())
  })
})

describe('item list loading', () => {
  it('clears a stale error once a later load succeeds', async () => {
    const user = userEvent.setup()
    vi.mocked(api.fetchItems)
      .mockResolvedValueOnce([baseItem])
      .mockResolvedValueOnce([])
    vi.mocked(api.deleteItem)
      .mockRejectedValueOnce(new Error('Failed to delete item'))
      .mockResolvedValueOnce(undefined)
    render(<App />)

    await user.click(screen.getByRole('button', { name: /show actions|hide actions/i }))
    await user.click(screen.getByRole('button', { name: 'Remove item' }))
    await user.click(await screen.findByRole('button', { name: 'Remove' }))

    expect(await screen.findByText('Failed to delete item')).toBeInTheDocument()

    // Same delete succeeds this time - loadItems() runs again as a side
    // effect and should clear the stale error from the failed attempt above.
    await user.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() =>
      expect(screen.queryByText('Failed to delete item')).not.toBeInTheDocument(),
    )
  })
})

describe('dashboard', () => {
  it('shows all items directly and keeps recent activity in a separate panel', async () => {
    const user = userEvent.setup()
    vi.mocked(api.fetchItems).mockResolvedValue([baseItem])
    render(<App />)

    expect(await screen.findByText('Milk')).toBeInTheDocument()
    expect(screen.queryByText('Added recently')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /show actions|hide actions/i }))
    await user.click(screen.getByRole('button', { name: 'Show recent activity' }))

    expect(screen.getByText('Added recently')).toBeInTheDocument()
    expect(screen.getByText('Removed recently')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByText('Added recently')).not.toBeInTheDocument()
  })
})

describe('product catalog', () => {
  async function goToProductsView(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /show actions|hide actions/i }))
    await user.click(screen.getByRole('button', { name: 'Show all items' }))
    await user.click(screen.getByRole('button', { name: /show actions|hide actions/i }))
    await user.click(screen.getByRole('button', { name: 'Show products' }))
  }

  it('lists products and saves an edit', async () => {
    const user = userEvent.setup()
    const product: Product = {
      id: 3,
      barcode: null,
      name: 'milch',
      category: null,
      default_unit: null,
    }
    vi.mocked(api.fetchProducts).mockResolvedValue([product])
    vi.mocked(api.updateProduct).mockResolvedValue({
      ...product,
      name: 'Milch',
      category: 'Dairy',
      default_unit: 'l',
    })
    render(<App />)
    await goToProductsView(user)

    await user.click(await screen.findByRole('button', { name: /milch/i }))

    const nameInput = screen.getByPlaceholderText('Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Milch')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(api.updateProduct).toHaveBeenCalledWith(
        3,
        expect.objectContaining({ name: 'Milch' }),
      ),
    )
  })
})
