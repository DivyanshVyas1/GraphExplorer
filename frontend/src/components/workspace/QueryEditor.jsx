import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { useWorkspace } from '../../context/workspaceContext';
import { Play, Terminal, FileText, Plus, X } from 'lucide-react';

// nGQL extra keywords joh SQL mein nahi hain
const NGQL_KEYWORDS = [
  'MATCH', 'RETURN', 'WHERE', 'LIMIT', 'ORDER', 'BY', 'WITH',
  'GO', 'FROM', 'OVER', 'YIELD', 'FETCH', 'PROP', 'ON',
  'LOOKUP', 'USE', 'SHOW', 'TAGS', 'EDGES', 'SPACES', 'HOSTS',
  'CREATE', 'DROP', 'INSERT', 'DELETE', 'UPDATE', 'VERTEX', 'EDGE',
  'OPTIONAL', 'UNION', 'ALL', 'AS', 'IN', 'NOT', 'AND', 'OR',
  'TRUE', 'FALSE', 'NULL', 'DISTINCT', 'REVERSELY', 'BIDIRECT',
];

// CodeMirror editor style override
const editorStyle = {
  height: '100%',
  fontSize: '14px',
  fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
};

export default function QueryEditor() {
  const { query, setQuery, runQuery, isRunning, tabs, activeTabId, setActiveTabId, addTab, closeTab } = useWorkspace();

  const handleKeyDown = (e) => {
    // Ctrl+Enter ya Cmd+Enter se query run karo
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      runQuery();
    }
  };

  return (
    <div className="flex flex-col h-full border-b border-white/5" onKeyDown={handleKeyDown}>

      {/* Editor Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 shrink-0" style={{ background: '#161b22' }}>
        <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold tracking-wider uppercase">
          <Terminal className="w-4 h-4 text-gray-400" />
          Query Editor
        </div>
        <button
          onClick={runQuery}
          disabled={isRunning}
          className={`flex items-center gap-2 px-4 py-1.5 rounded text-sm font-bold transition-all
            ${isRunning
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-transparent border border-white/20 text-white hover:bg-white/5 hover:border-white/30'
            }`}
        >
          {isRunning ? (
            <>
              <span className="w-3 h-3 border-2 border-gray-500 border-t-white rounded-full animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="w-3 h-3 fill-white" />
              RUN
            </>
          )}
        </button>
      </div>

      {/* Editor Header Row 2: Tabs */}
      <div className="flex items-center bg-[#0d1117] border-b border-white/5 overflow-x-auto scrollbar-hide shrink-0">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 cursor-pointer border-r border-white/5 group relative transition-colors
                ${isActive ? 'bg-[#000000]' : 'hover:bg-white/5'}
              `}
            >
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#00e5ff]" />
              )}
              <FileText className={`w-3.5 h-3.5 ${isActive ? 'text-[#00e5ff]' : 'text-gray-500'}`} />
              <span className={`text-sm font-mono truncate max-w-[200px] ${isActive ? 'text-gray-200' : 'text-gray-500'}`}>
                {tab.name}
              </span>
              
              <button 
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                className={`p-0.5 rounded hover:bg-white/10 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity ml-2`}
              >
                <X className="w-3.5 h-3.5 text-gray-400 hover:text-white" />
              </button>
            </div>
          );
        })}
        
        {/* Add Tab Button */}
        <button
          onClick={addTab}
          className="p-2 ml-1 text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors"
          title="New Query Tab"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* CodeMirror Editor */}
      <div className="flex-1 overflow-hidden">
        <CodeMirror
          value={query}
          height="100%"
          theme={oneDark}
          extensions={[
            sql({
              upperCaseKeywords: true
            }),
          ]}
          onChange={setQuery}
          style={editorStyle}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightSpecialChars: true,
            foldGutter: false,
            drawSelection: true,
            dropCursor: true,
            allowMultipleSelections: false,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            rectangularSelection: false,
            crosshairCursor: false,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            closeBracketsKeymap: true,
            searchKeymap: false,
          }}
        />
      </div>

      {/* Hint */}
      <div className="px-4 py-2 shrink-0 bg-white/5 backdrop-blur-2xl border-t border-b border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.1)] relative z-10">
        <span className="text-[11px] text-gray-400 font-medium tracking-wide">
          Press <kbd className="bg-black/40 px-1.5 py-0.5 rounded text-cyan-400 shadow-inner border border-white/10">Ctrl+Enter</kbd> to run
        </span>
      </div>
    </div>
  );
}
