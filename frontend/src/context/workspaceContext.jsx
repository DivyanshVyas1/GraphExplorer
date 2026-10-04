import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useWs } from './wsContext';
import { useSpace } from './spaceContext';

const WorkspaceContext = createContext(null);

// Tag colors — index se assign hote hain
export const TAG_COLORS = ['#22d3ee', '#4ade80', '#fb923c', '#c084fc', '#f472b6', '#60a5fa', '#fbbf24', '#34d399'];

export function WorkspaceProvider({ children }) {
  const { sendQuery } = useWs();
  const { spaces } = useSpace();

  // Query Tabs state
  const [tabs, setTabs] = useState([
    { id: '1', name: 'query_1.cql', content: 'MATCH (n)-[r]->(m)\nRETURN n, r, m\nLIMIT 25', result: null, executionTime: 0 },
    { id: '2', name: 'query_2.cql', content: 'MATCH (a)-[r1]->(b)-[r2]->(c)\nRETURN a, r1, b, r2, c\nLIMIT 30', result: null, executionTime: 0 }
  ]);
  const [activeTabId, setActiveTabId] = useState('1');

  const activeTab = tabs.find(t => t.id === activeTabId);
  const activeQuery = activeTab?.content ?? '';
  const result = activeTab?.result ?? null;
  const executionTime = activeTab?.executionTime ?? 0;

  const addTab = useCallback(() => {
    const newId = crypto.randomUUID();
    const newTab = {
      id: newId,
      name: `query_${tabs.length + 1}.cql`,
      content: '',
      result: null,
      executionTime: 0
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
  }, [tabs.length]);

  const closeTab = useCallback((id) => {
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== id);
      if (newTabs.length === 0) {
        const newId = crypto.randomUUID();
        setActiveTabId(newId);
        return [{ id: newId, name: 'query_1.cql', content: '', result: null, executionTime: 0 }];
      }
      if (activeTabId === id) {
        setActiveTabId(newTabs[newTabs.length - 1].id);
      }
      return newTabs;
    });
  }, [activeTabId]);

  const setQuery = useCallback((content) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, content } : t));
  }, [activeTabId]);
  const [isRunning, setIsRunning] = useState(false);

  // Result state variables
  const [activeView, setActiveView] = useState('graph'); // 'graph' | 'table' | 'json'
  const [selectedNode, setSelectedNode] = useState(null);

  // Sidebar state
  const [selectedSpace, setSelectedSpace] = useState('');
  const [tags, setTags] = useState([]);         // [{name, color, visible}]
  const [edgeTypes, setEdgeTypes] = useState([]); // [{name, visible}]

  // Jab space change ho — SHOW TAGS + SHOW EDGES fetch karo
  const handleSpaceSelect = useCallback(async (spaceName) => {
    setSelectedSpace(spaceName);
    setTabs(prev => prev.map(t => ({ ...t, result: null, executionTime: 0 })));
    setSelectedNode(null);
    try {
      const [tagsRes, edgesRes] = await Promise.all([
        sendQuery({ space: spaceName, gqls: ['SHOW TAGS;'], msgType: 'ngql' }),
        sendQuery({ space: spaceName, gqls: ['SHOW EDGES;'], msgType: 'ngql' }),
      ]);

      const cleanName = (name) => {
        if (typeof name !== 'string') return String(name);
        return name.replace(/^["']|["']$/g, '');
      };

      const tagNames = tagsRes?.results?.[0]?.rows?.map(r => cleanName(r[0])) ?? [];
      const edgeNames = edgesRes?.results?.[0]?.rows?.map(r => cleanName(r[0])) ?? [];

      setTags(tagNames.map((name, i) => ({
        name,
        color: TAG_COLORS[i % TAG_COLORS.length],
        visible: true,
      })));
      setEdgeTypes(edgeNames.map(name => ({ name, visible: true })));
    } catch (e) {
      console.error('Schema fetch failed:', e);
    }
  }, [sendQuery]);

  // Query run karo
  const runQuery = useCallback(async () => {
    if (!activeQuery.trim() || isRunning) return;
    if (!selectedSpace) {
      alert("Select space first");
      return;
    }
    setIsRunning(true);
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, result: null, executionTime: 0 } : t));
    setSelectedNode(null);
    const start = Date.now();
    try {
      const res = await sendQuery({
        space: selectedSpace,
        gqls: [activeQuery.trim()],
        msgType: 'batch_ngql',
      });
      const timeTaken = Date.now() - start;
      const queryResult = res?.results?.[0];
      
      let newResult = null;
      if (queryResult?.error) {
        newResult = { error: queryResult.error, nodes: [], edges: [], rows: [], columns: [] };
      } else {
        // Tag colors ko nodes mein inject karo
        const tagColorMap = Object.fromEntries(tags.map(t => [t.name, t.color]));
        const nodes = (queryResult?.graph?.nodes ?? []).map(n => ({
          ...n,
          color: tagColorMap[n.tag] ?? '#64748b',
        }));
        newResult = {
          nodes,
          edges: queryResult?.graph?.edges ?? [],
          rows:  queryResult?.rows ?? [],
          columns: queryResult?.columns ?? [],
          error: null,
        };
      }
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, result: newResult, executionTime: timeTaken } : t));
    } catch (e) {
      const errorResult = { error: e.message, nodes: [], edges: [], rows: [], columns: [] };
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, result: errorResult, executionTime: Date.now() - start } : t));
    } finally {
      setIsRunning(false);
    }
  }, [activeQuery, selectedSpace, activeTabId, isRunning, sendQuery, tags]);

  const toggleTag = useCallback((name) => {
    setTags(prev => prev.map(t => t.name === name ? { ...t, visible: !t.visible } : t));
  }, []);

  const toggleEdgeType = useCallback((name) => {
    setEdgeTypes(prev => prev.map(e => e.name === name ? { ...e, visible: !e.visible } : e));
  }, []);

  return (
    <WorkspaceContext.Provider value={{
      query: activeQuery, setQuery,
      tabs, activeTabId, setActiveTabId, addTab, closeTab,
      isRunning, runQuery,
      result,
      activeView, setActiveView,
      selectedNode, setSelectedNode,
      selectedSpace, handleSpaceSelect,
      tags, toggleTag,
      edgeTypes, toggleEdgeType,
      executionTime,
      spaces,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be inside WorkspaceProvider');
  return ctx;
}
