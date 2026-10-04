import { useWorkspace } from '../../context/workspaceContext';
import { useWs } from '../../context/wsContext';

export default function StatusBar() {
  const { result, selectedSpace, executionTime } = useWorkspace();
  const { isConnected, isConnecting } = useWs();

  const nodeCount = result?.nodes?.length ?? 0;
  const edgeCount = result?.edges?.length ?? 0;

  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-t border-white/5 bg-[#0a0e14] shrink-0">
      {/* Left — connection status */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${
          isConnecting ? 'bg-yellow-400 animate-pulse' :
          isConnected  ? 'bg-green-400' : 'bg-red-500'
        }`} />
        <span className="text-[11px] text-gray-500 font-mono">
          {isConnecting ? 'CONNECTING...' : isConnected ? `CONNECTED${selectedSpace ? `: ${selectedSpace.toUpperCase()}` : ''}` : 'DISCONNECTED'}
        </span>
      </div>

      {/* Center — result stats */}
      {result && !result.error && (
        <span className="text-[11px] text-gray-500 font-mono">
          RETURNED {nodeCount} NODES, {edgeCount} EDGES IN {executionTime}MS
        </span>
      )}
      {result?.error && (
        <span className="text-[11px] text-red-500 font-mono">QUERY ERROR</span>
      )}

      {/* Right */}
      <div className="flex items-center gap-4">
        <span className="text-[11px] text-gray-600 font-mono">UTF-8</span>
        <span className="text-[11px] text-gray-600 font-mono">⚡ ENGINE V2.0</span>
      </div>
    </div>
  );
}
