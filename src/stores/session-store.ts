import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type UserRole = 'dispatcher' | 'vendor_manager' | 'admin' | 'support_agent'

export type MockUser = {
  id: number
  name: string
  role: UserRole
  /** For vendor_manager role — the vendor they manage */
  managedVendorId?: number
}

export const MOCK_USERS: MockUser[] = [
  { id: 1, name: 'Alex (Dispatcher)', role: 'dispatcher' },
  { id: 2, name: 'Sam (Vendor Manager)', role: 'vendor_manager', managedVendorId: 2 }, // BlueLine Services
  { id: 3, name: 'Jordan (Admin)', role: 'admin' },
  { id: 4, name: 'Casey (Support Agent)', role: 'support_agent' },
]

type SessionStore = {
  currentUser: MockUser
  setUser: (user: MockUser) => void
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      currentUser: MOCK_USERS[0], // Default: dispatcher
      setUser: (user) => set({ currentUser: user }),
    }),
    { name: 'retailfixit-session' },
  ),
)
