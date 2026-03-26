import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, User, FileText, Settings, ArrowRight, Loader2 } from 'lucide-react';
import { useWalletStore } from '../stores/walletStore';
import { useCommandPaletteStore } from '../stores/commandPaletteStore';
import { validateNameLocal, checkAvailability } from '../utils/qns';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: 'navigation' | 'action' | 'search';
}

export default function CommandPalette() {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResult, setSearchResult] = useState<{ name: string; available: boolean } | null>(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();
  const { address, connect, qnsName } = useWalletStore();
  const { isOpen: open, toggle, close: closePalette } = useCommandPaletteStore();

  // Keyboard shortcut to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
      if (e.key === 'Escape' && open) {
        closePalette();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, toggle, closePalette]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setSearchResult(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Search for .qf name availability when query looks like a name
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    const cleanName = query.toLowerCase().replace(/\.qf$/, '').trim();
    if (!cleanName || cleanName.length < 3) {
      setSearchResult(null);
      setSearching(false);
      return;
    }

    const validation = validateNameLocal(cleanName);
    if (!validation.valid) {
      setSearchResult(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const available = await checkAvailability(cleanName);
        setSearchResult({ name: cleanName, available });
      } catch {
        setSearchResult(null);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const close = useCallback(() => {
    closePalette();
    setQuery('');
  }, [closePalette]);

  // Build items list
  const items: CommandItem[] = [];

  // Search result item (if applicable)
  if (searchResult) {
    if (searchResult.available) {
      items.push({
        id: 'search-available',
        label: `${searchResult.name}.qf`,
        description: 'Available — register this name',
        icon: <span className="text-[#00D179]">✓</span>,
        action: () => {
          close();
          navigate(`/?search=${encodeURIComponent(searchResult.name)}`);
        },
        category: 'search',
      });
    } else {
      items.push({
        id: 'search-taken',
        label: `${searchResult.name}.qf`,
        description: 'Taken — view profile',
        icon: <User size={16} />,
        action: () => {
          close();
          navigate(`/name/${searchResult.name}`);
        },
        category: 'search',
      });
    }
  }

  // Navigation items
  const navItems: CommandItem[] = [
    {
      id: 'home',
      label: 'Home',
      description: 'Search and register names',
      icon: <Search size={16} />,
      action: () => { close(); navigate('/'); },
      category: 'navigation',
    },
    {
      id: 'my-names',
      label: 'My Names',
      description: 'Manage your .qf names',
      icon: <User size={16} />,
      action: () => { close(); navigate('/my-names'); },
      category: 'navigation',
    },
    {
      id: 'docs',
      label: 'Documentation',
      description: 'Developer integration guides',
      icon: <FileText size={16} />,
      action: () => { close(); navigate('/docs'); },
      category: 'navigation',
    },
  ];

  // Action items
  const actionItems: CommandItem[] = [];
  if (!address) {
    actionItems.push({
      id: 'connect',
      label: 'Connect Wallet',
      description: 'Connect Talisman or SubWallet',
      icon: <Settings size={16} />,
      action: () => { close(); connect(); },
      category: 'action',
    });
  }
  if (qnsName) {
    actionItems.push({
      id: 'my-profile',
      label: `View ${qnsName}.qf`,
      description: 'Open your profile page',
      icon: <User size={16} />,
      action: () => { close(); navigate(`/name/${qnsName}`); },
      category: 'action',
    });
  }

  // Filter nav and action items by query
  const filtered = [...navItems, ...actionItems].filter((item) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return item.label.toLowerCase().includes(q) || (item.description || '').toLowerCase().includes(q);
  });

  const allItems = [...items, ...filtered];

  // Clamp selected index
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, allItems.length]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && allItems[selectedIndex]) {
      e.preventDefault();
      allItems[selectedIndex].action();
    }
  };

  return (
    <>
      {/* Keyboard hint in navbar — add this to Navbar.tsx separately (see instructions below) */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />

            {/* Palette */}
            <motion.div
              className="relative w-full max-w-[520px] rounded-2xl border border-white/[0.08] bg-[#111] shadow-2xl shadow-black/50 overflow-hidden"
              initial={{ opacity: 0, scale: 0.96, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              {/* Input */}
              <div className="flex items-center gap-3 px-4 border-b border-white/[0.06]">
                <Search size={18} className="text-[#444] shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search names, navigate, or run commands..."
                  className="flex-1 bg-transparent py-4 text-sm text-white outline-none placeholder:text-[#333]"
                />
                {searching && <Loader2 size={16} className="text-[#00D179] animate-spin shrink-0" />}
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] text-[#444] bg-white/[0.04] border border-white/[0.06]">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-[300px] overflow-y-auto py-2">
                {allItems.length === 0 && !searching && (
                  <p className="text-center text-sm text-[#444] py-8">No results</p>
                )}

                {allItems.map((item, i) => (
                  <button
                    key={item.id}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100 cursor-pointer ${
                      i === selectedIndex ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
                    }`}
                    onClick={item.action}
                    onMouseEnter={() => setSelectedIndex(i)}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.03] text-[#555] shrink-0">
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{item.label}</p>
                      {item.description && (
                        <p className="text-[11px] text-[#444] truncate">{item.description}</p>
                      )}
                    </div>
                    <ArrowRight size={14} className="text-[#333] shrink-0" />
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
