import { useDraft } from '../../context/draftContext';
import { X, Play, Copy, Check, Tag, GitBranch, Trash2, Database } from 'lucide-react';
import { useState } from 'react';

/**
 * nGQL Preview Modal — shows before Apply to Space executes.
 * Displays each generated DDL query with kind badge, syntax highlighting,
 * and for EDGE queries — a connectivity diagram (srcTag ──[edge]──▶ tgtTag).
 */
export default function NgqlPreviewModal() {
  const { pendingApply, confirmApplyToSpace, cancelApplyToSpace, isLoading } = useDraft();
  const [copied, setCopied] = useState(false);

  if (!pendingApply) return null;

  const { targetSpace, isNewSpace, queries } = pendingApply;
  const allQueriesText = queries.map(q => q.gql).join('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(allQueriesText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Syntax highlight a gql string
  const colorizeQuery = (gql) => {
    const keywords = ['CREATE', 'ALTER', 'DROP', 'ADD', 'USE', 'IF', 'NOT', 'EXISTS', 'TAG', 'EDGE', 'SPACE'];
    let result = gql;
    keywords.forEach(kw => {
      result = result.replace(
        new RegExp(`\\b${kw}\\b`, 'g'),
        `<span class="ngql-kw">${kw}</span>`
      );
    });
    result = result.replace(/`([^`]+)`/g, '<span class="ngql-id">`$1`</span>');
    result = result.replace(
      /\b(string|int64|int32|float|double|bool|timestamp|date|time|datetime)\b/g,
      '<span class="ngql-type">$1</span>'
    );
    return result;
  };

  // Badge config per kind
  const BADGE = {
    create_space: { label: 'SPACE',  color: '#a78bfa', Icon: Database  },
    create_tag:   { label: 'TAG',    color: '#22d3ee', Icon: Tag        },
    create_edge:  { label: 'EDGE',   color: '#34d399', Icon: GitBranch  },
    alter_tag:    { label: 'ALTER',  color: '#eab308', Icon: Tag        },
    alter_edge:   { label: 'ALTER',  color: '#eab308', Icon: GitBranch  },
    drop_tag:     { label: 'DROP',   color: '#f87171', Icon: Trash2     },
    drop_edge:    { label: 'DROP',   color: '#f87171', Icon: Trash2     },
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={cancelApplyToSpace}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-2xl rounded-xl border border-white/10 shadow-2xl flex flex-col"
          style={{ background: '#0d1117', maxHeight: '82vh' }}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
            <div>
              <h2 className="text-base font-bold text-white">nGQL Preview</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {queries.length} quer{queries.length === 1 ? 'y' : 'ies'} will be executed on{' '}
                <span className="text-cyan-400 font-mono">`{targetSpace}`</span>
                {isNewSpace && (
                  <span className="ml-2 text-[10px] font-bold bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded-full border border-green-500/20">
                    NEW SPACE
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={cancelApplyToSpace}
              className="text-gray-500 hover:text-white transition-colors p-1 rounded hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ── Query list ── */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5" style={{ scrollbarWidth: 'thin' }}>
            {queries.map((q, i) => {
              const badge = BADGE[q.kind] || BADGE.create_tag;
              const { Icon } = badge;
              const isEdge = q.kind === 'create_edge' || q.kind === 'alter_edge';
              const isDrop = q.kind === 'drop_tag' || q.kind === 'drop_edge';

              return (
                <div
                  key={i}
                  className="rounded-lg border overflow-hidden"
                  style={{
                    background: '#161b22',
                    borderColor: badge.color + '22',
                  }}
                >
                  {/* Query header bar */}
                  <div
                    className="flex items-center justify-between px-3 py-1.5 border-b"
                    style={{ borderColor: badge.color + '18', background: badge.color + '08' }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{
                          color: badge.color,
                          background: badge.color + '18',
                          border: `1px solid ${badge.color}30`,
                        }}
                      >
                        <Icon className="w-2.5 h-2.5" strokeWidth={2.5} />
                        {badge.label}
                      </span>
                      <span className="text-[10px] text-gray-600 font-mono">query {i + 1}</span>
                    </div>
                  </div>

                  {/* Query body */}
                  <div className="px-4 py-3">
                    <code
                      className="text-xs font-mono leading-relaxed break-all"
                      style={{ color: '#e2e8f0' }}
                      dangerouslySetInnerHTML={{ __html: colorizeQuery(q.gql) }}
                    />

                    {/* ── Edge connectivity diagram ── */}
                    {isEdge && q.meta?.srcLabel && q.meta?.tgtLabel && (
                      <div className="mt-3 flex items-center gap-2">
                        {/* Source node pill */}
                        <div
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{ background: '#22d3ee18', color: '#22d3ee', border: '1px solid #22d3ee30' }}
                        >
                          <Tag className="w-3 h-3" />
                          {q.meta.srcLabel}
                        </div>

                        {/* Arrow with edge label */}
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          <div className="h-px flex-1 bg-green-500/40" />
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded shrink-0"
                            style={{ background: '#34d39918', color: '#34d399', border: '1px solid #34d39930' }}
                          >
                            {q.meta.label}
                          </span>
                          <div className="h-px flex-1 bg-green-500/40" />
                          {/* Arrowhead */}
                          <svg width="8" height="10" viewBox="0 0 8 10" className="shrink-0">
                            <path d="M0,0 L8,5 L0,10 Z" fill="#34d399" fillOpacity="0.6" />
                          </svg>
                        </div>

                        {/* Target node pill */}
                        <div
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{ background: '#22d3ee18', color: '#22d3ee', border: '1px solid #22d3ee30' }}
                        >
                          <Tag className="w-3 h-3" />
                          {q.meta.tgtLabel}
                        </div>
                      </div>
                    )}

                    {/* Drop warning note */}
                    {isDrop && (
                      <p className="mt-2 text-[10px] text-red-400/70 flex items-center gap-1">
                        <span>⚠</span> This {q.kind === 'drop_tag' ? 'tag' : 'edge type'} was removed from the canvas
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Footer ── */}
          <div
            className="flex items-center justify-between px-6 py-4 border-t border-white/5 shrink-0"
            style={{ background: '#0a0e14' }}
          >
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded border border-white/10 hover:border-white/20"
            >
              {copied
                ? <><Check className="w-3.5 h-3.5 text-green-400" /> Copied!</>
                : <><Copy className="w-3.5 h-3.5" /> Copy All</>}
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={cancelApplyToSpace}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/20 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmApplyToSpace}
                disabled={isLoading}
                className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: isLoading ? '#1e40af' : '#2563eb' }}
              >
                {isLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-blue-300 border-t-white rounded-full animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-white" />
                    Confirm & Execute
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Syntax highlight styles */}
      <style>{`
        .ngql-kw   { color: #60a5fa; font-weight: 600; }
        .ngql-id   { color: #34d399; }
        .ngql-type { color: #f59e0b; }
      `}</style>
    </>
  );
}
