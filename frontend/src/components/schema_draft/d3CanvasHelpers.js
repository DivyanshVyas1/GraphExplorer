// Pure D3 geometry helpers — no React dependency
import * as d3 from 'd3';

export const NODE_R   = 44;
export const PORT_R   = 6;
export const MIN_CTRL = 60;

export const TAG_COLORS = ['#22d3ee', '#4ade80', '#fb923c', '#c084fc', '#f472b6', '#60a5fa', '#fbbf24', '#34d399'];

// Port offsets from node centre (right / left / top / bottom)
export const PORTS = {
  top:    [0,       -NODE_R],
  right:  [NODE_R,  0],
  bottom: [0,        NODE_R],
  left:   [-NODE_R, 0],
};

// How many px to pull the TARGET endpoint back so the arrowhead tip
// lands exactly on the port (node boundary). Derived from marker geometry:
// markerWidth=8, viewBox 0-10, refX=9  →  tip extends (10-9)×0.8 = 0.8px past path end.
// We over-pull by ~7px so the body sits neatly outside the circle.
const ARROW_PULL = 7;

/** World-space [x, y] of a SOURCE port (full boundary) */
export function portWorld(node, port) {
  const [dx, dy] = PORTS[port] || [0, 0];
  return [node.position.x + dx, node.position.y + dy];
}

/** World-space [x, y] of a TARGET port, pulled back so arrow tip lands on boundary */
function portWorldTarget(node, port) {
  const [dx, dy] = PORTS[port] || [0, 0];
  // Unit inward vector (toward node centre)
  const len = Math.hypot(dx, dy) || 1;
  return [
    node.position.x + dx - (dx / len) * ARROW_PULL,
    node.position.y + dy - (dy / len) * ARROW_PULL,
  ];
}

/**
 * Smooth cubic-bezier SVG path between two ports.
 *
 * For "reverse" edges (where the source port faces AWAY from the target,
 * e.g. team.right → player.left when player is to the left of team),
 * naive control points fly off-screen. We detect this and add a
 * perpendicular arc so the edge curves nicely above the nodes.
 */
export function bezierPath(x1, y1, sp, x2, y2, tp) {
  const dx   = x2 - x1;
  const dy   = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const s    = Math.max(MIN_CTRL, dist * 0.45);

  // Detect "going against" the port direction (reverse edge)
  const reversedH = (sp === 'right' && dx < 0) || (sp === 'left' && dx > 0);
  const reversedV = (sp === 'bottom' && dy < 0) || (sp === 'top'  && dy > 0);

  let c1x = x1, c1y = y1, c2x = x2, c2y = y2;

  if (reversedH || reversedV) {
    // Arc perpendicular to the primary axis to avoid crossing/off-screen paths
    const perpOffset = Math.max(100, dist * 0.6);
    if (reversedH) {
      // Arc upward (negative Y = up in SVG)
      c1x = x1;  c1y = y1 - perpOffset;
      c2x = x2;  c2y = y2 - perpOffset;
    } else {
      // Arc to the right
      c1x = x1 + perpOffset;  c1y = y1;
      c2x = x2 + perpOffset;  c2y = y2;
    }
  } else {
    // Normal forward edge — standard control-point offsets
    if (sp === 'right')  c1x += s;
    if (sp === 'left')   c1x -= s;
    if (sp === 'bottom') c1y += s;
    if (sp === 'top')    c1y -= s;
    if (tp === 'left')   c2x -= s;
    if (tp === 'right')  c2x += s;
    if (tp === 'top')    c2y -= s;
    if (tp === 'bottom') c2y += s;
  }

  return `M${x1},${y1} C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}`;
}

/** SVG path for an edge — target endpoint is pulled back for the arrowhead */
export function edgePath(edge, nodesArr) {
  const src = nodesArr.find(n => n.id === edge.source);
  const tgt = nodesArr.find(n => n.id === edge.target);
  if (!src || !tgt) return '';

  // ── Self-loop (same source and target node) ──────────────────────────────
  if (src.id === tgt.id || edge.sourcePort === 'self') {
    const cx  = src.position.x;
    const cy  = src.position.y;
    const r   = NODE_R;
    const lp  = 50; // loop protrusion above node
    // Start slightly left of top, end slightly right (pulled back for arrow)
    const x0 = cx - 12,  y0 = cy - r;
    const x1 = cx + 12,  y1 = cy - r + ARROW_PULL;
    return `M${x0},${y0} C${x0 - lp},${y0 - lp * 1.8} ${x1 + lp},${y1 - lp * 1.8} ${x1},${y1}`;
  }

  const sp = edge.sourcePort || 'right';
  const tp = edge.targetPort || 'left';
  const [x1, y1] = portWorld(src, sp);            // source: full boundary
  const [x2, y2] = portWorldTarget(tgt, tp);      // target: pulled back
  return bezierPath(x1, y1, sp, x2, y2, tp);
}

