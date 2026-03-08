import { useState, useEffect } from 'react';
import { useWalletStore } from '../../stores/walletStore';
import { useAdminStore, type AdminSection } from '../../stores/adminStore';
import AdminNavbar from './AdminNavbar';
import Overview from './Overview';
import ReserveNames from './ReserveNames';
import Registrations from './Registrations';
import Pricing from './Pricing';
import Treasury from './Treasury';
import Settings from './Settings';
import {
  LayoutDashboard,
  Bookmark,
  Search,
  DollarSign,
  Wallet,
  Settings as SettingsIcon,
  Menu,
  X,
} from 'lucide-react';

interface NavItem {
  id: AdminSection;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'reserve', label: 'Reserve Names', icon: Bookmark },
  { id: 'registrations', label: 'Registrations', icon: Search },
  { id: 'pricing', label: 'Pricing', icon: DollarSign },
  { id: 'treasury', label: 'Treasury', icon: Wallet },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function AdminLayout() {
  const { address } = useWalletStore();
  const { adminAddress, isCheckingAdmin, checkAdmin, currentSection, setCurrentSection } = useAdminStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Check admin status on mount and when address changes
  useEffect(() => {
    if (address) {
      checkAdmin(address);
    }
  }, [address, checkAdmin]);

  // Close sidebar when section changes on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [currentSection]);

  // Not connected state
  if (!address) {
    return (
      <div className="min-h-screen bg-[#0A0A0A]">
        <AdminNavbar />
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-6">
          <div className="text-center">
            <h1 className="font-clash text-2xl font-semibold text-white mb-4">
              Connect Your Wallet
            </h1>
            <p className="text-[#8A8A8A] mb-8 max-w-md">
              Please connect your wallet to access the QNS Admin Dashboard.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Checking admin state
  if (isCheckingAdmin) {
    return (
      <div className="min-h-screen bg-[#0A0A0A]">
        <AdminNavbar />
        <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00D179]"></div>
        </div>
      </div>
    );
  }

  // Not authorized state
  if (adminAddress && address.toLowerCase() !== adminAddress.toLowerCase()) {
    return (
      <div className="min-h-screen bg-[#0A0A0A]">
        <AdminNavbar />
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-6">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-full bg-[#E5484D]/10 flex items-center justify-center mx-auto mb-6">
              <X size={32} className="text-[#E5484D]" />
            </div>
            <h1 className="font-clash text-2xl font-semibold text-white mb-4">
              Not Authorized
            </h1>
            <p className="text-[#8A8A8A]">
              This dashboard is restricted to the QNS admin. Your connected wallet does not have admin privileges.
            </p>
            <code className="block mt-4 px-3 py-2 bg-[#141414] rounded-lg text-[#8A8A8A] font-mono text-sm">
              Admin: {adminAddress}
            </code>
          </div>
        </div>
      </div>
    );
  }

  // Admin dashboard
  const renderSection = () => {
    switch (currentSection) {
      case 'overview':
        return <Overview />;
      case 'reserve':
        return <ReserveNames />;
      case 'registrations':
        return <Registrations />;
      case 'pricing':
        return <Pricing />;
      case 'treasury':
        return <Treasury />;
      case 'settings':
        return <Settings />;
      default:
        return <Overview />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <AdminNavbar />
      
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-16 left-0 right-0 z-40 bg-[#0A0A0A] border-b border-[#1E1E1E] px-4 py-3 flex items-center justify-between">
        <span className="font-clash font-medium text-white capitalize">
          {currentSection}
        </span>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 text-[#8A8A8A] hover:text-white transition-colors"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <div className="pt-16 lg:pt-16 flex">
        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-16 lg:top-16 left-0 z-30 h-[calc(100vh-64px)] w-[240px] bg-[#0A0A0A] border-r border-[#1E1E1E] transition-transform duration-200 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentSection === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentSection(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 ${
                    isActive
                      ? 'bg-[#00D179]/10 text-[#00D179] border border-[#00D179]/30'
                      : 'text-[#8A8A8A] hover:bg-[#141414] hover:text-white'
                  }`}
                >
                  <Icon size={18} />
                  <span className="font-medium text-sm">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 min-h-[calc(100vh-64px)] lg:ml-0 mt-12 lg:mt-0">
          <div className="p-6 lg:p-8 max-w-6xl">
            {renderSection()}
          </div>
        </main>
      </div>
    </div>
  );
}
