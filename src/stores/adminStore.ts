import { create } from 'zustand';
import { getPublicClient, getWalletClient, namehash, labelHash, getReservedNamesList } from '../utils/qns';
import {
  QNS_REGISTRY_ADDRESS,
  QNS_REGISTRY_ABI,
  QNS_REGISTRAR_ADDRESS,
  QNS_REGISTRAR_ABI,
  QNS_RESOLVER_ADDRESS,
  QNS_RESOLVER_ABI,
  QNS_BADGE_REGISTRY_ADDRESS,
  QNS_BADGE_REGISTRY_ABI,
} from '../config/contracts';
import type { Address } from 'viem';
import type { TxResult } from '../utils/contractCall';

export type AdminSection = 'overview' | 'reserve' | 'registrations' | 'pricing' | 'treasury' | 'settings' | 'badges';

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
  assignedNames: Set<string>;
  isLoadingAssigned: boolean;
  
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
  
  // Registration list
  registrationList: Array<{
    name: string;
    owner: string;
    registeredAt: bigint;
    isPermanent: boolean;
    hasPioneer: boolean;
  }>;
  isLoadingRegistrations: boolean;
  
  // Badge management
  badgeLookupName: string;
  badgeLookupResult: { nameHash: string; badges: string[] } | null;
  isCheckingBadges: boolean;
  
  // Actions
  checkAdmin: (userAddress: Address) => Promise<void>;
  setCurrentSection: (section: AdminSection) => void;
  
  // Overview actions
  loadOverviewData: () => Promise<void>;
  
  // Reserve names actions
  loadReservedNames: () => Promise<void>;
  loadAssignedStatus: () => Promise<void>;
  reserveName: (name: string, account: string) => Promise<string>;
  unreserveName: (name: string, account: string) => Promise<string>;
  assignReservedName: (name: string, to: Address, account: string) => Promise<string>;
  
  // Registration lookup
  setLookupName: (name: string) => void;
  lookupRegistration: (name: string) => Promise<void>;
  
  // Registration list
  loadRegistrations: () => Promise<void>;
  
  // Badge actions
  setBadgeLookupName: (name: string) => void;
  checkBadges: (name: string) => Promise<void>;
  assignBadge: (name: string, badgeType: string, account: string) => Promise<TxResult>;
  assignBadgeBatch: (names: string[], badgeType: string, account: string) => Promise<TxResult>;
  revokeBadge: (name: string, badgeType: string, account: string) => Promise<TxResult>;
  
  // Pricing actions
  updatePrices: (prices: { char3: bigint; char4: bigint; char5Plus: bigint }, account: string) => Promise<string>;
  updatePermanentMultiplier: (multiplier: bigint, account: string) => Promise<string>;
  updateBurnPercent: (percent: bigint, account: string) => Promise<string>;
  
  // Treasury actions
  withdrawToTreasury: (account: string) => Promise<string>;
  
  // Settings actions
  transferAdmin: (newAdmin: Address, account: string) => Promise<string>;
  setTreasury: (newTreasury: Address, account: string) => Promise<string>;
  setBurnAddress: (newBurn: Address, account: string) => Promise<string>;
  setDefaultResolver: (newResolver: Address, account: string) => Promise<string>;
}

