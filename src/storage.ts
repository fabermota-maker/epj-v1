const STORAGE_KEY = 'journey-estoque-v1'

export interface StoredState<P, M> {
  products: P[]
  movements: M[]
  dark: boolean
}

export function loadState<P, M>(): StoredState<P, M> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredState<P, M & { date: string | Date }>
    if (!Array.isArray(parsed.products) || !Array.isArray(parsed.movements)) return null
    return {
      products: parsed.products,
      movements: parsed.movements.map((m) => ({
        ...m,
        date: new Date(m.date),
      })) as M[],
      dark: parsed.dark !== false,
    }
  } catch {
    return null
  }
}

export function saveState<P, M>(state: StoredState<P, M>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Quota or private mode — keep the session in memory only.
  }
}
