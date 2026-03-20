import { create } from 'zustand';
import { getPublicClient, getWalletClient, namehash, labelHash } from '../utils/qns';
import {
  QNS_REGISTRY_ADDRESS,
  QNS_REGISTRY_ABI,
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
  
  // Actions
  checkAdmin: (userAddress: Address) => Promise<void>;
  setCurrentSection: (section: AdminSection) => void;
  
  // Overview actions
  loadOverviewData: () => Promise<void>;
  
  // Reserve names actions
  loadReservedNames: () => Promise<void>;
  loadAssignedStatus: () => Promise<void>;
  reserveName: (name: string, account: string) => Promise<`0x${string}`>;
  unreserveName: (name: string, account: string) => Promise<`0x${string}`>;
  assignReservedName: (name: string, to: Address, account: string) => Promise<`0x${string}`>;
  
  // Registration lookup
  setLookupName: (name: string) => void;
  lookupRegistration: (name: string) => Promise<void>;
  
  // Pricing actions
  updatePrices: (prices: { char3: bigint; char4: bigint; char5Plus: bigint }, account: string) => Promise<`0x${string}`>;
  updatePermanentMultiplier: (multiplier: bigint, account: string) => Promise<`0x${string}`>;
  updateBurnPercent: (percent: bigint, account: string) => Promise<`0x${string}`>;
  
  // Treasury actions
  withdrawToTreasury: (account: string) => Promise<`0x${string}`>;
  
  // Settings actions
  transferAdmin: (newAdmin: Address, account: string) => Promise<`0x${string}`>;
  setTreasury: (newTreasury: Address, account: string) => Promise<`0x${string}`>;
  setBurnAddress: (newBurn: Address, account: string) => Promise<`0x${string}`>;
  setDefaultResolver: (newResolver: Address, account: string) => Promise<`0x${string}`>;
}

// Static list of reserved names from deploy script
const RESERVED_NAMES_LIST = [
  'aave','about','abu','adam','admin','africa','ahmed','airdrop','aisha','alaoui','alchemist','alex','ali','alice','alpha','altcoingordon','altcoinsensei','altstein','amazon','amm','analyst','anna','ansem','anthony','api','app','apple','ariff','arthurhays','artist','asia','australia','avalanche','avatar','axe','axeledger','badge','bahrain','bear','becker','ben','binance','bio','bitboy','bitcoin','bitomoney','block','blog','bluntz','bob','borrow','brazil','brian','bridge','bull','bullishbear','burn','bybit','canada','cardano','careers','ceo','cex','chad','chadpumpiano','chain','chainlink','chancellor','china','chris','claim','cli','cobie','coin','coinbase','compound','congress','contact','contract','core','council','crayola','creator','crediblecrypto','crypto44','cryptobanter','cryptobirb','cryptocaesar','cryptofella','cryptogideon','cryptogodjohn','cryptomanic','cryptomanran','cryptomonk','cryptonova','cryptotony','cryptowizard','cryptoyoda','ctgymrat','cto','curve','dan','dao','dapp','dapplab','dappstore','david','defi','degen','degenkenn','degenpoet','demo','deploy','deployer','developer','dev','dex','dippy','discord','docs','dogecoin','donalt','drew','drprofit','druya','dtcrypto','dubai','dydx','ecosystem','egypt','eliz','ella','embassy','emily','emma','engineer','epoch','eric','ethereum','europe','exchange','explorer','ezmoney','farm','fatima','fattony','faucet','fee','fifa','follow','foundation','founder','france','fund','fusion','futures','gainzy','gamer','gateway','gemdetector','genesis','germany','gideon','goodie','google','goomba','gorgonite','governance','government','governor','grants','harvest','hassan','hawk','help','hodl','home','hongkong','hsaka','hub','hwmedia','identity','incubator','incomeshark','index','india','influencer','info','intrepid','inversebrah','investor','jack','james','jane','japan','jason','jobs','joe','john','jopp','jordan','justiinape','kaleo','karamata','kate','kenobi','kenya','kevin','kingdom','kito','korea','kraken','kucoin','kuwait','labs','lambo','larkdavis','laura','launchpad','lawless','layeralpha','ledger','lend','leo','leverage','lido','link','liquidity','lisa','london','lookonchain','lsd','luke','main','mainnet','maker','manage','margin','maria','mark','market','matt','matteo','mail','manifesto','max','mayor','media','meme','memechi','memecoin','meta','metamask','mexc','mexico','mezcez','mia','michael','microsoft','mike','minister','mint','mohammed','moneylord','moon','murad','musa','musician','name','nations','nebraskagooner','network','news','newyork','nft','nick','nils','nigeria','nilsb','nite','noach','noah','node','nucleus','nucleusx','octgems','official','olivia','olympic','oman','omar','opensea','options','oracle','panamax','paul','paw','pentoshi','pepe','perps','peter','phantom','polkadot','polygon','pool','portal','potus','president','press','privacy','profile','protocol','pump','qatar','qfclash','qflink','qfpad','qfnetwork','qfpay','qfstream','qfswap','qfvote','quantum','quantumfusion','quantumnotary','rabby','rachel','rainbow','raoul','reddit','register','registrar','registry','rektcapital','relay','renew','researcher','reserve','resolver','reverse','rewards','reward','ripple','rishad','root','roshi','royal','rush','russia','ryan','sam','sarah','satoshi','satoshiflipper','saudi','saylor','sdk','search','security','senate','settings','shard','shark','sharky','shiba','sigma','singapore','singularity','soef','solana','sophie','spot','stake','spin','staking','status','steve','streamer','support','swampmonkey','swap','sykodelic','tang','tareeq','team','teddy','telegram','terms','tesla','test','testnet','tiktok','token','tokyo','tom','trade','trader','treasury','trezor','turkey','twitter','uae','ukraine','uniswap','united','uponlygreg','usa','validator','vault','vector','verified','vest','vitalik','vote','wallet','watcherguru','web','web3princess','welcome','whale','yield','youtube','zhusu'
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
        reservedNamesCount: 387,
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
    }
  },
  
  // Load reserved names
  loadReservedNames: async () => {
    set({ isLoadingReserved: true, reservedNames: [...new Set(RESERVED_NAMES_LIST)], reservedNamesCount: [...new Set(RESERVED_NAMES_LIST)].length });
    set({ isLoadingReserved: false });
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
  unreserveName: async (name: string, account: string) => {
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
  assignReservedName: async (name: string, to: Address, account: string) => {
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
  
  updatePermanentMultiplier: async (multiplier: bigint, account: string) => {
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
  
  updateBurnPercent: async (percent: bigint, account: string) => {
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
  withdrawToTreasury: async (account: string) => {
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
  transferAdmin: async (newAdmin: Address, account: string) => {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('No wallet connected');
    
    const hash = await walletClient.writeContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'setAdmin',
      args: [newAdmin],
      account,
    });
    
    // Note: checkAdmin expects EVM address format - skipped here as account may be SS58
    return hash;
  },
  
  setTreasury: async (newTreasury: Address, account: string) => {
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
  
  setBurnAddress: async (newBurn: Address, account: string) => {
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
  
  setDefaultResolver: async (newResolver: Address, account: string) => {
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
