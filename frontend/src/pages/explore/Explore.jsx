import './Explore.css';
import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpace } from '../../context/spaceContext';
import SpaceCard from '../../components/explore/SpaceCard';
import SpaceAnalytics from '../../components/explore/SpaceAnalytics';
import Navbar from '../../components/layout/Navbar';
import { RefreshCw, ChevronRight, Plus, Database } from 'lucide-react';

export default function Explore() {
  const { spaces, loadingSpaces, refetchSpaces, selectedColor } = useSpace();
  const scrollRef = useRef(null);
  const navigate = useNavigate();

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 320, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen font-sans text-white flex flex-col" style={{ background: '#0d1117' }}>
      <Navbar />

      <main className="flex-1 flex flex-col px-6 py-8 gap-8">

        {/* Header Row */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white tracking-tight">Your Spaces</h1>
          <button
            onClick={refetchSpaces}
            disabled={loadingSpaces}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-cyan-400 border border-gray-800 hover:border-cyan-800 px-3 py-1.5 rounded-md transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingSpaces ? 'animate-spin' : ''}`} />
            Refresh Stats
          </button>
        </div>

        {/* Cards + Arrow Row */}
        {loadingSpaces ? (
          <div className="text-gray-500 text-sm animate-pulse">Loading your spaces...</div>
        ) : (
          <div className="flex items-stretch gap-3">
            <div
              ref={scrollRef}
              className="flex gap-4 overflow-x-auto flex-1"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {spaces.map((space, index) => (
                <SpaceCard key={space.id} space={space} index={index} />
              ))}
            </div>
            <button
              onClick={scrollRight}
              className="shrink-0 self-center w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 transition-all"
              style={{ background: '#161b22' }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Bottom Section: Action Buttons + Analytics — full width row */}
        <div className="flex gap-4 w-full">

          {/* Left: Action Buttons */}
          <div className="flex flex-col gap-3 w-48 shrink-0">
            <button
              onClick={() => navigate('/workspace')}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold text-sm text-slate-900 transition-opacity hover:opacity-90"
              style={{ background: selectedColor?.btn || '#22d3ee' }}
            >
              <Plus className="w-4 h-4" />
              New Query
            </button>
            <button
              onClick={() => navigate('/schema-draft')}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium text-sm text-gray-300 border border-white/10 hover:border-white/20 transition-all"
              style={{ background: '#161b22' }}
            >
              <Database className="w-4 h-4" style={{ color: selectedColor?.hex || '#22d3ee' }} />
              Browse Datasets
            </button>
          </div>

          {/* Right: Analytics Panel — flex-1 fills remaining width */}
          <div className="flex-1">
            <SpaceAnalytics />
          </div>

        </div>

      </main>
    </div>
  );
}
