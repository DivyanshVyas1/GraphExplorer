import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { draftApi } from '../services/draftApi';
import { useWs } from './wsContext';
import { useSpace } from './spaceContext';

const DraftContext = createContext(null);

export function DraftProvider({ children }) {
  const { sendQuery, sendSchema } = useWs();
  const { spaces } = useSpace();
  
  const [drafts, setDrafts] = useState([]);
  const [activeDraft, setActiveDraft] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // nGQL preview modal state
  const [pendingApply, setPendingApply] = useState(null); 
  // { targetSpace, isNewSpace, queries: string[], nodes, edges }

  // Load all drafts on mount
  useEffect(() => {
    loadDrafts();
  }, []);

  const loadDrafts = async () => {
    try {
      setIsLoading(true);
      const data = await draftApi.getDrafts();
      setDrafts(data || []);
      if (data && data.length > 0 && !activeDraft) {
        setActiveDraft(data[0]);
      }
    } catch (err) {
      console.error("Failed to load drafts:", err);
      setError("Failed to load drafts");
    } finally {
      setIsLoading(false);
    }
  };

  // Always fetch FRESH from DB — never trust stale React state.
  // Returns the latest array of drafts. Called before space selection.
  const refreshDrafts = async () => {
    try {
      const data = await draftApi.getDrafts();
      setDrafts(data || []);
      return data || [];
    } catch (err) {
      console.error('[DRAFT] refreshDrafts failed:', err);
      return [];
    }
  };

  const createNewDraft = async (space = '', nodes = [], edges = []) => {
    const draftName = space
      ? `${space}_draft_${Date.now()}`
      : `New_Draft_${Date.now()}`;

    console.log('[DRAFT] createNewDraft called for space:', space, '| stack:', new Error().stack.split('\n')[2]);
    try {
      // Create directly in DB — no temp draft, so D3Canvas useEffect only fires ONCE
      const created = await draftApi.createDraft({ name: draftName, space, nodes, edges });
      console.log('[DRAFT] Draft created in DB:', created.id);
      setDrafts(prev => [created, ...prev]);
      setActiveDraft(created);
    } catch (err) {
      console.error('Failed to save draft to DB:', err);
      // Fallback: show temp draft so user can still work
      const tempDraft = { id: `temp-${Date.now()}`, name: draftName, space, nodes, edges };
      setActiveDraft(tempDraft);
      setDrafts(prev => [tempDraft, ...prev]);
    }
  };

  const saveActiveDraft = async (nodes, edges) => {
    if (!activeDraft) return;
    const draftId = activeDraft.id;
    console.log('[DRAFT] saveActiveDraft called | draftId:', draftId, '| nodes:', nodes.length, '| edges:', edges.length);
    if (!draftId || String(draftId).startsWith('temp-')) {
      console.warn('[DRAFT] Draft not yet saved to DB, cannot update');
      return;
    }
    try {
      const updated = await draftApi.updateDraft(draftId, {
        ...activeDraft,
        nodes: nodes,
        edges: edges
      });
      setDrafts(prev => prev.map(d => d.id === updated.id ? updated : d));
      console.log('[DRAFT] ✅ Saved successfully:', updated.id);
      // Show brief toast notification
      const toast = document.createElement('div');
      toast.textContent = '✅ Draft saved!';
      toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#22d3ee;color:#0d1117;padding:8px 20px;border-radius:8px;font-weight:bold;z-index:9999;font-size:14px;transition:opacity 0.5s';
      document.body.appendChild(toast);
      setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 2000);
    } catch (err) {
      console.error('[DRAFT] ❌ Failed to save draft:', err);
    }
  };

  const deleteDraft = async (id) => {
    try {
      await draftApi.deleteDraft(id);
      setDrafts(prev => prev.filter(d => d.id !== id));
      if (activeDraft?.id === id) {
        setActiveDraft(null);
      }
    } catch (err) {
      console.error("Failed to delete draft:", err);
    }
  };

  const updateDraftCanvas = (updatedFields) => {
    setActiveDraft(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...updatedFields };
      setDrafts(ds => ds.map(d => d.id === next.id ? next : d));
      return next;
    });
  };

  // ── Step 1: Generate queries + show preview modal ──────────────────────────
  const previewApplyToSpace = async (nodes, edges) => {
    let targetSpace = activeDraft?.space;
    const isNewSpace = !targetSpace;

    if (!targetSpace) {
      const spaceName = window.prompt("Enter a name for the new space:");
      if (!spaceName) return;
      targetSpace = spaceName.trim().replace(/[^a-zA-Z0-9_]/g, '_');
    }

    const queries = []; // [{ gql, kind, meta }]

    // New space CREATE query
    if (isNewSpace) {
      queries.push({
        gql: `CREATE SPACE IF NOT EXISTS \`${targetSpace}\` (partition_num=10, replica_factor=1, vid_type=fixed_string(32));`,
        kind: 'create_space',
        meta: { label: targetSpace },
      });
    }

    let existingTagsMap = {};
    let existingEdgesMap = {};

    // Diff against existing schema (only for existing spaces)
    if (!isNewSpace) {
      try {
        setIsLoading(true);
        const existingSchema = await sendSchema(targetSpace);
        const currentTagNames = nodes.map(n => n.data.label);
        const currentEdgeNames = edges.map(e => e.label || e.data?.label);

        if (existingSchema.tags) {
          existingSchema.tags.forEach(t => { existingTagsMap[t.name] = t; });
          existingSchema.tags.forEach(tag => {
            if (!currentTagNames.includes(tag.name)) {
              queries.push({
                gql: `DROP TAG IF EXISTS \`${tag.name}\`;`,
                kind: 'drop_tag',
                meta: { label: tag.name },
              });
            }
          });
        }
        if (existingSchema.edgeTypes) {
          existingSchema.edgeTypes.forEach(e => { existingEdgesMap[e.name] = e; });
          existingSchema.edgeTypes.forEach(edge => {
            if (!currentEdgeNames.includes(edge.name)) {
              queries.push({
                gql: `DROP EDGE IF EXISTS \`${edge.name}\`;`,
                kind: 'drop_edge',
                meta: { label: edge.name },
              });
            }
          });
        }
      } catch (schemaErr) {
        console.warn("Failed to fetch existing schema for diffing:", schemaErr);
      } finally {
        setIsLoading(false);
      }
    }

    // CREATE / ALTER TAG queries
    nodes.forEach(node => {
      const tagName = node.data.label;
      const existingTag = existingTagsMap[tagName];
      const validProps = (node.data?.properties || []).filter(p => p.name && p.name.trim() !== '');

      if (existingTag) {
        // Tag exists: diff properties to see if we need ALTER TAG ADD
        const existingPropsMap = {};
        (existingTag.properties || []).forEach(p => { existingPropsMap[p.name] = true; });
        
        const newProps = validProps.filter(p => !existingPropsMap[p.name]);
        if (newProps.length > 0) {
          const propsStr = newProps.map(p => `\`${p.name}\` ${p.type}`).join(', ');
          queries.push({
            gql: `ALTER TAG \`${tagName}\` ADD ( ${propsStr} );`,
            kind: 'alter_tag',
            meta: { label: tagName },
          });
        }
        return; // Skip CREATE TAG since it exists
      }

      let propStr = '()';
      if (validProps.length > 0) {
        const props = validProps.map(p => `\`${p.name}\` ${p.type}`).join(', ');
        propStr = `( ${props} )`;
      }
      queries.push({
        gql: `CREATE TAG IF NOT EXISTS \`${tagName}\` ${propStr};`,
        kind: 'create_tag',
        meta: { label: tagName },
      });
    });

    // Build nodeId → label map for edge connectivity display
    const nodeIdToLabel = {};
    nodes.forEach(n => { nodeIdToLabel[n.id] = n.data.label; });

    // CREATE / ALTER EDGE queries
    edges.forEach(edge => {
      const edgeName = edge.label || 'edge_' + Date.now();
      const existingEdge = existingEdgesMap[edgeName];
      const validProps = (edge.data?.properties || []).filter(p => p.name && p.name.trim() !== '');

      const srcLabel = nodeIdToLabel[edge.source] || edge.source || '?';
      const tgtLabel = nodeIdToLabel[edge.target] || edge.target || '?';

      if (existingEdge) {
        // Edge exists: diff properties for ALTER EDGE ADD
        const existingPropsMap = {};
        (existingEdge.properties || []).forEach(p => { existingPropsMap[p.name] = true; });
        
        const newProps = validProps.filter(p => !existingPropsMap[p.name]);
        if (newProps.length > 0) {
          const propsStr = newProps.map(p => `\`${p.name}\` ${p.type}`).join(', ');
          queries.push({
            gql: `ALTER EDGE \`${edgeName}\` ADD ( ${propsStr} );`,
            kind: 'alter_edge',
            meta: { label: edgeName, srcLabel, tgtLabel },
          });
        }
        return; // Skip CREATE EDGE
      }

      let propStr = '()';
      if (validProps.length > 0) {
        const props = validProps.map(p => `\`${p.name}\` ${p.type}`).join(', ');
        propStr = `( ${props} )`;
      }
      queries.push({
        gql: `CREATE EDGE IF NOT EXISTS \`${edgeName}\` ${propStr};`,
        kind: 'create_edge',
        meta: { label: edgeName, srcLabel, tgtLabel },
      });
    });

    // Show preview modal
    setPendingApply({ targetSpace, isNewSpace, queries, nodes, edges });
  };

  // ── Step 2: Actually execute after user confirms ───────────────────────────
  const confirmApplyToSpace = async () => {
    if (!pendingApply) return;
    const { targetSpace, isNewSpace, queries, nodes, edges } = pendingApply;
    setPendingApply(null);
    setIsLoading(true);

    try {
      if (isNewSpace) {
        // Execute CREATE SPACE first, then poll readiness
        const createRes = await sendQuery({
          space: "",
          gqls: [queries[0].gql],  // first query object is CREATE SPACE
          msgType: 'batch_ngql'
        });
        if (createRes.results?.[0]?.error) {
          throw new Error(`Failed to create space: ${createRes.results[0].error}`);
        }

        // Poll until USE space succeeds
        let spaceReady = false;
        for (let i = 0; i < 15; i++) {
          await new Promise(r => setTimeout(r, 1000));
          const checkRes = await sendQuery({
            space: "",
            gqls: [`USE \`${targetSpace}\`;`],
            msgType: 'batch_ngql'
          });
          if (!checkRes.results?.[0]?.error) {
            spaceReady = true;
            break;
          }
        }
        if (!spaceReady) {
          throw new Error("Space was created but is not ready yet. Try 'Apply to Space' again in a few seconds.");
        }
        updateDraftCanvas({ space: targetSpace });
      }

      // Execute remaining DDL queries (skip first if it was CREATE SPACE), extract .gql strings
      const ddlQueries = (isNewSpace ? queries.slice(1) : queries).map(q => q.gql);
      if (ddlQueries.length > 0) {
        const schemaRes = await sendQuery({
          space: targetSpace,
          gqls: ddlQueries,
          msgType: 'batch_ngql'
        });
        const failedQuery = schemaRes.results?.find(r => r.error);
        if (failedQuery) {
          throw new Error(`Schema error in ${failedQuery.gql}:\n${failedQuery.error}`);
        }
      }

      // Auto-save the draft after successful application
      if (activeDraft) {
        try {
          const updated = await draftApi.updateDraft(activeDraft.id, {
            ...activeDraft,
            space: targetSpace,
            nodes: nodes,
            edges: edges
          });
          setActiveDraft(updated);
          setDrafts(prev => prev.map(d => d.id === updated.id ? updated : d));
        } catch (saveErr) {
          console.error("Auto-save failed:", saveErr);
        }
      }

      alert(`✅ Schema applied to space \`${targetSpace}\` successfully and draft auto-saved!`);
    } catch (err) {
      console.error("Failed to apply schema:", err);
      alert("Error applying schema: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const cancelApplyToSpace = () => setPendingApply(null);

  return (
    <DraftContext.Provider value={{
      drafts,
      activeDraft,
      setActiveDraft,
      isLoading,
      error,
      createNewDraft,
      saveActiveDraft,
      deleteDraft,
      refreshDrafts,
      applyToSpace: previewApplyToSpace,   // renamed — now shows preview first
      confirmApplyToSpace,
      cancelApplyToSpace,
      pendingApply,
      updateDraftCanvas
    }}>
      {children}
    </DraftContext.Provider>
  );
}

export const useDraft = () => useContext(DraftContext);
