import { create } from 'zustand'

interface SellerTourState {
  runTour: boolean
  setRunTour: (run: boolean) => void
}

export const useSellerTourStore = create<SellerTourState>((set) => ({
  runTour: false,
  setRunTour: (run) => set({ runTour: run }),
}))
