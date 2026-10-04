import { useWorkspace } from '../../context/workspaceContext';
import GraphCanvas from './GraphCanvas';
import { GitBranch, Table2, Code2 } from 'lucide-react';

const TABS = [
  { id: 'graph', label: 'Graph', Icon: GitBranch },
  { id: 'table', label: 'Table', Icon: Table2 },
  { id: 'json',  label: 'JSON',  Icon: Code2 },
];

export default function ResultTabs() {
  const { activeView, setActiveView, result } = useWorkspace();

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Tab Bar */}
      <div className="flex items-center gap-1 px-4 border-b border-white/5 shrink-0" style={{ background: '#161b22' }}>
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveView(id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-all
              ${activeView === id
                ? 'text-white border-cyan-400'
                : 'text-gray-500 border-transparent hover:text-gray-300'}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">

        {/* Graph View */}
        {activeView === 'graph' && <GraphCanvas />}

        {/* Table View */}
        {activeView === 'table' && (
          <div className="h-full overflow-auto p-4">
            {!result ? (
              <Empty />
            ) : result.error ? (
              <Error msg={result.error} />
            ) : result.rows.length === 0 ? (
              <p className="text-gray-500 text-sm">No rows returned.</p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    {result.columns.map(col => (
                      <th key={col} className="text-left px-3 py-2 text-gray-400 font-semibold border-b border-white/5 text-xs uppercase tracking-wider">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      {(Array.isArray(row) ? row : [row]).map((cell, j) => (
                        <td key={j} className="px-3 py-2 text-gray-300 font-mono text-xs max-w-xs truncate">
                          {typeof cell === 'object' ? JSON.stringify(cell) : String(cell ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* JSON View */}
        {activeView === 'json' && (
          <div className="h-full overflow-auto p-4">
            {!result ? <Empty /> : result.error ? <Error msg={result.error} /> : (
              <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const Empty = () => (
  <p className="text-gray-600 text-sm text-center mt-16">Run a query to see results</p>
);
const Error = ({ msg }) => (
  <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-4 text-red-400 text-sm font-mono">
    {msg}
  </div>
);