/** Bootstrap SVG once: defs (arrow marker, dot-grid), layers, temp-edge path */
export function initSVG(svgEl, onBgClick, onBgMouseMove) {
  const svg = d3.select(svgEl);

  // Defs
  const defs = svg.append('defs');

  defs.append('marker')
    .attr('id', 'd3c-arrow').attr('viewBox', '0 0 10 10')
    .attr('refX', 10).attr('refY', 5)          // tip lands exactly at path endpoint
    .attr('markerWidth', 8).attr('markerHeight', 8)
    .attr('orient', 'auto-start-reverse')
    .append('path').attr('d', 'M0,0 L10,5 L0,10 Z').attr('fill', '#22d3ee');

  const pat = defs.append('pattern')
    .attr('id', 'd3c-dots').attr('width', 24).attr('height', 24)
    .attr('patternUnits', 'userSpaceOnUse');
  pat.append('circle').attr('cx', 12).attr('cy', 12).attr('r', 0.9).attr('fill', '#1e2a3a');

  // Background (captures clicks / mousemove outside nodes)
  svg.append('rect').attr('class', 'd3c-bg')
    .attr('width', '100%').attr('height', '100%')
    .attr('fill', 'url(#d3c-dots)')
    .on('click', onBgClick)
    .on('mousemove', onBgMouseMove);

  // Zoom container with two ordered layers
  const g = svg.append('g').attr('class', 'zoom-g');
  g.append('g').attr('class', 'd3c-edges');
  g.append('g').attr('class', 'd3c-nodes');

  // Temp-edge drawn on top of everything inside the zoom group
  g.append('path').attr('class', 'd3c-temp')
    .attr('stroke', '#22d3ee').attr('stroke-width', 2)
    .attr('stroke-dasharray', '8,4').attr('fill', 'none')
    .attr('pointer-events', 'none');

  return g; // zoom-g selection
}

/** Attach d3.zoom to svg and return the zoom behaviour */
export function initZoom(svgEl, zoomG) {
  const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', (ev) => zoomG.attr('transform', ev.transform));
  d3.select(svgEl).call(zoom);
  return zoom;
}

/** Draw / update all edges using D3 enter-update-exit */
export function renderEdges(zoomG, edges, nodes, pendingRef, onEdgeClick) {
  const edgesG  = zoomG.select('.d3c-edges');
  const edgeSel = edgesG.selectAll('.d3c-edge-g').data(edges, d => d.id);

  edgeSel.exit().remove();

  const enter = edgeSel.enter().append('g').attr('class', 'd3c-edge-g').style('cursor', 'pointer');
  enter.append('path').attr('class', 'd3c-edge-hit')
    .attr('stroke', 'transparent').attr('stroke-width', 14).attr('fill', 'none');
  enter.append('path').attr('class', 'd3c-edge-line')
    .attr('stroke', '#22d3ee').attr('stroke-width', 2)
    .attr('fill', 'none').attr('marker-end', 'url(#d3c-arrow)');
  enter.append('rect').attr('class', 'd3c-edge-lbg')
    .attr('rx', 4).attr('fill', '#0d1117').attr('stroke', '#22d3ee33').attr('stroke-width', 1);
  enter.append('text').attr('class', 'd3c-edge-lbl')
    .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
    .attr('fill', '#22d3ee').attr('font-size', '11px').attr('font-weight', 'bold')
    .attr('pointer-events', 'none');

  const merge = edgeSel.merge(enter);

  merge.each(function(edge) {
    const p = edgePath(edge, nodes);
    const eg = d3.select(this);
    eg.select('.d3c-edge-hit').attr('d', p);
    eg.select('.d3c-edge-line').attr('d', p);

    const lbl = edge.label || edge.data?.label || '';
    eg.select('.d3c-edge-lbl').text(lbl);

    try {
      const pathEl = eg.select('.d3c-edge-line').node();
      if (pathEl && lbl) {
        const mid   = pathEl.getPointAtLength(pathEl.getTotalLength() / 2);
        const lblEl = eg.select('.d3c-edge-lbl').attr('x', mid.x).attr('y', mid.y).node();
        const bb    = lblEl.getBBox();
        eg.select('.d3c-edge-lbg')
          .attr('x', bb.x - 5).attr('y', bb.y - 3)
          .attr('width', bb.width + 10).attr('height', bb.height + 6);
      } else {
        eg.select('.d3c-edge-lbg').attr('width', 0).attr('height', 0);
      }
    } catch (_) {}
  });

  merge.on('click', function(ev, edge) {
    ev.stopPropagation();
    if (pendingRef.current) return;
    zoomG.selectAll('.d3c-node-g').classed('sel', false);
    zoomG.selectAll('.d3c-edge-g').classed('sel', false);
    d3.select(this).classed('sel', true);
    onEdgeClick(edge);
  });

  return merge;
}

