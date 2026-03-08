import { create } from 'zustand';
import { resolveReverse } from '../utils/qns';

const TTL = 300_000;

interface QNSCacheEntry {
  name: string | null;
  resolvedAt: number;
}

interface QNSCacheStore {
  entries: Record<string, QNSCacheEntry>;
  setEntry: (address: string, name: string | null) => void;
  getEntry: (address: string) => QNSCacheEntry | null;
  batchResolve: (addresses: string[]) => Promise<void>;
}

export const useQNSCacheStore = create<QNSCacheStore>((set, get) => ({
  entries: {},

  setEntry: (address: string, name: string | null) => {
    set((state) => ({
      entries: {
        ...state.entries,
        [address.toLowerCase()]: { name, resolvedAt: Date.now() },
      },
    }));
  },

  getEntry: (address: string) => {
    const entry = get().entries[address.toLowerCase()];
    if (!entry) return null;
    if (Date.now() - entry.resolvedAt > TTL) return null;
    return entry;
  },

  batchResolve: async (addresses: string[]) => {
    const { getEntry, setEntry } = get();
    const uncached = addresses.filter((a) => !getEntry(a));
    const results = await Promise.allSettled(
      uncached.map(async (addr) => {
        const name = await resolveReverse(addr);
        return { addr, name };
      })
    );
    for (const result of results) {
      if (result.status === 'fulfilled') {
        setEntry(result.value.addr, result.value.name);
      }
    }
  },
}));
