import {
  writeBatch,
  collection,
  doc,
  getDocs,
  type WriteBatch,
} from 'firebase/firestore'
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
  { name: 'ملابس وإكسسوارات', type: 'expense', icon: '👕', color: '#EC4899', archived: false, order: 7 },
  { name: 'ترفيه', type: 'expense', icon: '🎮', color: '#8B5CF6', archived: false, order: 8 },
  { name: 'تعليم', type: 'expense', icon: '📚', color: '#14B8A6', archived: false, order: 9 },
  { name: 'اشتراكات', type: 'expense', icon: '🔁', color: '#64748B', archived: false, order: 10 },
  { name: 'الهدايا والمناسبات', type: 'expense', icon: '🎁', color: '#F43F5E', archived: false, order: 11 },
  { name: 'التأمين', type: 'expense', icon: '🛡️', color: '#0284C7', archived: false, order: 12 },
  { name: 'العطاء الخيري', type: 'expense', icon: '🤲', color: '#10B981', archived: false, order: 13 },
  { name: 'المصاريف المصرفية', type: 'expense', icon: '🏦', color: '#475569', archived: false, order: 14 },
  { name: 'سداد الديون والأقساط', type: 'expense', icon: '💳', color: '#D97706', archived: false, order: 15 },
  { name: 'العناية الشخصية', type: 'expense', icon: '✨', color: '#A855F7', archived: false, order: 16 },
  { name: 'أخرى', type: 'expense', icon: '➕', color: '#94A3B8', archived: false, order: 17 },

  // Income categories
  { name: 'راتب', type: 'income', icon: '💼', color: '#10B981', archived: false, order: 18 },
  { name: 'عمل حر', type: 'income', icon: '💻', color: '#0EA5E9', archived: false, order: 19 },
  { name: 'هدايا', type: 'income', icon: '🎁', color: '#A855F7', archived: false, order: 20 },
  { name: 'استثمار', type: 'income', icon: '📈', color: '#059669', archived: false, order: 21 },
  { name: 'أخرى', type: 'income', icon: '➕', color: '#64748B', archived: false, order: 22 },
]

export function addDefaultCategoriesToBatch(batch: WriteBatch, uid: string): void {
  const categoriesRef = collection(db, 'users', uid, 'categories')

  for (const cat of DEFAULT_CATEGORIES) {
    const docRef = doc(categoriesRef, `seed_${cat.type}_${cat.order}`)
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

/**
 * Syncs any renamed or newly added default categories to existing user accounts.
 */
export async function syncCategoriesForUser(uid: string): Promise<void> {
  const categoriesRef = collection(db, 'users', uid, 'categories')
  const snap = await getDocs(categoriesRef)

  if (snap.empty) {
    await seedDefaultCategories(uid)
    return
  }

  const existingDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; name: string; type: TxType; order?: number }))
  const existingKeys = new Set(existingDocs.map((c) => `${c.type}:${c.name}`))
  const batch = writeBatch(db)
  let changed = false

  // Handle renames
  for (const docItem of existingDocs) {
    if (docItem.name === 'تسوق وملابس') {
      const ref = doc(categoriesRef, docItem.id)
      batch.update(ref, { name: 'ملابس وإكسسوارات' })
      existingKeys.delete(`${docItem.type}:تسوق وملابس`)
      existingKeys.add(`${docItem.type}:ملابس وإكسسوارات`)
      changed = true
    } else if (docItem.name === 'عائلة وهدايا') {
      const ref = doc(categoriesRef, docItem.id)
      batch.update(ref, { name: 'الهدايا والمناسبات' })
      existingKeys.delete(`${docItem.type}:عائلة وهدايا`)
      existingKeys.add(`${docItem.type}:الهدايا والمناسبات`)
      changed = true
    }
  }

  // Handle missing new categories
  let maxOrder = existingDocs.reduce((acc, c) => Math.max(acc, c.order ?? 0), 0)

  for (const defaultCat of DEFAULT_CATEGORIES) {
    const key = `${defaultCat.type}:${defaultCat.name}`
    if (!existingKeys.has(key)) {
      maxOrder++
      const newDocRef = doc(categoriesRef)
      batch.set(newDocRef, {
        name: defaultCat.name,
        type: defaultCat.type,
        icon: defaultCat.icon,
        color: defaultCat.color,
        archived: false,
        order: maxOrder,
      })
      existingKeys.add(key)
      changed = true
    }
  }

  if (changed) {
    await batch.commit()
  }
}
