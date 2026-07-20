export type Source = 'manual' | 'imported' | 'scanned'

export interface InventoryItem {
  id: number
  product_id: number | null
  name: string
  category: string | null
  quantity: number
  unit: string
  expiry_date: string | null
  added_at: string
  source: Source
}

export interface InventoryItemInput {
  name: string
  category: string | null
  quantity: number
  unit: string
  expiry_date: string | null
  product_id?: number | null
}

export interface Product {
  id: number
  barcode: string
  name: string
  category: string | null
  default_unit: string | null
}
