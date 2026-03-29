import { callContract } from './contractCall';
import { QNS_BADGE_REGISTRY_ADDRESS, QNS_BADGE_REGISTRY_ABI } from '../config/contracts';

export const TEAM_NAMES = ['ben', 'nils', 'alex', 'denis', 'alisher', 'krzysztof', 'aleksandra', 'lygin'];
export const DAPP_LAB_NAMES = ['axe', 'doomly', 'key', 'vector', 'boolean', 'user', 'hwmedia', 'sam', '888', 'ryan', 'diskword', 'hayk'];

export const BADGE_TYPES = {
  pioneer: {
    label: 'Pioneer',
    color: '#FFD700',       // Gold
    bgOpacity: '10',
    borderOpacity: '20',
  },
  team: {
    label: 'Team',
    color: '#DADADA',
    bgOpacity: '10',
    borderOpacity: '20',
  },
  dapplab: {
    label: 'dApp Lab',
    color: '#00EFE7',       // Cyan
    bgOpacity: '10',
    borderOpacity: '20',
  },
  ambassador: {
    label: 'Ambassador',
    color: '#FF6B35',       // Placeholder — TBD
    bgOpacity: '10',
    borderOpacity: '20',
  },
} as const;

export type BadgeType = keyof typeof BADGE_TYPES;

export async function fetchOnChainBadges(nameHash: string): Promise<BadgeType[]> {
  try {
    const hasPioneer = await callContract(
      QNS_BADGE_REGISTRY_ADDRESS,
      [...QNS_BADGE_REGISTRY_ABI],
      'hasBadge',
      [nameHash, 'pioneer']
    );

    const badges: BadgeType[] = [];
    if (hasPioneer) {
      badges.push('pioneer');
    }
    
    return badges;
  } catch (error) {
    // Return empty array if contract not deployed yet, network down, etc.
    return [];
  }
}

export async function getBadgesForName(name: string, nameHash: string): Promise<BadgeType[]> {
  const badges: BadgeType[] = [];
  
  // Get on-chain badges
  const onChainBadges = await fetchOnChainBadges(nameHash);
  badges.push(...onChainBadges);
  
  // Check frontend fallback badges
  const lowerName = name.toLowerCase();
  if (TEAM_NAMES.includes(lowerName)) {
    badges.push('team');
  }
  if (DAPP_LAB_NAMES.includes(lowerName)) {
    badges.push('dapplab');
  }
  
  // Return deduplicated array
  return Array.from(new Set(badges));
}
