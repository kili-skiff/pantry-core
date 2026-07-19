export type Source = 'manual' | 'imported'

export interface InventoryItem {
  id: number
  name: string
  category: string
  quantity: number
  unit: string
  expiry_date: string | null
  added_at: string
  source: Source
}

export interface InventoryItemInput {
  name: string
  category: string
  quantity: number
  unit: string
  expiry_date: string | null
}