/** Draw / update all nodes (circles, labels, ports, drag) */
export function renderNodes(
  zoomG, svgEl, nodes, nodesRef, edgesG, pendingRef, selectedRef,
  onNodeClick, onPortClick, setNodes,
) {
  const nodesG  = zoomG.select('.d3c-nodes');
  const nodeSel = nodesG.selectAll('.d3c-node-g').data(nodes, d => d.id);

  nodeSel.exit().remove();

  const enter = nodeSel.enter().append('g').attr('class', 'd3c-node-g').style('cursor', 'grab');
  enter.append('circle').attr('class', 'd3c-node-circle').attr('r', NODE_R).attr('fill', '#0d1117');
  enter.append('circle').attr('class', 'd3c-sel-ring')
    .attr('r', NODE_R + 6).attr('fill', 'none').attr('stroke', 'white')
    .attr('stroke-width', 2).attr('stroke-dasharray', '5,4').attr('opacity', 0);
  enter.append('text').attr('class', 'd3c-node-lbl')
    .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
    .attr('fill', '#fff').attr('font-size', '11px').attr('font-weight', 'bold')
    .attr('pointer-events', 'none');

  Object.entries(PORTS).forEach(([portName, [ox, oy]]) => {
    enter.append('g')
      .attr('class', `d3c-port d3c-port-${portName}`)
      .attr('data-port', portName)
      .attr('transform', `translate(${ox},${oy})`)
      .call(pg => {
        pg.append('circle').attr('r', 10).attr('fill', 'transparent').attr('cursor', 'crosshair');
        pg.append('circle').attr('class', 'd3c-port-dot')
          .attr('r', PORT_R).attr('fill', '#22d3ee')
          .attr('stroke', '#0d1117').attr('stroke-width', 2)
          .style('opacity', 0).attr('pointer-events', 'none');
      });
  });

  const merge = nodeSel.merge(enter);

  merge.attr('transform', d => `translate(${d.position.x},${d.position.y})`);
  merge.select('.d3c-node-circle').attr('stroke', d => d.data.color || '#22d3ee').attr('stroke-width', 2);
  merge.select('.d3c-node-lbl').text(d => d.data.label || '');

  // Hover → show/hide ports
  merge.on('mouseenter', function() {
    d3.select(this).selectAll('.d3c-port-dot').style('opacity', 1);
  }).on('mouseleave', function() {
    d3.select(this).selectAll('.d3c-port-dot').style('opacity', 0);
  });

  // Node circle click
  merge.select('.d3c-node-circle').on('click', function(ev, node) {
    ev.stopPropagation();
    if (pendingRef.current) { onPortClick(null); return; } // cancel pending
    zoomG.selectAll('.d3c-node-g').classed('sel', false);
    zoomG.selectAll('.d3c-edge-g').classed('sel', false);
    d3.select(this.parentNode).classed('sel', true);
    selectedRef.current = { type: 'node', id: node.id };
    onNodeClick(node, this.parentNode);
  });

  // Port click
  merge.selectAll('.d3c-port')
    .on('mousedown', function(ev) {
      ev.stopPropagation(); // prevent d3.drag on parent from suppressing click
    })
    .on('click', function(ev, node) {
      ev.stopPropagation();
      
      // Get the freshest node data from the parent element just in case
      const parentNodeData = d3.select(this.parentNode).datum();
      const actualNode = parentNodeData || node;

      const portName = d3.select(this).attr('data-port');
      onPortClick(actualNode, portName, d3.select(this));
    });

  // Drag (zoom-aware)
  const drag = d3.drag()
    .on('start', function(ev) {
      ev.sourceEvent.stopPropagation();
      d3.select(this).style('cursor', 'grabbing').raise();
    })
    .on('drag', function(ev, node) {
      const k = d3.zoomTransform(svgEl).k;
      node.position.x += ev.dx / k;
      node.position.y += ev.dy / k;
      d3.select(this).attr('transform', `translate(${node.position.x},${node.position.y})`);
      // Live-redraw connected edges
      edgesG.selectAll('.d3c-edge-g').each(function(edge) {
        if (edge.source === node.id || edge.target === node.id) {
          const p = edgePath(edge, nodesRef.current);
          d3.select(this).select('.d3c-edge-hit').attr('d', p);
          d3.select(this).select('.d3c-edge-line').attr('d', p);
        }
      });
    })
    .on('end', function(ev, node) {
      d3.select(this).style('cursor', 'grab');
      setNodes(prev => prev.map(n =>
        n.id === node.id ? { ...n, position: { x: node.position.x, y: node.position.y } } : n
      ));
    });

  merge.call(drag);

  // Selection ring visibility
  merge.select('.d3c-sel-ring').attr('opacity', d =>
    selectedRef.current?.type === 'node' && selectedRef.current?.id === d.id ? 1 : 0
  );

  return merge;
}

/** Update edge stroke colour to reflect selection */
export function updateEdgeSelection(zoomG, selectedRef) {
  zoomG.selectAll('.d3c-edge-g').select('.d3c-edge-line')
    .attr('stroke', d =>
      selectedRef.current?.type === 'edge' && selectedRef.current?.id === d.id
        ? '#ffffff' : '#22d3ee'
    );
}
