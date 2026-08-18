'use client'

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type CartItem = {
  productId: number | string
  slug: string
  title: string
  variantTitle?: string
  color?: string
  /** Preis-Momentaufnahme für die Anzeige — verbindlich berechnet der Server beim Checkout */
  unitPrice: number
  /** Versandkosten pro Stück (Anzeige; entfällt bei Abholung) */
  shippingCost?: number
  quantity: number
  image?: string
  categorySlug?: string
  /**
   * Einzelanfertigung nach Kundenvorgabe — dafür gibt es kein Widerrufsrecht,
   * was in der Kasse ausdrücklich bestätigt werden muss. Fehlt die Angabe
   * (alter Warenkorb im Browser), gilt bewusst „nein": Lieber einmal zu viel
   * Widerrufsrecht als eine Kundschaft, der man es zu Unrecht abspricht.
   */
  madeToOrder?: boolean
}

type CartContextValue = {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (key: string) => void
  setQuantity: (key: string, quantity: number) => void
  clear: () => void
  count: number
  subtotal: number
}

const CartContext = createContext<CartContextValue | null>(null)

const STORAGE_KEY = 'vh-cart-v1'

export function cartItemKey(item: Pick<CartItem, 'productId' | 'variantTitle' | 'color'>): string {
  return [item.productId, item.variantTitle || '', item.color || ''].join('::')
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) setItems(JSON.parse(raw))
    } catch {
      // defekter Storage → leerer Warenkorb
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // Storage voll/blockiert — Warenkorb lebt dann nur im Speicher
    }
  }, [items, hydrated])

  const value = useMemo<CartContextValue>(() => {
    const addItem = (item: CartItem) => {
      setItems((prev) => {
        const key = cartItemKey(item)
        const existing = prev.find((p) => cartItemKey(p) === key)
        if (existing) {
          return prev.map((p) =>
            cartItemKey(p) === key ? { ...p, quantity: p.quantity + item.quantity } : p,
          )
        }
        return [...prev, item]
      })
    }

    const removeItem = (key: string) => {
      setItems((prev) => prev.filter((p) => cartItemKey(p) !== key))
    }

    const setQuantity = (key: string, quantity: number) => {
      setItems((prev) =>
        prev
          .map((p) => (cartItemKey(p) === key ? { ...p, quantity } : p))
          .filter((p) => p.quantity > 0),
      )
    }

    const clear = () => setItems([])

    const count = items.reduce((sum, i) => sum + i.quantity, 0)
    const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)

    return { items, addItem, removeItem, setQuantity, clear, count, subtotal }
  }, [items])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart muss innerhalb von <CartProvider> verwendet werden')
  return ctx
}
