import { useDraft } from '../../context/draftContext';
import { useSpace } from '../../context/spaceContext';
import { useWs } from '../../context/wsContext';
import { X, Loader2 } from 'lucide-react';
import { useCallback, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import dagre from 'dagre';

const TAG_COLORS = ['#22d3ee', '#4ade80', '#fb923c', '#c084fc', '#f472b6', '#60a5fa', '#fbbf24', '#34d399'];

/**
 * Convert NebulaGraph schema into D3Canvas nodes + edges.
 *
 * connections: [{ srcTag, edgeType, tgtTag }]  — from real MATCH query data
 * If connections is empty (space has no data yet), falls back to sequential layout.
 */
const schemaToCanvas = (tags, edgeTypes, connections = [], existingDraft = null) => {
  const nodes = tags.map((tag, idx) => {
    const color = TAG_COLORS[idx % TAG_COLORS.length];
    // ── Preserve existing node position if this tag was already in the draft ──
    const existingNode = existingDraft?.nodes?.find(n => n.data?.label === tag.name || n.id === `tag-${tag.name}`);
    return {
      id: `tag-${tag.name}`,
      position: existingNode ? { ...existingNode.position } : { x: 0, y: 0 }, // Use saved position or let dagre calculate
      data: {
        label: tag.name,
        color: existingNode?.data?.color || color,
        properties: tag.properties || [],
      },
      _hasExistingPos: !!existingNode, // flag to skip dagre for this node
    };
  });

  // Build a lookup: tagName → node id
  const tagToNodeId = {};
  nodes.forEach(n => { tagToNodeId[n.data.label] = n.id; });

  let edges;
  const danglingNodes = [];

  if (connections.length > 0) {
    // ── Use real connectivity from MATCH query ────────────────────────────
    const connByEdge = {};
    connections.forEach(c => {
      if (!connByEdge[c.edgeType]) connByEdge[c.edgeType] = c;
    });

    edges = edgeTypes
      .map((edge, idx) => {
        const conn = connByEdge[edge.name];
        let srcId = conn ? tagToNodeId[conn.srcTag] : null;
        let tgtId = conn ? tagToNodeId[conn.tgtTag] : null;

        // Fallback: if edge exists in schema but no data yet, check existing draft
        if ((!srcId || !tgtId) && existingDraft && existingDraft.edges) {
          const draftEdge = existingDraft.edges.find(e => e.label === edge.name || e.data?.label === edge.name);
          if (draftEdge) {
             const srcNode = nodes.find(n => n.id === draftEdge.source);
             const tgtNode = nodes.find(n => n.id === draftEdge.target);
             if (srcNode && tgtNode) {
               srcId = srcNode.id;
               tgtId = tgtNode.id;
             }
          }
        }

        // Final Fallback: Dangling edge (no data, no draft history)
        if (!srcId || !tgtId) {
          const sId = `dangling-src-${edge.name}`;
          const tId = `dangling-tgt-${edge.name}`;
          danglingNodes.push({
            id: sId,
            position: { x: 0, y: 0 },
            data: { label: '?', color: '#6b7280', isDangling: true, properties: [] }
          });
          danglingNodes.push({
            id: tId,
            position: { x: 0, y: 0 },
            data: { label: '?', color: '#6b7280', isDangling: true, properties: [] }
          });
          srcId = sId;
          tgtId = tId;
        }

        const isSelfLoop = srcId === tgtId;
        return {
          id: `edge-schema-${edge.name}-${idx}`,
          source: srcId,
          target: tgtId,
          sourcePort: isSelfLoop ? 'self' : 'right',
          targetPort: isSelfLoop ? 'self' : 'left',
          label: edge.name,
          data: { label: edge.name, properties: edge.properties || [] },
        };
      })
      .filter(Boolean);
      
      nodes.push(...danglingNodes);
  } else {
    // ── Fallback: no data, connect sequentially ───────────────────────────
    edges = nodes.length >= 2
      ? edgeTypes.map((edge, idx) => ({
          id: `edge-schema-${edge.name}-${idx}`,
          source: nodes[idx % nodes.length]?.id || nodes[0]?.id,
          target: nodes[(idx + 1) % nodes.length]?.id || nodes[0]?.id,
          sourcePort: 'right',
          targetPort: 'left',
          label: edge.name,
          data: { label: edge.name, properties: edge.properties || [] },
        }))
      : [];
  }

  // ── Apply Dagre Layout ───────────────────────────────────────────────
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', ranksep: 180, nodesep: 100 });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach(n => {
    // NODE_R is ~44, so diameter is ~88
    g.setNode(n.id, { width: 100, height: 100 });
  });

  edges.forEach(e => {
    if (e.source !== e.target) {
      g.setEdge(e.source, e.target);
    }
  });

  dagre.layout(g);

  // Only apply dagre layout to nodes that don't have saved positions
  const needsLayout = nodes.filter(n => !n._hasExistingPos);
  if (needsLayout.length > 0 || nodes.every(n => !n._hasExistingPos)) {
    // Apply calculated positions back to nodes that need it
    nodes.forEach(n => {
      if (!n._hasExistingPos) {
        const nodeWithPos = g.node(n.id);
        if (nodeWithPos) {
          n.position = {
            x: nodeWithPos.x,
            y: nodeWithPos.y
          };
        }
      }
      delete n._hasExistingPos; // clean up flag
    });
  } else {
    nodes.forEach(n => delete n._hasExistingPos);
  }

  return { nodes, edges };
};


