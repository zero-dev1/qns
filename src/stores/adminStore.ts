import { create } from 'zustand';
import { getPublicClient, getWalletClient, namehash, labelHash } from '../utils/qns';
import {
  QNS_REGISTRAR_ADDRESS,
  QNS_REGISTRAR_ABI,
  QNS_RESOLVER_ADDRESS,
  QNS_RESOLVER_ABI,
} from '../config/contracts';
import type { Address } from 'viem';

export type AdminSection = 'overview' | 'reserve' | 'registrations' | 'pricing' | 'treasury' | 'settings';

interface AdminState {
  // Access control
  adminAddress: Address | null;
  isCheckingAdmin: boolean;
  
  // Navigation
  currentSection: AdminSection;
  
  // Overview data
  totalRegistrations: bigint | null;
  reservedNamesCount: number | null;
  contractBalance: bigint | null;
  treasuryAddress: Address | null;
  burnAddress: Address | null;
  burnPercent: bigint | null;
  price3Char: bigint | null;
  price4Char: bigint | null;
  price5PlusChar: bigint | null;
  permanentMultiplier: bigint | null;
  
  // Reserved names
  reservedNames: string[];
  isLoadingReserved: boolean;
  
  // Registration lookup
  lookupName: string;
  lookupResult: {
    name: string;
    owner: Address;
    expires: bigint;
    registeredAt: bigint;
    isPermanent: boolean;
    resolvedAddress: Address | null;
    textRecords: Record<string, string>;
  } | null;
  isLookingUp: boolean;
  
  // Actions
  checkAdmin: (userAddress: Address) => Promise<void>;
  setCurrentSection: (section: AdminSection) => void;
  
  // Overview actions
  loadOverviewData: () => Promise<void>;
  
  // Reserve names actions
  loadReservedNames: () => Promise<void>;
  reserveName: (name: string, account: Address) => Promise<`0x${string}`>;
  unreserveName: (name: string, account: Address) => Promise<`0x${string}`>;
  assignReservedName: (name: string, to: Address, account: Address) => Promise<`0x${string}`>;
  
  // Registration lookup
  setLookupName: (name: string) => void;
  lookupRegistration: (name: string) => Promise<void>;
  
  // Pricing actions
  updatePrices: (prices: { char3: bigint; char4: bigint; char5Plus: bigint }, account: Address) => Promise<`0x${string}`>;
  updatePermanentMultiplier: (multiplier: bigint, account: Address) => Promise<`0x${string}`>;
  updateBurnPercent: (percent: bigint, account: Address) => Promise<`0x${string}`>;
  
  // Treasury actions
  withdrawToTreasury: (account: Address) => Promise<`0x${string}`>;
  
  // Settings actions
  transferAdmin: (newAdmin: Address, account: Address) => Promise<`0x${string}`>;
  setTreasury: (newTreasury: Address, account: Address) => Promise<`0x${string}`>;
  setBurnAddress: (newBurn: Address, account: Address) => Promise<`0x${string}`>;
  setDefaultResolver: (newResolver: Address, account: Address) => Promise<`0x${string}`>;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  // Initial state
  adminAddress: null,
  isCheckingAdmin: false,
  currentSection: 'overview',
  
  totalRegistrations: null,
  reservedNamesCount: null,
  contractBalance: null,
  treasuryAddress: null,
  burnAddress: null,
  burnPercent: null,
  price3Char: null,
  price4Char: null,
  price5PlusChar: null,
  permanentMultiplier: null,
  
  reservedNames: [],
  isLoadingReserved: false,
  
  lookupName: '',
  lookupResult: null,
  isLookingUp: false,
  
  // Check if connected wallet is admin
  checkAdmin: async (_userAddress: Address) => {
    set({ isCheckingAdmin: true });
    try {
      const client = getPublicClient();
      const admin = await client.readContract({
        address: QNS_REGISTRAR_ADDRESS,
        abi: QNS_REGISTRAR_ABI,
        functionName: 'admin',
      });
      set({ adminAddress: admin });
    } catch (err) {
      console.error('Error checking admin:', err);
      set({ adminAddress: null });
    } finally {
      set({ isCheckingAdmin: false });
    }
  },
  
