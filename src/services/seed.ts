import { writeBatch, collection, doc, type WriteBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { TxType } from '../types'

export interface SeedCategory {
  name: string
  type: TxType
  icon: string
  color: string
  archived: boolean
  order: number
}

export const DEFAULT_CATEGORIES: ReadonlyArray<SeedCategory> = [
  // Expense categories
  { name: 'طعام وبقالة', type: 'expense', icon: '🛒', color: '#F59E0B', archived: false, order: 0 },
  { name: 'مطاعم', type: 'expense', icon: '☕', color: '#EA580C', archived: false, order: 1 },
  { name: 'مواصلات ووقود', type: 'expense', icon: '⛽', color: '#3B82F6', archived: false, order: 2 },
  { name: 'إيجار وسكن', type: 'expense', icon: '🏠', color: '#6366F1', archived: false, order: 3 },
  { name: 'فواتير', type: 'expense', icon: '💡', color: '#EAB308', archived: false, order: 4 },
  { name: 'اتصالات', type: 'expense', icon: '📱', color: '#06B6D4', archived: false, order: 5 },
  { name: 'صحة', type: 'expense', icon: '💊', color: '#EF4444', archived: false, order: 6 },
  { name: 'تسوق وملابس', type: 'expense', icon: '👕', color: '#EC4899', archived: false, order: 7 },
  { name: 'ترفيه', type: 'expense', icon: '🎮', color: '#8B5CF6', archived: false, order: 8 },
  { name: 'تعليم', type: 'expense', icon: '📚', color: '#14B8A6', archived: false, order: 9 },
  { name: 'اشتراكات', type: 'expense', icon: '🔁', color: '#64748B', archived: false, order: 10 },
  { name: 'عائلة وهدايا', type: 'expense', icon: '🎁', color: '#F43F5E', archived: false, order: 11 },
  { name: 'أخرى', type: 'expense', icon: '➕', color: '#94A3B8', archived: false, order: 12 },

  // Income categories
  { name: 'راتب', type: 'income', icon: '💼', color: '#10B981', archived: false, order: 13 },
  { name: 'عمل حر', type: 'income', icon: '💻', color: '#0EA5E9', archived: false, order: 14 },
  { name: 'هدايا', type: 'income', icon: '🎁', color: '#A855F7', archived: false, order: 15 },
  { name: 'استثمار', type: 'income', icon: '📈', color: '#059669', archived: false, order: 16 },
  { name: 'أخرى', type: 'income', icon: '➕', color: '#64748B', archived: false, order: 17 },
]

export function addDefaultCategoriesToBatch(batch: WriteBatch, uid: string): void {
  const categoriesRef = collection(db, 'users', uid, 'categories')

  for (const cat of DEFAULT_CATEGORIES) {
    const docRef = doc(categoriesRef)
    batch.set(docRef, {
      name: cat.name,
      type: cat.type,
      icon: cat.icon,
      color: cat.color,
      archived: cat.archived,
      order: cat.order,
    })
  }
}

export async function seedDefaultCategories(uid: string): Promise<void> {
  const batch = writeBatch(db)
  addDefaultCategoriesToBatch(batch, uid)
  await batch.commit()
}
