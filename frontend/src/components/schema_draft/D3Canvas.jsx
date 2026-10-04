import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { useDraft } from '../../context/draftContext';
import CanvasToolbar from './CanvasToolbar';
import TagPalette    from './TagPalette';
import {
  bezierPath, edgePath, portWorld,
  initSVG, initZoom,
  renderEdges, renderNodes, updateEdgeSelection,
} from './d3CanvasHelpers';

export default function D3Canvas({ onSelect }) {
  const { activeDraft, saveActiveDraft, applyToSpace } = useDraft();

  /* ── refs (stable across renders, no re-render on change) ── */
  const svgRef      = useRef(null);
  const zoomRef     = useRef(null);
  const zoomGRef    = useRef(null);
  const pendingRef  = useRef(null);   // { sourceId, sourcePort, x1, y1 }
  const selectedRef = useRef(null);   // { type, id }
  const nodesRef    = useRef([]);
  const edgesRef    = useRef([]);
  const prevDraftId = useRef(null);   // track draft switches for fitView

  /* ── React state (drives D3 re-render) ── */
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  /* ── Sync from context when draft switches ── */
  useEffect(() => {
    if (activeDraft) {
      setNodes((activeDraft.nodes || []).map(n => ({ ...n, position: { ...n.position } })));
      setEdges((activeDraft.edges || []).map(e => ({ ...e })));
    } else {
      setNodes([]);
      setEdges([]);
    }
    selectedRef.current = null;
    pendingRef.current  = null;
  }, [activeDraft?.id]);

  /* ── Bootstrap SVG once ── */
  useEffect(() => {
    if (!svgRef.current) return;
    const g    = initSVG(svgRef.current, cancelAll, handleMouseMove);
    const zoom = initZoom(svgRef.current, g);
    zoomGRef.current = g;
    zoomRef.current  = zoom;
    return () => d3.select(svgRef.current).selectAll('*').remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Deselect / cancel pending edge ── */
  function cancelAll() {
    if (pendingRef.current) {
      pendingRef.current = null;
      d3.select(svgRef.current).select('.d3c-temp').attr('d', '');
    }
    selectedRef.current = null;
    onSelect(null, null, null, null, null);
    zoomGRef.current?.selectAll('.d3c-node-g').classed('sel', false);
    zoomGRef.current?.selectAll('.d3c-edge-g').classed('sel', false);
  }

  /* ── Fit all nodes into the viewport ── */
  function fitView(nodeList) {
    if (!svgRef.current || !zoomRef.current || !nodeList.length) return;
    const svgEl  = svgRef.current;
    const W = svgEl.clientWidth  || 800;
    const H = svgEl.clientHeight || 600;
    const PAD = 80;
    const NODE_R = 44;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodeList.forEach(n => {
      minX = Math.min(minX, n.position.x - NODE_R);
      minY = Math.min(minY, n.position.y - NODE_R);
      maxX = Math.max(maxX, n.position.x + NODE_R);
      maxY = Math.max(maxY, n.position.y + NODE_R);
    });

    const contentW = maxX - minX + PAD * 2;
    const contentH = maxY - minY + PAD * 2;
    const scale    = Math.min(W / contentW, H / contentH, 1.5);
    const tx = (W  - contentW * scale) / 2 - (minX - PAD) * scale;
    const ty = (H  - contentH * scale) / 2 - (minY - PAD) * scale;

    d3.select(svgEl)
      .call(zoomRef.current.transform,
        d3.zoomIdentity.translate(tx, ty).scale(scale));
  }

  /* ── Temp edge follows mouse ── */
  function handleMouseMove(ev) {
    if (!pendingRef.current || !zoomGRef.current) return;
    
    const { sourceId, sourcePort } = pendingRef.current;
    const node = nodesRef.current.find(n => n.id === sourceId);
    if (!node) return;
    
    const [x1, y1] = portWorld(node, sourcePort);
    
    const transform = d3.zoomTransform(svgRef.current);
    const [mx, my]  = transform.invert(d3.pointer(ev, svgRef.current));
    
    d3.select(svgRef.current).select('.d3c-temp')
      .attr('d', bezierPath(x1, y1, sourcePort, mx, my, 'left'));
  }

  /* ── Callback: edge clicked ── */
  function handleEdgeClick(edge) {
    selectedRef.current = { type: 'edge', id: edge.id };
    updateEdgeSelection(zoomGRef.current, selectedRef);
    onSelect(
      'edge', edge.id,
      edge.data || { label: '', properties: [] },
      (newData) => setEdges(prev => prev.map(e => {
        if (e.id !== edge.id) return e;
        return { ...e, ...(newData.label != null ? { label: newData.label } : {}), data: { ...e.data, ...newData } };
      })),
      () => { setEdges(prev => prev.filter(e => e.id !== edge.id)); onSelect(null,null,null,null,null); },
    );
  }

  /* ── Callback: node body clicked ── */
  function handleNodeClick(node, domNode) {
    selectedRef.current = { type: 'node', id: node.id };
    onSelect(
      'node', node.id, node.data,
      (newData) => {
        setNodes(prev => prev.map(n => n.id === node.id ? { ...n, data: { ...n.data, ...newData } } : n));
        if (newData.label != null) d3.select(domNode).select('.d3c-node-lbl').text(newData.label);
        if (newData.color != null) d3.select(domNode).select('.d3c-node-circle').attr('stroke', newData.color);
      },
      () => {
        setNodes(prev => prev.filter(n => n.id !== node.id));
        setEdges(prev => prev.filter(e => e.source !== node.id && e.target !== node.id));
        onSelect(null, null, null, null, null);
      },
    );
  }

  /* ── Callback: port clicked (start / finish edge) ── */
  function handlePortClick(node, portName, portSel) {
    if (!node) { cancelAll(); return; }                              // cancel
    const [wx, wy] = portWorld(node, portName);

    if (!pendingRef.current) {
      // START
      pendingRef.current = { sourceId: node.id, sourcePort: portName, x1: wx, y1: wy };
      portSel?.select('.d3c-port-dot').style('opacity', 1);
    } else {
      // FINISH
      if (pendingRef.current.sourceId === node.id) { cancelAll(); return; }

      const { sourceId, sourcePort } = pendingRef.current;
      const alreadyExists = edgesRef.current.some(
        e => e.source === sourceId && e.target === node.id &&
             e.sourcePort === sourcePort && e.targetPort === portName,
      );
      if (!alreadyExists) {
        // Prompt user for edge type name immediately
        const edgeName = window.prompt(
          '\uD83D\uDD17 Enter edge type name (e.g. "knows", "follows", "same"):',
          ''
        );
        const finalLabel = (edgeName || '').trim() || `edge_${Date.now()}`;

        const newEdge = {
          id: `edge-${Date.now()}`,
          source: sourceId, target: node.id,
          sourcePort, targetPort: portName,
          label: finalLabel,
          data: { label: finalLabel, properties: [] },
        };
        setEdges(prev => [...prev, newEdge]);

        // Auto-select the new edge so user can edit its properties in the right panel
        setTimeout(() => handleEdgeClick(newEdge), 100);
      }
      pendingRef.current = null;
      d3.select(svgRef.current).select('.d3c-temp').attr('d', '');
      zoomGRef.current?.selectAll('.d3c-port-dot').style('opacity', 0);
    }
  }

  /* ── Main D3 render (runs when nodes/edges change) ── */
  useEffect(() => {
    if (!zoomGRef.current) return;
    const g      = zoomGRef.current;
    const edgesG = g.select('.d3c-edges');

    renderEdges(g, edges, nodes, pendingRef, handleEdgeClick);
    renderNodes(g, svgRef.current, nodes, nodesRef, edgesG, pendingRef, selectedRef,
      handleNodeClick, handlePortClick, setNodes);
    updateEdgeSelection(g, selectedRef);

    // Auto-fit when switching to a draft that has nodes
    const draftId = activeDraft?.id;
    if (draftId !== prevDraftId.current && nodes.length > 0) {
      prevDraftId.current = draftId;
      // Small delay so SVG dimensions are available
      requestAnimationFrame(() => fitView(nodes));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  /* ── Keyboard Delete / Backspace ── */
  useEffect(() => {
    const handler = (ev) => {
      if (ev.key !== 'Delete' && ev.key !== 'Backspace') return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const sel = selectedRef.current;
      if (!sel) return;
      if (sel.type === 'node') {
        setNodes(prev => prev.filter(n => n.id !== sel.id));
        setEdges(prev => prev.filter(e => e.source !== sel.id && e.target !== sel.id));
      } else {
        setEdges(prev => prev.filter(e => e.id !== sel.id));
      }
      selectedRef.current = null;
      onSelect(null, null, null, null, null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSelect]);

  /* ── Add node from colour palette ── */
  const handleAddNode = useCallback((color) => {
    if (!activeDraft) return;
    const n = nodesRef.current.length;
    setNodes(prev => [...prev, {
      id: `node-${Date.now()}`,
      position: { x: 180 + (n % 5) * 160, y: 160 + Math.floor(n / 5) * 160 },
      data: { label: `Tag_${n + 1}`, color, properties: [] },
    }]);
  }, [activeDraft]);

  const handleSave  = useCallback(() => {
    if (activeDraft) saveActiveDraft(nodesRef.current, edgesRef.current);
  }, [activeDraft, saveActiveDraft]);

  const handleApply = useCallback(() => {
    applyToSpace(nodesRef.current, edgesRef.current);
  }, [applyToSpace]);

  /* ── Empty state ── */
  const isEmpty = !activeDraft;

  return (
    <div className="flex-1 relative flex flex-col" style={{ height: '100%' }}>
      {/* Always render toolbar + svg so bootstrap useEffect fires on mount */}
      <CanvasToolbar onSave={handleSave} onApply={handleApply} />

      <svg
        ref={svgRef}
        style={{ flex: 1, width: '100%', background: '#0d1117' }}
        onMouseMove={handleMouseMove}
      />

      <TagPalette onAddNode={handleAddNode} />

      {/* Empty-state overlay — shown when no draft is active */}
      {isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-gray-500 text-sm bg-[#0d1117]/80 px-6 py-3 rounded-lg">
            Select a space or create a new draft to start.
          </p>
        </div>
      )}

      {/* D3 selection state styles */}
      <style>{`
        .d3c-node-g.sel .d3c-sel-ring  { opacity: 1 !important; }
        .d3c-edge-g.sel .d3c-edge-line { stroke: #fff !important; stroke-width: 2.5px; }
      `}</style>
    </div>
  );
}
