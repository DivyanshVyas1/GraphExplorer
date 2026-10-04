import { useWorkspace } from '../../context/workspaceContext';
import { X, ChevronRight } from 'lucide-react';

// Helper to strip surrounding quotes from Nebula properties
const cleanString = (str) => {
  if (typeof str !== 'string') return String(str);
  return str.replace(/^["']|["']$/g, '');
};

// Helper to safely get the first character for the avatar
const getInitial = (label, id) => {
  const clean = cleanString(label || id || '?');
  return clean.charAt(0).toUpperCase();
};

export default function RightSidebar() {
  const { result, selectedNode, setSelectedNode } = useWorkspace();

  if (!selectedNode) return null;

  // Find connected entities
  const connectedEntities = [];
  if (result && result.edges && result.nodes) {
    const nodeMap = new Map(result.nodes.map(n => [n.id, n]));
    
    result.edges.forEach(edge => {
      if (edge.source === selectedNode.id) {
        const targetNode = nodeMap.get(edge.target);
        if (targetNode) {
          connectedEntities.push({
            node: targetNode,
            edgeType: edge.type,
            direction: 'out'
          });
        }
      } else if (edge.target === selectedNode.id) {
        const sourceNode = nodeMap.get(edge.source);
        if (sourceNode) {
          connectedEntities.push({
            node: sourceNode,
            edgeType: edge.type,
            direction: 'in'
          });
        }
      }
    });
  }

  const properties = selectedNode.properties || {};
  const nodeColor = selectedNode.color || '#4ade80';

  return (
    <aside className="w-80 shrink-0 bg-[#0d1117] border-l border-white/5 flex flex-col h-full shadow-2xl relative z-20">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5">
        <h2 className="text-xl font-bold text-white">Entity Details</h2>
        <button 
          onClick={() => setSelectedNode(null)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-6 pb-6 flex flex-col gap-8">
        {/* Hero Card */}
        <div className="bg-[#161b22] rounded-xl p-4 flex items-center gap-4">
          <div 
            className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white shrink-0"
            style={{ backgroundColor: nodeColor + '30', color: nodeColor }}
          >
            {getInitial(selectedNode.label, selectedNode.id)}
          </div>
          
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">
              {selectedNode.tag || 'UNKNOWN'}
            </span>
            <span className="text-lg font-bold text-white truncate" title={cleanString(selectedNode.label)}>
              {cleanString(selectedNode.label || selectedNode.id)}
            </span>
          </div>
        </div>

        {/* Properties */}
        {Object.keys(properties).length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Properties</p>
            <div className="flex flex-col gap-3">
              {Object.entries(properties).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between group">
                  <span className="text-sm text-gray-400 capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="text-sm text-gray-200 font-medium truncate max-w-[150px] text-right" title={cleanString(value)}>
                    {cleanString(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Connected Entities */}
        {connectedEntities.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">
              Connected Entities ({connectedEntities.length})
            </p>
            <div className="flex flex-col gap-4">
              {connectedEntities.map((conn, idx) => (
                <button 
                  key={idx}
                  onClick={() => setSelectedNode(conn.node)}
                  className="flex items-center gap-4 w-full text-left group"
                >
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 transition-colors"
                    style={{ backgroundColor: (conn.node.color || '#64748b') + '30', color: conn.node.color || '#94a3b8' }}
                  >
                    {getInitial(conn.node.label, conn.node.id)}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-semibold text-gray-200 truncate group-hover:text-white transition-colors">
                      {cleanString(conn.node.label || conn.node.id)}
                    </span>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wide truncate mt-0.5">
                      {conn.edgeType} • {conn.node.tag}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-300 transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
