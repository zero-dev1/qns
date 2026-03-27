import { defineChain } from 'viem';

export const qfNetwork = defineChain({
  id: 3426,
  name: 'QF Network',
  nativeCurrency: {
    name: 'QF',
    symbol: 'QF',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://archive.mainnet.qfnode.net/eth'],
    },
  },
  blockExplorers: {
    default: {
      name: 'QF Explorer',
      url: 'https://portal.qfnetwork.xyz/?rpc=wss%3A%2F%2Fmainnet.qfnode.net#/explorer',
    },
  },
});