export default function DraftSidebar() {
  const {
    drafts,
    activeDraft,
    setActiveDraft,
    createNewDraft,
    deleteDraft,
    isLoading,
    updateDraftCanvas,
    refreshDrafts,
  } = useDraft();
  const { spaces } = useSpace();
  const { sendSchema } = useWs();
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Called when user picks from the dropdown
  const handleDropdownChange = useCallback(async (e) => {
    const value = e.target?.value || e.target; // support direct string pass
    if (!value) return;

    if (value === '__new__') {
      createNewDraft();
      return;
    }

    setSchemaLoading(true);
    try {
      // ── ALWAYS fetch FRESH from DB to avoid race conditions ──────────────
      // (stale React state may not have loaded yet when user selects a space)
      const freshDrafts = await refreshDrafts();
      const existingDraft = freshDrafts.find(d => d.space === value);

      if (existingDraft) {
        // Load saved draft directly — NO dagre, positions exactly as saved
        console.log('[DRAFT] Loading existing draft:', existingDraft.id, 'for space:', value);
        setActiveDraft(existingDraft);
      } else {
        // First time — fetch schema from Nebula and auto-layout
        console.log('[DRAFT] No draft found for space:', value, '— creating new one');
        const schema = await sendSchema(value);
        const { nodes, edges } = schemaToCanvas(
          schema.tags || [],
          schema.edgeTypes || [],
          schema.connections || [],
          null
        );
        await createNewDraft(value, nodes, edges);
      }
    } catch (err) {
      console.error('[DRAFT] Failed to load space:', err);
    } finally {
      setSchemaLoading(false);
    }

    if (e.target && e.target.value !== undefined) e.target.value = '';
  }, [createNewDraft, sendSchema, setActiveDraft, refreshDrafts]);

  // Handle auto-loading schema from URL param
  useEffect(() => {
    const spaceParam = searchParams.get('space');
    if (spaceParam && !isLoading && !schemaLoading) {
      handleDropdownChange({ target: spaceParam });
      setSearchParams({}); // Clear the param so it doesn't run again
    }
  }, [searchParams, isLoading, schemaLoading, handleDropdownChange, setSearchParams]);

  return (
    <div className="w-64 bg-[#161b22] border-r border-white/5 flex flex-col h-full shrink-0">

      {/* Space / New Dropdown */}
      <div className="p-4 border-b border-white/5">
        <label className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2 block">
          Open / Create Schema
        </label>
        <div className="relative">
          <select
            className="w-full bg-[#0d1117] text-sm text-gray-300 border border-white/10 rounded px-3 py-2 outline-none focus:border-cyan-500 transition-colors disabled:opacity-50 appearance-none pr-8"
            defaultValue=""
            onChange={handleDropdownChange}
            disabled={schemaLoading}
          >
            <option value="" disabled>Select space...</option>
            <option value="__new__">＋ New Space (blank)</option>
            <optgroup label="Existing Spaces">
              {spaces.map((s) => {
                const name = s.name || s.id || s;
                return <option key={name} value={name}>{name}</option>;
              })}
            </optgroup>
          </select>
          {schemaLoading && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
            </div>
          )}
        </div>
        {schemaLoading && (
          <p className="text-[10px] text-yellow-400 mt-1.5">Loading schema from space...</p>
        )}
      </div>

      {/* Draft List Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-300">Draft List</h2>
        <span className="text-[10px] text-gray-500">{drafts.length} drafts</span>
      </div>

      {/* Draft Cards */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-2">
        {isLoading && drafts.length === 0 ? (
          <div className="text-xs text-gray-500 text-center py-8">Loading...</div>
        ) : drafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <p className="text-xs text-gray-500 text-center">No drafts yet.</p>
            <p className="text-[10px] text-gray-600 text-center">Select a space or "New Space" above to start.</p>
          </div>
        ) : (
          drafts.map((draft) => (
            <div
              key={draft.id}
              onClick={() => setActiveDraft(draft)}
              className={`p-3 rounded-lg border cursor-pointer group transition-all
                ${activeDraft?.id === draft.id
                  ? 'bg-cyan-500/10 border-cyan-500/50'
                  : 'bg-[#0d1117] border-white/5 hover:border-white/20'
                }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className={`text-sm font-medium truncate max-w-[160px] ${activeDraft?.id === draft.id ? 'text-cyan-400' : 'text-gray-300'}`}>
                  {draft.name}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`🗑️ Delete "${draft.name}"?\n\nThis cannot be undone.`)) {
                      deleteDraft(draft.id);
                    }
                  }}
                  title="Delete draft"
                  className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-1 mt-1">
                {draft.space ? (
                  <span className="text-[10px] bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full truncate max-w-full">
                    {draft.space}
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-600 italic">New space</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
