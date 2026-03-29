// src/utils/badges.ts
import { callContract } from './contractCall';
import { QNS_BADGE_REGISTRY_ADDRESS, QNS_BADGE_REGISTRY_ABI } from '../config/contracts';

// Frontend fallback lists — used only when chain is unreachable
export const TEAM_NAMES = ['ben', 'nils', 'alex', 'denis', 'alisher', 'krzysztof', 'aleksandra', 'lygin'];
export const DAPP_LAB_NAMES = ['axe', 'doomly', 'key', 'vector', 'boolean', 'user', 'hwmedia', 'sam', '888', 'ryan', 'diskword', 'hayk'];

export const BADGE_TYPES = {
  pioneer: {
    label: 'Pioneer',
    color: '#FFD700',
    icon: 'crown',       // Crown — "you were first"
    shimmer: true,        // gets the gold shimmer treatment
  },
  team: {
    label: 'Team',
    color: '#DADADA',
    icon: 'shield',       // Shield — trusted core
  },
  dapplab: {
    label: 'dApp Lab',
    color: '#00EFE7',
    icon: 'flask',        // FlaskConical — builders/lab
  },
  ambassador: {
    label: 'Ambassador',
    color: '#FF6B35',
    icon: 'megaphone',    // Megaphone — voice/advocate
  },
} as const;

export type BadgeType = keyof typeof BADGE_TYPES;

/**
 * Read all badge types from chain for a given nameHash.
 * Each type is checked independently so one failure doesn't block the rest.
 */
export async function fetchOnChainBadges(nameHash: string): Promise<BadgeType[]> {
  const badges: BadgeType[] = [];
  const types: BadgeType[] = ['pioneer', 'team', 'dapplab', 'ambassador'];

  try {
    const results = await Promise.all(
      types.map(type =>
        callContract(
          QNS_BADGE_REGISTRY_ADDRESS,
          [...QNS_BADGE_REGISTRY_ABI],
          'hasBadge',
          [nameHash, type]
        ).catch(() => false)
      )
    );

    types.forEach((type, i) => {
      if (results[i]) badges.push(type);
    });

    return badges;
  } catch {
    // Chain completely unreachable — return empty, caller will use fallback
    return [];
  }
}

/**
 * Get badges for a name. On-chain is the source of truth.
 * Frontend lists are fallback only when chain returns nothing
 * (covers chain-unreachable scenario so team/dapplab still show).
 */
export async function getBadgesForName(name: string, nameHash: string): Promise<BadgeType[]> {
  // Try on-chain first — reads all four badge types
  const onChainBadges = await fetchOnChainBadges(nameHash);

  // If chain returned any badges, trust it as source of truth
  if (onChainBadges.length > 0) {
    return onChainBadges;
  }

  // Chain returned nothing — could be genuinely no badges, or chain unreachable.
  // Fall back to frontend lists so team/dapplab members still see their badges
  // even if the registry is temporarily unreachable.
  const badges: BadgeType[] = [];
  const lowerName = name.toLowerCase();
  if (TEAM_NAMES.includes(lowerName)) badges.push('team');
  if (DAPP_LAB_NAMES.includes(lowerName)) badges.push('dapplab');

  return badges;
}
