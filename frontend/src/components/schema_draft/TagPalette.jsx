import { TAG_COLORS } from './d3CanvasHelpers';

/**
 * Bottom colour palette — click a colour dot to add a new Tag node to the canvas.
 */
export default function TagPalette({ onAddNode }) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 bg-[#1a2035] border border-white/10 shadow-2xl rounded-full px-6 py-3 flex items-center gap-4">
      <span className="text-gray-400 font-bold text-[10px] uppercase tracking-widest select-none">
        + Tag
      </span>

      {TAG_COLORS.map((color) => (
        <button
          key={color}
          onClick={() => onAddNode(color)}
          title={`Add tag node (${color})`}
          className="w-7 h-7 rounded-full border-2 hover:scale-125 transition-transform"
          style={{ backgroundColor: color + '25', borderColor: color }}
        />
      ))}
    </div>
  );
}
