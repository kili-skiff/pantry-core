export type Source = 'manual' | 'imported' | 'scanned'

export interface InventoryItem {
  id: number
  product_id: number | null
  name: string
  category: string | null
  quantity: number
  unit: string
  expiry_date: string | null
  min_quantity: number | null
  added_at: string
  source: Source
}

export interface InventoryItemInput {
  name: string
  category: string | null
  quantity: number
  unit: string
  expiry_date: string | null
  min_quantity?: number | null
  product_id?: number | null
}

export interface InventoryItemUpdate {
  quantity: number
  expiry_date: string | null
  min_quantity: number | null
}

export interface Product {
  id: number
  barcode: string | null
  name: string
  category: string | null
  default_unit: string | null
}

export interface ProductUpdate {
  name: string
  category: string | null
  default_unit: string | null
}
