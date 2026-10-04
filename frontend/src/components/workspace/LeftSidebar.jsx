import { useWorkspace } from '../../context/workspaceContext';
import { ChevronDown, Check, HelpCircle, LifeBuoy } from 'lucide-react';
import { useState } from 'react';

export default function LeftSidebar({ width = 240 }) {
  const { spaces, selectedSpace, handleSpaceSelect, tags, toggleTag, edgeTypes, toggleEdgeType } = useWorkspace();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <aside className="flex flex-col h-full border-r border-white/5 bg-[#0d1117] shrink-0 overflow-hidden" style={{ width }}>

      {/* Space Dropdown */}
      <div className="p-4 border-b border-white/5">
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(p => !p)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-white/10 bg-[#161b22] text-sm text-white hover:border-white/20 transition-all"
          >
            <span className="truncate">{selectedSpace || 'Select space...'}</span>
            <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full mt-1 w-full bg-[#161b22] border border-white/10 rounded-lg overflow-hidden z-50 shadow-xl">
              {spaces.map(s => (
                <button
                  key={s.id}
                  onClick={() => { handleSpaceSelect(s.name || s.id); setDropdownOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition-colors flex items-center justify-between
                    ${selectedSpace === (s.name || s.id) ? 'text-cyan-400' : 'text-gray-300'}`}
                >
                  {s.name || s.id}
                  {selectedSpace === (s.name || s.id) && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-6 scrollbar-hide">
        {/* Tags */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold text-gray-400 tracking-[0.2em] px-1 uppercase">Tags</h3>
          <div className="space-y-1">
            {tags.map((tag) => (
              <label
                key={tag.name}
                className="flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-sm font-semibold text-gray-200 capitalize">{tag.name}</span>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={tag.visible}
                    onChange={() => toggleTag(tag.name)}
                    className="peer sr-only"
                  />
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all duration-200 
                    ${tag.visible ? 'bg-cyan-500 border-cyan-500' : 'border-gray-600 bg-transparent group-hover:border-gray-400'}`}
                  >
                    {tag.visible && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Relationships */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold text-gray-400 tracking-[0.2em] px-1 uppercase">Relationships</h3>
          <div className="space-y-1">
            {edgeTypes.map((edge) => (
              <label
                key={edge.name}
                className="flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-white/5 transition-colors group"
              >
                <div className="bg-[#1f2937] px-2 py-1 rounded border border-white/5">
                  <span className="text-xs font-bold text-gray-300 uppercase tracking-wide">{edge.name}</span>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={edge.visible}
                    onChange={() => toggleEdgeType(edge.name)}
                    className="peer sr-only"
                  />
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all duration-200
                    ${edge.visible ? 'bg-cyan-500 border-cyan-500' : 'border-gray-600 bg-transparent group-hover:border-gray-400'}`}
                  >
                    {edge.visible && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
        {!selectedSpace && (
          <p className="text-xs text-gray-600 text-center mt-4">Select a space to see schema</p>
        )}

      {/* Bottom */}
      <div className="py-3 px-4 border-t border-white/5 flex items-center justify-center gap-[68px] bg-[#0d1117] mt-auto">
        <button className="flex flex-col items-center gap-1 text-gray-500 hover:text-white transition-colors group">
          <div className="w-7 h-7 rounded-full border border-gray-600/50 flex items-center justify-center group-hover:border-gray-400 transition-colors">
            <HelpCircle className="w-3.5 h-3.5" />
          </div>
          <span className="text-[9px] font-medium tracking-wide">Docs</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-gray-500 hover:text-white transition-colors group">
          <div className="w-7 h-7 rounded-full border border-gray-600/50 flex items-center justify-center group-hover:border-gray-400 transition-colors">
            <LifeBuoy className="w-3.5 h-3.5" />
          </div>
          <span className="text-[9px] font-medium tracking-wide">Support</span>
        </button>
      </div>
    </aside>
  );
}
