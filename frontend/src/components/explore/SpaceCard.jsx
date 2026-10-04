import './SpaceCard.css';
import { useSpace, SPACE_COLORS } from '../../context/spaceContext';
import { useNavigate } from 'react-router-dom';

export default function SpaceCard({ space, index }) {
  const { selectedSpace, selectSpace } = useSpace();
  const navigate = useNavigate();
  const isActive = selectedSpace === space.id;
  const color = SPACE_COLORS[index % SPACE_COLORS.length];

  return (
    <div
      onClick={() => selectSpace(space.id, index)}
      // flex-none prevents shrinking, w is set so 3 cards + half of 4th are visible
      // min-h ensures card is tall enough
      className={`relative p-5 rounded-xl cursor-pointer transition-all duration-200 flex flex-col gap-6 flex-none overflow-hidden
        ${isActive ? `border-2 ${color.border} ${color.glow}` : 'border border-white/5 hover:border-white/10'}`}
      style={{
        background: isActive ? color.cardBgActive : color.cardBg,
        width: 'calc((100vw - 180px) / 3.4)', // 3 full cards + 4th peeking
        minHeight: '220px',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: color.hex, boxShadow: `0 0 6px ${color.hex}` }}
        />
        <h3 className="font-bold text-base text-white">{space.name}</h3>
      </div>

      {/* Stats — spaced out vertically for taller feel */}
      <div className="flex flex-col gap-4 flex-1 justify-center">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-400 font-medium">Nodes</span>
          <span className="font-mono font-bold text-white">{space.nodes}</span>
        </div>
        <div className="h-px w-full bg-white/5" />
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-400 font-medium">Edges</span>
          <span className="font-mono font-bold text-white">{space.edges}</span>
        </div>
      </div>

      {/* Button */}
      <button
        onClick={(e) => {
          e.stopPropagation(); // prevent clicking the card and selecting it (or allow it, but we navigate anyway)
          navigate(`/schema-draft?space=${space.id}`);
        }}
        className="w-full py-3 rounded-lg font-bold text-sm text-slate-900 transition-opacity hover:opacity-90 mt-auto"
        style={{ background: color.btn }}
      >
        Open Schema
      </button>
    </div>
  );
}