  setCurrentSection: (section) => set({ currentSection: section }),
  
  // Load all overview data
  loadOverviewData: async () => {
    const client = getPublicClient();
    try {
      const [
        totalReg,
        reservedList,
        balance,
        treasury,
        burnAddr,
        burnPct,
        price3,
        price4,
        price5,
        permMult,
      ] = await Promise.all([
        client.readContract({
          address: QNS_REGISTRAR_ADDRESS,
          abi: QNS_REGISTRAR_ABI,
          functionName: 'totalRegistrations',
        }),
        client.readContract({
          address: QNS_REGISTRAR_ADDRESS,
          abi: QNS_REGISTRAR_ABI,
          functionName: 'getReservedNames',
        }),
        client.getBalance({ address: QNS_REGISTRAR_ADDRESS }),
        client.readContract({
          address: QNS_REGISTRAR_ADDRESS,
          abi: QNS_REGISTRAR_ABI,
          functionName: 'treasury',
        }),
        client.readContract({
          address: QNS_REGISTRAR_ADDRESS,
          abi: QNS_REGISTRAR_ABI,
          functionName: 'burnAddress',
        }),
        client.readContract({
          address: QNS_REGISTRAR_ADDRESS,
          abi: QNS_REGISTRAR_ABI,
          functionName: 'burnPercent',
        }),
        client.readContract({
          address: QNS_REGISTRAR_ADDRESS,
          abi: QNS_REGISTRAR_ABI,
          functionName: 'price3Char',
        }),
        client.readContract({
          address: QNS_REGISTRAR_ADDRESS,
          abi: QNS_REGISTRAR_ABI,
          functionName: 'price4Char',
        }),
        client.readContract({
          address: QNS_REGISTRAR_ADDRESS,
          abi: QNS_REGISTRAR_ABI,
          functionName: 'price5PlusChar',
        }),
        client.readContract({
          address: QNS_REGISTRAR_ADDRESS,
          abi: QNS_REGISTRAR_ABI,
          functionName: 'permanentMultiplier',
        }),
      ]);
      
      set({
        totalRegistrations: totalReg,
        reservedNamesCount: (reservedList as string[]).length,
        contractBalance: balance,
        treasuryAddress: treasury,
        burnAddress: burnAddr,
        burnPercent: burnPct,
        price3Char: price3,
        price4Char: price4,
        price5PlusChar: price5,
        permanentMultiplier: permMult,
      });
    } catch (err) {
      console.error('Error loading overview data:', err);
    }
  },
  
  // Load reserved names
  loadReservedNames: async () => {
    set({ isLoadingReserved: true });
    try {
      const client = getPublicClient();
      const names = await client.readContract({
        address: QNS_REGISTRAR_ADDRESS,
        abi: QNS_REGISTRAR_ABI,
        functionName: 'getReservedNames',
      });
      set({ reservedNames: names as string[], reservedNamesCount: (names as string[]).length });
    } catch (err) {
      console.error('Error loading reserved names:', err);
    } finally {
      set({ isLoadingReserved: false });
    }
  },
  
