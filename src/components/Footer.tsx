import { Link } from 'react-router-dom';
import { useWalletStore } from '../stores/walletStore';
import { useAdminStore } from '../stores/adminStore';

const productLinks = [
  { label: 'My Names', to: '/my-names', internal: true },
  { label: 'Docs', to: '/docs', internal: true },
];

const communityLinks = [
  { label: 'Twitter / X', href: 'https://x.com/dotqfns' },
  { label: 'QF Network', href: 'https://x.com/theqfnetwork' },
];

export default function Footer() {
  const { address } = useWalletStore();
  const { adminAddress } = useAdminStore();
  const isAdmin = address && adminAddress && address.toLowerCase() === adminAddress.toLowerCase();

  return (
    <footer className="border-t border-white/[0.04] mt-10">
      <div className="max-w-[1120px] mx-auto px-6 py-14">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-3">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <span className="font-clash font-semibold text-xl text-white">
              QNS<span className="text-[#00D179]">.</span>
            </span>
            <p className="mt-3 text-sm text-[#444] leading-relaxed max-w-[220px]">
              The identity layer for QF Network. Register once, carry it everywhere.
            </p>
          </div>

          {/* Product */}
          <div>
            <p className="text-[11px] font-medium tracking-[0.15em] text-[#555] uppercase mb-4">Product</p>
            <div className="flex flex-col gap-2.5">
              {productLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  className="text-sm text-[#666] hover:text-white transition-colors duration-200"
                >
                  {link.label}
                </Link>
              ))}
              {isAdmin && (
                <Link to="/admin" className="text-sm text-[#666] hover:text-white transition-colors duration-200">
                  Admin
                </Link>
              )}
            </div>
          </div>

          {/* Community */}
          <div>
            <p className="text-[11px] font-medium tracking-[0.15em] text-[#555] uppercase mb-4">Community</p>
            <div className="flex flex-col gap-2.5">
              {communityLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#666] hover:text-white transition-colors duration-200"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-white/[0.04] flex items-center justify-center">
          <p className="text-xs text-[#333]">
            Community built infrastructure for QF Network · Dapp Labs · {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  );
}
