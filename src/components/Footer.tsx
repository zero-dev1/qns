import { useWalletStore } from '../stores/walletStore';
import { useAdminStore } from '../stores/adminStore';
import { Link } from 'react-router-dom';

const links = [
  { label: 'QF Network', href: 'https://quantumfusion.network' },
  { label: 'QFLink', href: 'https://qflink.io' },
  { label: 'QFClash', href: 'https://qfclash.io' },
  { label: 'Docs', href: '#' },
  { label: 'Twitter', href: '#' },
  { label: 'Discord', href: '#' },
];

export default function Footer() {
  const { address } = useWalletStore();
  const { adminAddress } = useAdminStore();
  
  const isAdmin = address && adminAddress && address.toLowerCase() === adminAddress.toLowerCase();

  return (
    <footer className="border-t border-[#1E1E1E] mt-10">
      <div className="max-w-[1120px] mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="font-clash font-semibold text-lg text-white">
              QNS<span className="text-[#00D179]">.</span>
            </span>
            <span className="text-sm text-[#555555]">
              The identity layer for Quantum Fusion
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#8A8A8A] hover:text-white transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                className="text-sm text-[#8A8A8A] hover:text-white transition-colors duration-200"
              >
                Admin
              </Link>
            )}
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-[#555555]">
          QNS is community-built infrastructure for the QF ecosystem.
        </p>
      </div>
    </footer>
  );
}
