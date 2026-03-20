import { useWalletStore } from '../stores/walletStore';

export default function UnmappedBanner() {
  const { address, accountMapped, disconnect } = useWalletStore();

  if (!address || accountMapped) return null;

  return (
    <div className="w-full bg-[#F5A623]/10 border-b border-[#F5A623]/30 px-4 py-3 text-center text-sm text-[#F5A623]">
      Your account is not mapped to an EVM address. You can browse, but registrations and
      profile edits will fail.{' '}
      <button
        onClick={disconnect}
        className="underline hover:text-white transition-colors cursor-pointer"
      >
        Reconnect
      </button>{' '}
      and approve the mapping transaction to enable writes.
    </div>
  );
}
