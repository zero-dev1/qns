// Simple API endpoint for profile data
// This should be deployed to your existing backend or as a serverless function
// Route: /api/profile/[name]

import { getRegistration, namehash, getPublicClient } from '../utils/qns';
import { QNS_RESOLVER_ADDRESS, QNS_RESOLVER_ABI } from '../config/contracts';

export default async function handler(req, res) {
  const { name } = req.query;
  
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Name parameter required' });
  }

  try {
    const normalizedName = name.toLowerCase().trim().replace(/\.qf$/, '');
    const client = getPublicClient();
    const node = namehash(`${normalizedName}.qf`);

    const registration = await getRegistration(normalizedName);

    if (!registration) {
      return res.status(404).json({ error: 'Name not found' });
    }

    const now = BigInt(Math.floor(Date.now() / 1000));
    const isPermanent = registration.expires === 0n;
    const isExpired = !isPermanent && registration.expires < now;

    if (isExpired) {
      return res.status(404).json({ error: 'Name expired' });
    }

    const [addressRes, avatarRes, bioRes, twitterRes, telegramRes] = await Promise.all([
      client.readContract({ address: QNS_RESOLVER_ADDRESS, abi: QNS_RESOLVER_ABI, functionName: 'addr', args: [node] }).catch(() => ''),
      client.readContract({ address: QNS_RESOLVER_ADDRESS, abi: QNS_RESOLVER_ABI, functionName: 'text', args: [node, 'avatar'] }).catch(() => ''),
      client.readContract({ address: QNS_RESOLVER_ADDRESS, abi: QNS_RESOLVER_ABI, functionName: 'text', args: [node, 'bio'] }).catch(() => ''),
      client.readContract({ address: QNS_RESOLVER_ADDRESS, abi: QNS_RESOLVER_ABI, functionName: 'text', args: [node, 'twitter'] }).catch(() => ''),
      client.readContract({ address: QNS_RESOLVER_ADDRESS, abi: QNS_RESOLVER_ABI, functionName: 'text', args: [node, 'telegram'] }).catch(() => ''),
    ]);

    const profile = {
      name: normalizedName,
      address: addressRes === '0x0000000000000000000000000000000000000000' ? registration.owner : addressRes,
      avatar: avatarRes || null,
      bio: bioRes || null,
      twitter: twitterRes || null,
      telegram: telegramRes || null,
      expires: registration.expires,
      registeredAt: registration.registeredAt,
      isPermanent,
      exists: true,
    };

    // Cache for 5 minutes
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    return res.status(200).json(profile);
  } catch (error) {
    console.error('Profile API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
