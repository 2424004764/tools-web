export interface ShoppingItem {
  id: string
  name: string
  quantity: number
  unit: string
  weight: string
  category: string
  note: string
  estimatedPrice: number
  actualPrice: number
  purchased: boolean
  required: boolean
  priority: 1 | 2 | 3
  imageUrl?: string | null
  purchasedAt?: string
}

export interface ShoppingList {
  id: string
  name: string
  description: string
  budget: number
  method: string
  archived: boolean
  updatedAt: string
  items: ShoppingItem[]
}

export interface ShoppingTemplate {
  id: string
  name: string
  description: string
  budget: number
  method: string
  items: ShoppingItem[]
  updatedAt: string
}

export interface ShoppingHistoryEntry {
  id: string
  listName: string
  item: ShoppingItem
  purchasedAt: string
}

export interface ShoppingData {
  version: number
  lists: ShoppingList[]
  templates: ShoppingTemplate[]
  history: ShoppingHistoryEntry[]
}

const DB_NAME = 'yifang-shopping-list'
const STORE_NAME = 'documents'
const DB_VERSION = 1
const LEGACY_KEY = 'tools-shopping-lists-v1'
const DATA_VERSION = 2

function fallbackKey(userId: string): string {
  const safeId = userId.trim().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 96) || 'anonymous'
  return `tools-shopping-lists-v2:${safeId}`
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'))
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'))
  })
}

function readStore<T>(db: IDBDatabase, mode: IDBTransactionMode, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, mode).objectStore(STORE_NAME).get(key)
    request.onsuccess = () => resolve(request.result as T | undefined)
    request.onerror = () => reject(request.error || new Error('IndexedDB read failed'))
  })
}

function writeStore(db: IDBDatabase, data: ShoppingData, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(data, key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error || new Error('IndexedDB write failed'))
  })
}

function migrateLegacy(raw: unknown): ShoppingData | null {
  if (!Array.isArray(raw) || !raw.length) return null
  const lists = raw.map((list: Partial<ShoppingList>) => ({
    id: list.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: list.name || '未命名清单', description: '', budget: 0, method: '线下采购',
    archived: Boolean(list.archived), updatedAt: list.updatedAt || new Date().toISOString(),
    items: Array.isArray(list.items) ? list.items.map((item: Partial<ShoppingItem>) => ({
      id: item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: item.name || '', quantity: Number(item.quantity) || 1, unit: item.unit || '件', weight: item.weight || '',
      category: item.category || '其他', note: item.note || '', estimatedPrice: Number(item.estimatedPrice) || 0,
      actualPrice: Number(item.actualPrice) || 0, purchased: Boolean(item.purchased), required: item.required !== false,
      priority: (item.priority === 3 ? 3 : item.priority === 1 ? 1 : 2) as 1 | 2 | 3, purchasedAt: item.purchasedAt,
    })) : [],
  }))
  return { version: DATA_VERSION, lists, templates: [], history: [] }
}

export async function loadShoppingData(userId: string): Promise<ShoppingData | null> {
  const key = fallbackKey(userId)
  try {
    const db = await openDb()
    const current = await readStore<ShoppingData>(db, 'readonly', key)
    if (current) return current
    const legacyRaw = typeof localStorage !== 'undefined' ? localStorage.getItem(LEGACY_KEY) : null
    const migrated = legacyRaw ? migrateLegacy(JSON.parse(legacyRaw)) : null
    if (migrated) {
      await writeStore(db, migrated, key)
      if (typeof localStorage !== 'undefined') localStorage.removeItem(LEGACY_KEY)
      return migrated
    }
    return null
  } catch {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
      if (raw) return JSON.parse(raw) as ShoppingData
      const legacyRaw = typeof localStorage !== 'undefined' ? localStorage.getItem(LEGACY_KEY) : null
      const migrated = legacyRaw ? migrateLegacy(JSON.parse(legacyRaw)) : null
      if (migrated && typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(migrated))
        localStorage.removeItem(LEGACY_KEY)
      }
      return migrated
    } catch { return null }
  }
}

export async function saveShoppingData(userId: string, data: ShoppingData): Promise<'indexeddb' | 'localStorage'> {
  const key = fallbackKey(userId)
  const normalized = { ...data, version: DATA_VERSION }
  try {
    const db = await openDb()
    await writeStore(db, normalized, key)
    return 'indexeddb'
  } catch {
    if (typeof localStorage === 'undefined') throw new Error('No local storage available')
    localStorage.setItem(key, JSON.stringify(normalized))
    return 'localStorage'
  }
}

export function getShoppingStorageKey(userId: string): string { return fallbackKey(userId) }