// Static list of reserved names from deploy script
const RESERVED_NAMES_LIST = [
  'aave','about','abu','adam','admin','africa','ahmed','airdrop','aisha','alaoui','alchemist','alex','ali','alice','alpha','altcoingordon','altcoinsensei','altstein','amazon','amm','analyst','anna','ansem','anthony','api','app','apple','ariff','arthurhays','artist','asia','australia','avalanche','avatar','axe','axeledger','badge','bahrain','bear','becker','ben','binance','bio','bitboy','bitcoin','bitomoney','block','blog','bluntz','bob','borrow','brazil','brian','bridge','bull','bullishbear','burn','bybit','canada','cardano','careers','ceo','cex','chad','chadpumpiano','chain','chainlink','chancellor','china','chris','claim','cli','cobie','coin','coinbase','compound','congress','contact','contract','core','council','crayola','creator','crediblecrypto','crypto44','cryptobanter','cryptobirb','cryptocaesar','cryptofella','cryptogideon','cryptogodjohn','cryptomanic','cryptomanran','cryptomonk','cryptonova','cryptotony','cryptowizard','cryptoyoda','ctgymrat','cto','curve','dan','dao','dapp','dapplab','dappstore','david','defi','degen','degenkenn','degenpoet','demo','deploy','deployer','developer','dev','dex','dippy','discord','docs','dogecoin','donalt','drew','drprofit','druya','dtcrypto','dubai','dydx','ecosystem','egypt','eliz','ella','embassy','emily','emma','engineer','epoch','eric','ethereum','europe','exchange','explorer','ezmoney','farm','fatima','fattony','faucet','fee','fifa','follow','foundation','founder','france','fund','fusion','futures','gainzy','gamer','gateway','gemdetector','genesis','germany','gideon','goodie','google','goomba','gorgonite','governance','government','governor','grants','harvest','hassan','hawk','help','hodl','home','hongkong','hsaka','hub','hwmedia','identity','incubator','incomeshark','index','india','influencer','info','intrepid','inversebrah','investor','jack','james','jane','japan','jason','jobs','joe','john','jopp','jordan','justiinape','kaleo','karamata','kate','kenobi','kenya','kevin','kingdom','kito','korea','kraken','kucoin','kuwait','labs','lambo','larkdavis','laura','launchpad','lawless','layeralpha','ledger','lend','leo','leverage','lido','link','liquidity','lisa','london','lookonchain','lsd','luke','main','mainnet','maker','manage','margin','maria','mark','market','matt','matteo','mail','manifesto','max','mayor','media','meme','memechi','memecoin','meta','metamask','mexc','mexico','mezcez','mia','michael','microsoft','mike','minister','mint','mohammed','moneylord','moon','murad','musa','musician','name','nations','nebraskagooner','network','news','newyork','nft','nick','nils','nigeria','nilsb','nite','noach','noah','node','nucleus','nucleusx','octgems','official','olivia','olympic','oman','omar','opensea','options','oracle','panamax','paul','paw','pentoshi','pepe','perps','peter','phantom','polkadot','polygon','pool','portal','potus','president','press','privacy','profile','protocol','pump','qatar','qfclash','qflink','qfpad','qfnetwork','qfpay','qfstream','qfswap','qfvote','quantum','quantumfusion','quantumnotary','rabby','rachel','rainbow','raoul','reddit','register','registrar','registry','rektcapital','relay','renew','researcher','reserve','resolver','reverse','rewards','reward','ripple','rishad','root','roshi','royal','rush','russia','ryan','sam','sarah','satoshi','satoshiflipper','saudi','saylor','sdk','search','security','senate','settings','shard','shark','sharky','shiba','sigma','singapore','singularity','soef','solana','sophie','spot','stake','spin','staking','status','steve','streamer','support','swampmonkey','swap','sykodelic','tang','tareeq','team','teddy','telegram','terms','tesla','test','testnet','tiktok','token','tokyo','tom','trade','trader','treasury','trezor','turkey','twitter','uae','ukraine','uniswap','united','uponlygreg','usa','validator','vault','vector','verified','vest','vitalik','vote','wallet','watcherguru','web','web3princess','welcome','whale','yield','youtube','zhusu','doomly','key','boolean','user','888','diskword','hayk','denis','alisher','krzysztof','aleksandra','lygin'
];

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
  assignedNames: new Set(),
  isLoadingAssigned: false,
  
  lookupName: '',
  lookupResult: null,
  isLookingUp: false,
  
  // Registration list
  registrationList: [],
  isLoadingRegistrations: false,
  
  // Badge management
  badgeLookupName: '',
  badgeLookupResult: null,
  isCheckingBadges: false,
  
  // Check if connected wallet is admin
  checkAdmin: async (_userAddress: Address) => {
    set({ isCheckingAdmin: true });
    try {
      const client = getPublicClient();
      const admin = await client.readContract({
        address: QNS_REGISTRAR_ADDRESS,
        abi: QNS_REGISTRAR_ABI,
        functionName: 'admin',
      }) as `0x${string}`;
      set({ adminAddress: admin });
    } catch (err) {
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
        }) as Promise<bigint>,
        client.getBalance({ address: QNS_REGISTRAR_ADDRESS }),
        client.readContract({
          address: QNS_REGISTRAR_ADDRESS,
          abi: QNS_REGISTRAR_ABI,
          functionName: 'treasury',
        }) as Promise<`0x${string}`>,
        client.readContract({
          address: QNS_REGISTRAR_ADDRESS,
          abi: QNS_REGISTRAR_ABI,
          functionName: 'burnAddress',
        }) as Promise<`0x${string}`>,
        client.readContract({
          address: QNS_REGISTRAR_ADDRESS,
          abi: QNS_REGISTRAR_ABI,
          functionName: 'burnPercent',
        }) as Promise<bigint>,
        client.readContract({
          address: QNS_REGISTRAR_ADDRESS,
          abi: QNS_REGISTRAR_ABI,
          functionName: 'price3Char',
        }) as Promise<bigint>,
        client.readContract({
          address: QNS_REGISTRAR_ADDRESS,
          abi: QNS_REGISTRAR_ABI,
          functionName: 'price4Char',
        }) as Promise<bigint>,
        client.readContract({
          address: QNS_REGISTRAR_ADDRESS,
          abi: QNS_REGISTRAR_ABI,
          functionName: 'price5PlusChar',
        }) as Promise<bigint>,
        client.readContract({
          address: QNS_REGISTRAR_ADDRESS,
          abi: QNS_REGISTRAR_ABI,
          functionName: 'permanentMultiplier',
        }) as Promise<bigint>,
      ]);
      
      set({
        totalRegistrations: totalReg,
        contractBalance: balance,
        treasuryAddress: treasury,
        burnAddress: burnAddr,
        burnPercent: burnPct,
        price3Char: price3,
        price4Char: price4,
        price5PlusChar: price5,
        permanentMultiplier: permMult,
      });
      
      // Get reserved names count from on-chain data
      try {
        const onChainReservedNames = await getReservedNamesList();
        const onChainNames = (onChainReservedNames && onChainReservedNames.length > 0) ? onChainReservedNames : [];
        const mergedCount = [...new Set([...onChainNames, ...RESERVED_NAMES_LIST])].length;
        set({ reservedNamesCount: mergedCount });
      } catch {
        set({ reservedNamesCount: [...new Set(RESERVED_NAMES_LIST)].length });
      }
    } catch (err) {
    }
  },
  
  // Load reserved names
  loadReservedNames: async () => {
    set({ isLoadingReserved: true });
    try {
      // Try to get on-chain reserved names
      const onChainReservedNames = await getReservedNamesList();
      
      // Always merge on-chain and static lists
      const onChainNames = (onChainReservedNames && onChainReservedNames.length > 0) ? onChainReservedNames : [];
      const merged = [...new Set([...onChainNames, ...RESERVED_NAMES_LIST])].sort();
      
      set({ 
        reservedNames: merged,
        reservedNamesCount: merged.length,
        isLoadingReserved: false 
      });
    } catch (err) {
      // Fall back to static list if contract call fails
      const fallbackList = [...new Set(RESERVED_NAMES_LIST)].sort();
      set({ 
        reservedNames: fallbackList,
        reservedNamesCount: fallbackList.length,
        isLoadingReserved: false 
      });
    }
  },

  // Load assigned status for reserved names
  loadAssignedStatus: async () => {
    set({ isLoadingAssigned: true });
    try {
      const client = getPublicClient();
      const { reservedNames } = get();
      const assigned = new Set<string>();

      // Check ownership for each reserved name
      await Promise.all(
        reservedNames.map(async (name) => {
          try {
            const node = namehash(`${name}.qf`);
            const owner = await client.readContract({
              address: QNS_REGISTRY_ADDRESS,
              abi: QNS_REGISTRY_ABI,
              functionName: 'owner',
              args: [node],
            });
            if (owner !== '0x0000000000000000000000000000000000000000') {
              assigned.add(name);
            }
          } catch {
            // Ignore errors for individual names
          }
        })
      );

      set({ assignedNames: assigned });
    } catch (err) {
    } finally {
      set({ isLoadingAssigned: false });
    }
  },
  
  // Reserve a name
  reserveName: async (name: string, account: string) => {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('No wallet connected');
    
    const { txHash, confirmation } = await walletClient.writeContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'reserveName',
      args: [name],
      account,
    });
    
    // Optimistically add the name to local state
    const currentNames = get().reservedNames;
    if (!currentNames.includes(name)) {
      set({ reservedNames: [...currentNames, name].sort(), reservedNamesCount: currentNames.length + 1 });
    }
    
    // Background confirmation for admin operations
    confirmation.then((result) => {
      if (!result.confirmed) {
        // Revert optimistic state on failure
        get().loadReservedNames();
      }
    });
    
    return txHash;
  },
  
  // Unreserve a name
  unreserveName: async (name: string, account: string) => {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('No wallet connected');
    
    const { txHash, confirmation } = await walletClient.writeContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'unreserveName',
      args: [name],
      account,
    });
    
    // Background confirmation
    confirmation.then((result) => {
      if (!result.confirmed) {
        // Revert state on failure
        get().loadReservedNames();
      }
    });
    
    return txHash;
  },
  
  // Assign reserved name
  assignReservedName: async (name: string, to: Address, account: string) => {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('No wallet connected');
    
    const { txHash, confirmation } = await walletClient.writeContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'assignReservedName',
      args: [name, to],
      account,
    });
    
    // Background confirmation
    confirmation.then((result) => {
      if (!result.confirmed) {
        // Revert state on failure
        get().loadReservedNames();
      }
    });
    
    return txHash;
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
      }) as [string, bigint, bigint];
      
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
        }) as string;
        if (addr !== '0x0000000000000000000000000000000000000000') {
          resolvedAddress = addr as Address;
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
          }) as string;
          if (value) textRecords[key] = value;
        } catch {
          // ignore
        }
      }
      
      set({
        lookupResult: {
          name: name.toLowerCase(),
          owner: reg[0] as `0x${string}`,
          expires: reg[1],
          registeredAt: reg[2],
          isPermanent: reg[1] === 0n,
          resolvedAddress,
          textRecords,
        },
        isLookingUp: false,
      });
    } catch (err) {
      set({ lookupResult: null, isLookingUp: false });
    }
  },
  
  // Pricing updates
  updatePrices: async (prices: { char3: bigint; char4: bigint; char5Plus: bigint }, account: string) => {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('No wallet connected');
    
    const { txHash, confirmation } = await walletClient.writeContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'setPrice',
      args: [prices.char3, prices.char4, prices.char5Plus],
      account,
    });
    
    // Background confirmation
    confirmation.then((result) => {
      if (!result.confirmed) {
        // Revert state on failure
        get().loadOverviewData();
      }
    });
    
    return txHash;
  },
  
  updatePermanentMultiplier: async (multiplier: bigint, account: string) => {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('No wallet connected');
    
    const { txHash, confirmation } = await walletClient.writeContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'setPermanentMultiplier',
      args: [multiplier],
      account,
    });
    
    // Background confirmation
    confirmation.then((result) => {
      if (!result.confirmed) {
        // Revert state on failure
        get().loadOverviewData();
      }
    });
    
    return txHash;
  },
  
  updateBurnPercent: async (percent: bigint, account: string) => {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('No wallet connected');
    
    const { txHash, confirmation } = await walletClient.writeContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'setBurnPercent',
      args: [percent],
      account,
    });
    
    // Background confirmation
    confirmation.then((result) => {
      if (!result.confirmed) {
        // Revert state on failure
        get().loadOverviewData();
      }
    });
    
    return txHash;
  },
  
  // Treasury
  withdrawToTreasury: async (account: string) => {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('No wallet connected');
    
    const { txHash, confirmation } = await walletClient.writeContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'withdrawToTreasury',
      args: [],
      account,
    });
    
    // Background confirmation
    confirmation.then((result) => {
      if (!result.confirmed) {
        // Revert state on failure
        get().loadOverviewData();
      }
    });
    
    return txHash;
  },
  
  // Settings
  transferAdmin: async (newAdmin: Address, account: string) => {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('No wallet connected');
    
    const { txHash, confirmation } = await walletClient.writeContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'setAdmin',
      args: [newAdmin],
      account,
    });
    
    // Background confirmation
    confirmation.then((result) => {
      if (!result.confirmed) {
        // Re-check admin status on failure
        get().checkAdmin(get().adminAddress || '0x');
      }
    });
    
    // Note: checkAdmin expects EVM address format - skipped here as account may be SS58
    return txHash;
  },
  
  setTreasury: async (newTreasury: Address, account: string) => {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('No wallet connected');
    
    const { txHash, confirmation } = await walletClient.writeContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'setTreasury',
      args: [newTreasury],
      account,
    });
    
    // Background confirmation
    confirmation.then((result) => {
      if (!result.confirmed) {
        // Revert state on failure
        get().loadOverviewData();
      }
    });
    
    return txHash;
  },
  
  setBurnAddress: async (newBurn: Address, account: string) => {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('No wallet connected');
    
    const { txHash, confirmation } = await walletClient.writeContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'setBurnAddress',
      args: [newBurn],
      account,
    });
    
    // Background confirmation
    confirmation.then((result) => {
      if (!result.confirmed) {
        // Revert state on failure
        get().loadOverviewData();
      }
    });
    
    return txHash;
  },
  
  setDefaultResolver: async (newResolver: Address, account: string) => {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('No wallet connected');
    
    const { txHash, confirmation } = await walletClient.writeContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'setDefaultResolver',
      args: [newResolver],
      account,
    });
    
    // Background confirmation
    confirmation.then((result) => {
      if (!result.confirmed) {
        // Revert state on failure
        get().loadOverviewData();
      }
    });
    
    return txHash;
  },
  
  loadRegistrations: async () => {
    set({ isLoadingRegistrations: true });
    try {
      const REGISTRAR_SS58 = '5EpRx3VESwPSVZL6xrxT2P3hoRhdmWHgVfGFiZqqvWkAftNx';
      const QF_EXPLORER_API = 'https://qf-explorer.mathswins.co.uk/api';

      // Step 1: Fetch all transfers involving the registrar
      const res = await fetch(`${QF_EXPLORER_API}/txs/${REGISTRAR_SS58}?limit=200`);
      const data = await res.json();
      const items = data?.transfers?.items || [];

      // Step 2: Extract unique sender addresses (people who paid the registrar)
      const uniqueSenders = new Set<string>();
      for (const tx of items) {
        if (tx.to === REGISTRAR_SS58 && tx.from !== REGISTRAR_SS58) {
          uniqueSenders.add(tx.from);
        }
      }

      // Step 3: For each sender, get their EVM address and call getNamesByOwner
      const client = getPublicClient();
      const allRegistrations: Array<{
        name: string;
        owner: string;
        registeredAt: bigint;
        isPermanent: boolean;
        hasPioneer: boolean;
      }> = [];

      // We need EVM addresses for getNamesByOwner. The explorer gives SS58.
      // Use the same derivation the app uses elsewhere.
      const { ss58ToEvmAddress } = await import('../utils/address');

      for (const ss58 of uniqueSenders) {
        try {
          let evmAddr: string;
          try {
            evmAddr = ss58ToEvmAddress(ss58);
          } catch {
            continue; // Skip if can't derive
          }

          const names = await client.readContract({
            address: QNS_REGISTRAR_ADDRESS,
            abi: QNS_REGISTRAR_ABI,
            functionName: 'getNamesByOwner',
            args: [evmAddr],
          }) as string[];

          for (const name of names) {
            try {
              const lh = labelHash(name.toLowerCase());
              const reg = await client.readContract({
                address: QNS_REGISTRAR_ADDRESS,
                abi: QNS_REGISTRAR_ABI,
                functionName: 'registrations',
                args: [lh],
              }) as [string, bigint, bigint];

              if (reg[0] !== '0x0000000000000000000000000000000000000000') {
                // Check if has pioneer badge
                let hasPioneer = false;
                try {
                  const nh = namehash(`${name}.qf`);
                  hasPioneer = await client.readContract({
                    address: QNS_BADGE_REGISTRY_ADDRESS,
                    abi: QNS_BADGE_REGISTRY_ABI,
                    functionName: 'hasBadge',
                    args: [nh, 'pioneer'],
                  }) as boolean;
                } catch { /* ignore badge check failures */ }

                allRegistrations.push({
                  name,
                  owner: reg[0],
                  registeredAt: reg[2],
                  isPermanent: reg[1] === 0n,
                  hasPioneer,
                });
              }
            } catch { /* skip individual name failures */ }
          }
        } catch { /* skip individual owner failures */ }
      }

      // Step 4: Sort by registeredAt ascending (earliest first)
      allRegistrations.sort((a, b) => {
        if (a.registeredAt < b.registeredAt) return -1;
        if (a.registeredAt > b.registeredAt) return 1;
        return 0;
      });

      set({ registrationList: allRegistrations, isLoadingRegistrations: false });
    } catch (err) {
      console.error('Failed to load registrations:', err);
      set({ isLoadingRegistrations: false });
    }
  },
  
  // Badge actions
  setBadgeLookupName: (name) => set({ badgeLookupName: name }),
  
  checkBadges: async (name: string) => {
    set({ isCheckingBadges: true, badgeLookupResult: null });
    try {
      const client = getPublicClient();
      const nameHash = namehash(`${name}.qf`);
      const badgeTypes = ['pioneer', 'team', 'dapplab', 'ambassador'];
      const badges: string[] = [];
      
      // Check each badge type
      await Promise.all(
        badgeTypes.map(async (badgeType) => {
          try {
            const hasBadge = await client.readContract({
              address: QNS_BADGE_REGISTRY_ADDRESS,
              abi: QNS_BADGE_REGISTRY_ABI,
              functionName: 'hasBadge',
              args: [nameHash, badgeType],
            }) as boolean;
            
            if (hasBadge) {
              badges.push(badgeType);
            }
          } catch {
            // Ignore errors for individual badge checks
          }
        })
      );
      
      set({
        badgeLookupResult: { nameHash, badges },
        isCheckingBadges: false,
      });
    } catch (err) {
      set({ badgeLookupResult: null, isCheckingBadges: false });
    }
  },
  
  assignBadge: async (name: string, badgeType: string, account: string) => {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('No wallet connected');
    
    const nameHash = namehash(`${name}.qf`);
    
    const result = await walletClient.writeContract({
      address: QNS_BADGE_REGISTRY_ADDRESS,
      abi: QNS_BADGE_REGISTRY_ABI,
      functionName: 'assignBadge',
      args: [nameHash, badgeType],
      account,
    });
    
    return result;
  },
  
  assignBadgeBatch: async (names: string[], badgeType: string, account: string) => {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('No wallet connected');
    
    const nameHashes = names.map(name => namehash(`${name}.qf`));
    
    const result = await walletClient.writeContract({
      address: QNS_BADGE_REGISTRY_ADDRESS,
      abi: QNS_BADGE_REGISTRY_ABI,
      functionName: 'assignBadgeBatch',
      args: [nameHashes, badgeType],
      account,
    });
    
    return result;
  },
  
  revokeBadge: async (name: string, badgeType: string, account: string) => {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('No wallet connected');
    
    const nameHash = namehash(`${name}.qf`);
    
    const result = await walletClient.writeContract({
      address: QNS_BADGE_REGISTRY_ADDRESS,
      abi: QNS_BADGE_REGISTRY_ABI,
      functionName: 'revokeBadge',
      args: [nameHash, badgeType],
      account,
    });
    
    return result;
  },
}));
