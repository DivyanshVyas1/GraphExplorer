import './Navbar.css';
import { Search, Settings, Network } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const NAV_LINKS = [
  { label: 'Explore', path: '/explore' },
  { label: 'Workspace', path: '/workspace' },
  { label: 'Datasets', path: '/datasets' },
  { label: 'Schema Draft', path: '/schema-draft' },
];

export default function Navbar() {
  const { pathname } = useLocation();

  return (
    <nav className="flex items-center justify-between px-6 py-3 border-b border-white/5 shrink-0" style={{ background: '#0d1117' }}>
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2 text-cyan-400 font-bold text-lg">
          <Network className="w-5 h-5" />
          <span>Graph Explorer</span>
        </div>

        <div className="flex items-center gap-1">
          {NAV_LINKS.map(({ label, path }) => (
            <Link
              key={path}
              to={path}
              className={`px-3 py-1.5 text-sm font-medium transition-colors rounded-none
                ${pathname === path
                  ? 'text-white border-b-2 border-cyan-400'
                  : 'text-gray-400 hover:text-white'}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Quick search graphs..."
            className="bg-[#161b22] text-sm text-white placeholder-gray-500 rounded-md pl-9 pr-4 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500 w-56 border border-white/5"
          />
        </div>
        <button className="text-gray-500 hover:text-white transition-colors">
          <Settings className="w-5 h-5" />
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
          JD
        </div>
      </div>
    </nav>
  );
}
