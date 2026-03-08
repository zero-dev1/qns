import { create } from 'zustand';

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
}

export const useNamesStore = create<NamesState>((set) => ({
  ownedNames: [],
  selectedName: null,
  isLoadingNames: false,
  setOwnedNames: (names) => set({ ownedNames: names }),
  setSelectedName: (name) => set({ selectedName: name }),
  setIsLoadingNames: (loading) => set({ isLoadingNames: loading }),
}));
