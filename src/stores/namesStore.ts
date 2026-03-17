import { create } from 'zustand';
import { getNamesOwnedByAddress } from '../utils/qns';

export interface OwnedName {
  name: string;
  expires: bigint;
  registeredAt: bigint;
  isPermanent: boolean;
}

interface NamesState {
  ownedNames: OwnedName[];
  selectedName: string | null;
  isLoadingNames: boolean;
  setOwnedNames: (names: OwnedName[]) => void;
  setSelectedName: (name: string | null) => void;
  setIsLoadingNames: (loading: boolean) => void;
  refreshNames: (address: `0x${string}`) => Promise<void>;
  _lastRefreshTime: number;
}

export const useNamesStore = create<NamesState>((set, get) => ({
  ownedNames: [],
  selectedName: null,
  isLoadingNames: false,
  _lastRefreshTime: 0,
  setOwnedNames: (names) => set({ ownedNames: names }),
  setSelectedName: (name) => set({ selectedName: name }),
  setIsLoadingNames: (loading) => set({ isLoadingNames: loading }),
  refreshNames: async (address: `0x${string}`) => {
    if (!address) return;
    // Prevent multiple simultaneous refreshes
    const now = Date.now();
    if (now - get()._lastRefreshTime < 500 && get().isLoadingNames) {
      return;
    }
    set({ isLoadingNames: true, _lastRefreshTime: now });
    try {
      const names = await getNamesOwnedByAddress(address);
      // Add isPermanent property based on expiry value
      // Permanent names have expires = 0 or max uint256 (2^256 - 1)
      const maxUint256 = 2n ** 256n - 1n;
      const namesWithPermanent = names.map(name => ({
        ...name,
        isPermanent: name.expires === 0n || name.expires === maxUint256,
      }));
      // Create new array to ensure React detects the change
      set({ ownedNames: namesWithPermanent });
    } catch {
      set({ ownedNames: [] });
    } finally {
      set({ isLoadingNames: false });
    }
  },
}));