  // Reserve a name
  reserveName: async (name: string, account: Address) => {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('No wallet connected');
    
    const hash = await walletClient.writeContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'reserveName',
      args: [name],
      account,
    });
    
    // Refresh list after transaction
    await get().loadReservedNames();
    return hash;
  },
  
  // Unreserve a name
  unreserveName: async (name: string, account: Address) => {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('No wallet connected');
    
    const hash = await walletClient.writeContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'unreserveName',
      args: [name],
      account,
    });
    
    await get().loadReservedNames();
    return hash;
  },
  
  // Assign reserved name
  assignReservedName: async (name: string, to: Address, account: Address) => {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('No wallet connected');
    
    const hash = await walletClient.writeContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'assignReservedName',
      args: [name, to],
      account,
    });
    
    await get().loadReservedNames();
    return hash;
  },
  
  // Registration lookup
  setLookupName: (name) => set({ lookupName: name }),
  
  lookupRegistration: async (name: string) => {
    set({ isLookingUp: true, lookupResult: null });
    try {
      const client = getPublicClient();
      const lh = labelHash(name.toLowerCase());
      
      const reg = await client.readContract({
        address: QNS_REGISTRAR_ADDRESS,
        abi: QNS_REGISTRAR_ABI,
        functionName: 'registrations',
        args: [lh],
      });
      
      if (reg[0] === '0x0000000000000000000000000000000000000000') {
        set({ lookupResult: null, isLookingUp: false });
        return;
      }
      
      const node = namehash(`${name.toLowerCase()}.qf`);
      
      // Get resolved address
      let resolvedAddress: Address | null = null;
      try {
        const addr = await client.readContract({
          address: QNS_RESOLVER_ADDRESS,
          abi: QNS_RESOLVER_ABI,
          functionName: 'addr',
          args: [node],
        });
        if (addr !== '0x0000000000000000000000000000000000000000') {
          resolvedAddress = addr;
        }
      } catch {
        // ignore
      }
      
      // Get text records
      const textRecords: Record<string, string> = {};
      const keys = ['email', 'url', 'avatar', 'description', 'twitter', 'github'];
      for (const key of keys) {
        try {
          const value = await client.readContract({
            address: QNS_RESOLVER_ADDRESS,
            abi: QNS_RESOLVER_ABI,
            functionName: 'text',
            args: [node, key],
          });
          if (value) textRecords[key] = value;
        } catch {
          // ignore
        }
      }
      
      set({
        lookupResult: {
          name: name.toLowerCase(),
          owner: reg[0],
          expires: reg[1],
          registeredAt: reg[2],
          isPermanent: reg[1] === 0n,
          resolvedAddress,
          textRecords,
        },
        isLookingUp: false,
      });
    } catch (err) {
      console.error('Error looking up registration:', err);
      set({ lookupResult: null, isLookingUp: false });
    }
  },
  
  // Pricing updates
  updatePrices: async (prices: { char3: bigint; char4: bigint; char5Plus: bigint }, account: Address) => {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('No wallet connected');
    
    const hash = await walletClient.writeContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'setPrice',
      args: [prices.char3, prices.char4, prices.char5Plus],
      account,
    });
    
    await get().loadOverviewData();
    return hash;
  },
  
  updatePermanentMultiplier: async (multiplier: bigint, account: Address) => {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('No wallet connected');
    
    const hash = await walletClient.writeContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'setPermanentMultiplier',
      args: [multiplier],
      account,
    });
    
    await get().loadOverviewData();
    return hash;
  },
  
  updateBurnPercent: async (percent: bigint, account: Address) => {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('No wallet connected');
    
    const hash = await walletClient.writeContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'setBurnPercent',
      args: [percent],
      account,
    });
    
    await get().loadOverviewData();
    return hash;
  },
  
  // Treasury
  withdrawToTreasury: async (account: Address) => {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('No wallet connected');
    
    const hash = await walletClient.writeContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'withdrawToTreasury',
      args: [],
      account,
    });
    
    await get().loadOverviewData();
    return hash;
  },
  
  // Settings
  transferAdmin: async (newAdmin: Address, account: Address) => {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('No wallet connected');
    
    const hash = await walletClient.writeContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'setAdmin',
      args: [newAdmin],
      account,
    });
    
    await get().checkAdmin(account);
    return hash;
  },
  
  setTreasury: async (newTreasury: Address, account: Address) => {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('No wallet connected');
    
    const hash = await walletClient.writeContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'setTreasury',
      args: [newTreasury],
      account,
    });
    
    await get().loadOverviewData();
    return hash;
  },
  
  setBurnAddress: async (newBurn: Address, account: Address) => {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('No wallet connected');
    
    const hash = await walletClient.writeContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'setBurnAddress',
      args: [newBurn],
      account,
    });
    
    await get().loadOverviewData();
    return hash;
  },
  
  setDefaultResolver: async (newResolver: Address, account: Address) => {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('No wallet connected');
    
    const hash = await walletClient.writeContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'setDefaultResolver',
      args: [newResolver],
      account,
    });
    
    return hash;
  },
}));
