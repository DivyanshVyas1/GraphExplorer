import { Save, UploadCloud } from 'lucide-react';
import { useDraft } from '../../context/draftContext';

/**
 * Top bar with draft name input + Save Draft / Apply to Space buttons.
 * Also shows a small hint about how to use the canvas.
 */
export default function CanvasToolbar({ onSave, onApply }) {
  const { activeDraft, setActiveDraft } = useDraft();

  return (
    <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-center pointer-events-none">
      {/* Draft name */}
      <input
        className="bg-[#161b22] border border-white/10 rounded px-3 py-1.5 text-base font-bold text-gray-200 focus:outline-none focus:border-cyan-500 pointer-events-auto w-64"
        value={activeDraft?.name || ''}
        onChange={(e) => setActiveDraft({ ...activeDraft, name: e.target.value })}
      />

      {/* Actions */}
      <div className="flex items-center gap-3 pointer-events-auto">
        {/* Hint badge */}
        <div className="bg-[#0d1117]/70 border border-white/10 rounded px-3 py-1.5 text-[11px] text-gray-500 flex items-center gap-2 select-none">
          <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
          Click port → draw edge &nbsp;|&nbsp; Del to delete
        </div>

        <button
          onClick={onSave}
          className="flex items-center gap-2 px-4 py-2 bg-[#161b22] border border-white/10 hover:bg-white/5 rounded text-sm text-gray-300 font-semibold transition-colors"
        >
          <Save className="w-4 h-4" /> Save Draft
        </button>

        <button
          onClick={onApply}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-bold transition-colors"
        >
          <UploadCloud className="w-4 h-4" /> Apply to Space
        </button>
      </div>
    </div>
  );
}
