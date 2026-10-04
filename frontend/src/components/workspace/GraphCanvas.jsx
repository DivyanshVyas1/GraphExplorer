import { useEffect, useRef, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { useWorkspace, TAG_COLORS } from '../../context/workspaceContext';

// Helper to get hash-based color if tag is unknown
const getHashColor = (str) => {
  if (!str) return '#64748b';
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
};

// Normalize for case-insensitive matching
const normalize = (str) => (str || '').toString().toLowerCase().trim();

// Zoom + Inspect controls component
function ZoomControls({ onZoomIn, onZoomOut, onFit, inspectMode, onToggleInspect }) {
  return (
    <div className="absolute bottom-4 right-4 flex flex-col gap-1 z-10">
      {/* Inspect mode toggle */}
      <button
        onClick={onToggleInspect}
        title={inspectMode ? 'Inspect mode ON — hover nodes to see properties' : 'Enable inspect mode'}
        className={`w-8 h-8 border rounded flex items-center justify-center transition-all text-xs font-bold
          ${inspectMode
            ? 'bg-cyan-500 border-cyan-400 text-white shadow-lg shadow-cyan-500/30'
            : 'bg-[#161b22] border-white/10 text-gray-400 hover:text-white hover:border-white/20'}`}
      >
        i
      </button>
      <button onClick={onFit}
        className="w-8 h-8 bg-[#161b22] border border-white/10 rounded flex items-center justify-center text-gray-400 hover:text-white hover:border-white/20 transition-all text-xs">
        ⤢
      </button>
      <button onClick={onZoomIn}
        className="w-8 h-8 bg-[#161b22] border border-white/10 rounded flex items-center justify-center text-gray-400 hover:text-white hover:border-white/20 transition-all text-lg leading-none">
        +
      </button>
      <button onClick={onZoomOut}
        className="w-8 h-8 bg-[#161b22] border border-white/10 rounded flex items-center justify-center text-gray-400 hover:text-white hover:border-white/20 transition-all text-lg leading-none">
        −
      </button>
    </div>
  );
}

export default function GraphCanvas() {
  const { result, tags, edgeTypes, setSelectedNode } = useWorkspace();
  const svgRef = useRef(null);
  const zoomRef = useRef(null);
  const svgGroupRef = useRef(null);
  const simulationRef = useRef(null);

  // Inspect mode — hover tooltip
  const [inspectMode, setInspectMode] = useState(false);
  const inspectModeRef = useRef(false); // ref for use inside D3 event handlers
  const [tooltip, setTooltip] = useState(null); // { x, y, node }

  // ─── FULL DRAW: called only when result data changes ─────────────────────
  const drawFull = useCallback((currentResult, currentTags, currentEdgeTypes) => {
    if (!svgRef.current || !currentResult) return;

    // Stop old simulation
    if (simulationRef.current) simulationRef.current.stop();

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Build color + visibility maps
    const tagColorMap = Object.fromEntries(currentTags.map(t => [normalize(t.name), t.color]));
    const isTagVisible = Object.fromEntries(currentTags.map(t => [normalize(t.name), t.visible]));
    const isEdgeVisible = Object.fromEntries(currentEdgeTypes.map(e => [normalize(e.name), e.visible]));

    // ALL nodes (not filtered) — we'll hide invisible ones via opacity
    const allNodes = currentResult.nodes.map(n => ({
      ...n,
      color: tagColorMap[normalize(n.tag)] || getHashColor(n.tag),
    }));
    const allEdges = currentResult.edges.map(e => ({ ...e }));

    // Clear SVG
    svg.selectAll('*').remove();
    svg.on('click', () => setSelectedNode(null));

    // Defs — arrow marker
    const NODE_R = 22;
    const defs = svg.append('defs');
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -4 8 8')
      .attr('refX', 8)   // tip of arrow aligns to end of shortened line
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', '#475569');

    // Zoom wrapper
    const g = svg.append('g');
    svgGroupRef.current = g;

    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => g.attr('transform', event.transform));
    zoomRef.current = zoom;
    svg.call(zoom);

    // Empty state
    if (allNodes.length === 0) {
      svg.append('text')
        .attr('x', width / 2).attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#374151').attr('font-size', '14px')
        .text(currentResult.error ? currentResult.error : 'Run a query to see the graph');
      return;
    }

    // Visible node IDs for initial edge opacity
    const visibleNodeIds = new Set(
      allNodes.filter(n => isTagVisible[normalize(n.tag)] !== false).map(n => n.id)
    );

    // Force simulation — ALL nodes so positions stable on toggle
    const simulation = d3.forceSimulation(allNodes)
      .force('link', d3.forceLink(allEdges).id(d => d.id).distance(120).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-350))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05))
      .force('collision', d3.forceCollide().radius(38));
    simulationRef.current = simulation;

    // ── Draw edges ──
    const link = g.append('g').attr('class', 'edges')
      .selectAll('line')
      .data(allEdges)
      .join('line')
      .attr('class', 'edge')
      .attr('stroke', '#334155')
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#arrowhead)')
      .attr('opacity', d => {
        const srcId = d.source?.id ?? d.source;
        const tgtId = d.target?.id ?? d.target;
        return isEdgeVisible[normalize(d.type)] !== false &&
          visibleNodeIds.has(srcId) && visibleNodeIds.has(tgtId) ? 1 : 0;
      });

    // ── Edge labels ──
    const edgeLabel = g.append('g').attr('class', 'edge-labels')
      .selectAll('text')
      .data(allEdges)
      .join('text')
      .attr('class', 'edge-label')
      .attr('fill', '#64748b').attr('font-size', '10px')
      .attr('font-family', 'monospace').attr('text-anchor', 'middle')
      .text(d => d.type)
      .attr('opacity', d => {
        const srcId = d.source?.id ?? d.source;
        const tgtId = d.target?.id ?? d.target;
        return isEdgeVisible[normalize(d.type)] !== false &&
          visibleNodeIds.has(srcId) && visibleNodeIds.has(tgtId) ? 1 : 0;
      });

    // ── Node groups ──
    const node = g.append('g').attr('class', 'nodes')
      .selectAll('g')
      .data(allNodes)
      .join('g')
      .attr('class', 'node')
      .attr('cursor', 'pointer')
      .attr('opacity', d => isTagVisible[normalize(d.tag)] !== false ? 1 : 0)
      .style('pointer-events', d => isTagVisible[normalize(d.tag)] !== false ? 'all' : 'none')
      .on('click', (event, d) => { event.stopPropagation(); setSelectedNode(d); })
      .on('mouseover', (event, d) => {
        if (!inspectModeRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        setTooltip({
          x: event.clientX - rect.left + 14,
          y: event.clientY - rect.top - 10,
          node: d,
        });
      })
      .on('mousemove', (event) => {
        if (!inspectModeRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        setTooltip(prev => prev ? { ...prev, x: event.clientX - rect.left + 14, y: event.clientY - rect.top - 10 } : prev);
      })
      .on('mouseout', () => {
        setTooltip(null);
      })
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        })
      );

    // Node circles
    node.append('circle')
      .attr('r', 22)
      .attr('fill', d => d.color || '#334155')
      .attr('fill-opacity', 0.85)
      .attr('stroke', d => d.color || '#334155')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.4);

    // Node labels
    node.append('text')
      .attr('dy', 38).attr('text-anchor', 'middle')
      .attr('fill', '#cbd5e1').attr('font-size', '11px').attr('font-weight', '500')
      .text(d => {
        const label = (d.label || d.id).replace(/^["']|["']$/g, '');
        return label.length > 12 ? label.slice(0, 12) + '…' : label;
      });

    // Tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => {
          const dx = d.target.x - d.source.x, dy = d.target.y - d.source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          return d.source.x + (dx / dist) * NODE_R;
        })
        .attr('y1', d => {
          const dx = d.target.x - d.source.x, dy = d.target.y - d.source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          return d.source.y + (dy / dist) * NODE_R;
        })
        .attr('x2', d => {
          const dx = d.target.x - d.source.x, dy = d.target.y - d.source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          return d.target.x - (dx / dist) * (NODE_R + 2); // +2 small gap before arrowhead
        })
        .attr('y2', d => {
          const dx = d.target.x - d.source.x, dy = d.target.y - d.source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          return d.target.y - (dy / dist) * (NODE_R + 2);
        });
      edgeLabel
        .attr('x', d => (d.source.x + d.target.x) / 2)
        .attr('y', d => (d.source.y + d.target.y) / 2 - 4);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Auto-fit after simulation settles
    simulation.on('end', () => {
      if (!svgRef.current) return;
      const bbox = g.node().getBBox();
      if (!bbox.width) return;
      const scale = Math.min(0.9, Math.min(width / bbox.width, height / bbox.height));
      const tx = (width - bbox.width * scale) / 2 - bbox.x * scale;
      const ty = (height - bbox.height * scale) / 2 - bbox.y * scale;
      svg.transition().duration(500)
        .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    });

  }, [setSelectedNode]);

  // ─── VISIBILITY UPDATE: smooth fade on toggle ───────────────────────────
  const applyVisibility = useCallback((currentResult, currentTags, currentEdgeTypes) => {
    if (!svgRef.current || !currentResult) return;

    const svg = d3.select(svgRef.current);
    const isTagVisible = Object.fromEntries(currentTags.map(t => [normalize(t.name), t.visible]));
    const isEdgeVisible = Object.fromEntries(currentEdgeTypes.map(e => [normalize(e.name), e.visible]));
    const DURATION = 300;

    // Visible node IDs
    const visibleNodeIds = new Set(
      currentResult.nodes
        .filter(n => isTagVisible[normalize(n.tag)] !== false)
        .map(n => n.id)
    );

    // Fade nodes
    svg.selectAll('.node')
      .transition().duration(DURATION).ease(d3.easeCubicInOut)
      .attr('opacity', d => isTagVisible[normalize(d.tag)] !== false ? 1 : 0)
      .on('end', function(d) {
        d3.select(this).style('pointer-events', isTagVisible[normalize(d.tag)] !== false ? 'all' : 'none');
      });

    // Fade edges
    svg.selectAll('.edge')
      .transition().duration(DURATION).ease(d3.easeCubicInOut)
      .attr('opacity', d => {
        const srcId = d.source?.id ?? d.source;
        const tgtId = d.target?.id ?? d.target;
        return isEdgeVisible[normalize(d.type)] !== false &&
          visibleNodeIds.has(srcId) && visibleNodeIds.has(tgtId) ? 1 : 0;
      });

    // Fade edge labels
    svg.selectAll('.edge-label')
      .transition().duration(DURATION).ease(d3.easeCubicInOut)
      .attr('opacity', d => {
        const srcId = d.source?.id ?? d.source;
        const tgtId = d.target?.id ?? d.target;
        return isEdgeVisible[normalize(d.type)] !== false &&
          visibleNodeIds.has(srcId) && visibleNodeIds.has(tgtId) ? 1 : 0;
      });

  }, []);

  // Keep inspectModeRef in sync whenever inspectMode state changes
  useEffect(() => {
    inspectModeRef.current = inspectMode;
    // Clear tooltip when turning off
    if (!inspectMode) setTooltip(null);
  }, [inspectMode]);

  // Full re-draw ONLY when result changes
  const resultRef = useRef(null);
  useEffect(() => {
    resultRef.current = result;
    drawFull(result, tags, edgeTypes);
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  // Smooth fade ONLY when tags/edgeTypes change (not on result change)
  useEffect(() => {
    if (!resultRef.current) return;
    applyVisibility(resultRef.current, tags, edgeTypes);
  }, [tags, edgeTypes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Zoom control handlers
  const handleZoomIn = () => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().call(zoomRef.current.scaleBy, 1.4);
  };
  const handleZoomOut = () => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().call(zoomRef.current.scaleBy, 0.7);
  };
  const handleFit = () => {
    if (!svgRef.current || !svgGroupRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const bbox = svgGroupRef.current.node().getBBox();
    if (!bbox.width) return;
    const scale = Math.min(0.9, Math.min(width / bbox.width, height / bbox.height));
    const tx = (width - bbox.width * scale) / 2 - bbox.x * scale;
    const ty = (height - bbox.height * scale) / 2 - bbox.y * scale;
    svg.transition().duration(400)
      .call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  };

  return (
    <div className="relative flex-1 bg-[#0d1117] overflow-hidden">
      <svg ref={svgRef} className="w-full h-full" />

      {/* Hover Property Tooltip */}
      {tooltip && inspectMode && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="bg-[#0d1117] border border-white/10 rounded-xl shadow-2xl p-3 min-w-[180px] max-w-[260px]">
            {/* Node header */}
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/5">
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0"
                style={{ backgroundColor: (tooltip.node.color || '#64748b') + '30', color: tooltip.node.color || '#94a3b8' }}
              >
                {(tooltip.node.label || tooltip.node.id || '?').replace(/^["']|["']$/g, '').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{tooltip.node.tag}</p>
                <p className="text-xs font-semibold text-white truncate">
                  {(tooltip.node.label || tooltip.node.id).replace(/^["']|["']$/g, '')}
                </p>
              </div>
            </div>
            {/* Properties */}
            {Object.keys(tooltip.node.properties || {}).length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {Object.entries(tooltip.node.properties).map(([key, val]) => (
                  <div key={key} className="flex justify-between gap-3">
                    <span className="text-[10px] text-gray-500 capitalize shrink-0">{key.replace(/_/g, ' ')}</span>
                    <span className="text-[10px] text-gray-200 font-medium truncate text-right">
                      {String(val).replace(/^["']|["']$/g, '')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-gray-600">No properties</p>
            )}
          </div>
        </div>
      )}

      {result && (
        <ZoomControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFit={handleFit}
          inspectMode={inspectMode}
          onToggleInspect={() => setInspectMode(m => !m)}
        />
      )}
    </div>
  );
}
