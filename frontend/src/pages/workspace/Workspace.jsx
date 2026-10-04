import { useState, useCallback } from 'react';
import { WorkspaceProvider } from '../../context/workspaceContext';
import LeftSidebar from '../../components/workspace/LeftSidebar';
import QueryEditor from '../../components/workspace/QueryEditor';
import ResultTabs from '../../components/workspace/ResultTabs';
import RightSidebar from '../../components/workspace/RightSidebar';
import StatusBar from '../../components/workspace/StatusBar';
import Navbar from '../../components/layout/Navbar';

export default function Workspace() {
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [editorHeight, setEditorHeight] = useState(40); // percentage

  // Sidebar drag handler
  const handleSidebarDrag = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (moveEvent) => {
      const newWidth = Math.max(200, Math.min(startWidth + (moveEvent.clientX - startX), 600));
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
  }, [sidebarWidth]);

  // Editor drag handler
  const handleEditorDrag = useCallback((e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = editorHeight;
    const containerHeight = e.target.parentElement.clientHeight;

    const onMouseMove = (moveEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const deltaPercent = (deltaY / containerHeight) * 100;
      const newHeight = Math.max(10, Math.min(startHeight + deltaPercent, 80));
      setEditorHeight(newHeight);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'row-resize';
  }, [editorHeight]);

  return (
    <WorkspaceProvider>
      <div className="flex flex-col h-screen" style={{ background: '#0d1117' }}>
        <Navbar />

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar */}
          <LeftSidebar width={sidebarWidth} />

          {/* Vertical Resizer */}
          <div
            onMouseDown={handleSidebarDrag}
            className="w-1 cursor-col-resize hover:bg-cyan-500/50 bg-white/5 transition-colors z-10 shrink-0"
            title="Drag to resize sidebar"
          />

          {/* Center Column */}
          <div className="flex flex-col flex-1 overflow-hidden relative">
            {/* Query Editor */}
            <div style={{ height: `${editorHeight}%` }} className="shrink-0 flex flex-col">
              <QueryEditor />
            </div>

            {/* Horizontal Resizer */}
            <div
              onMouseDown={handleEditorDrag}
              className="h-1 cursor-row-resize hover:bg-cyan-500/50 bg-white/5 transition-colors z-10 shrink-0"
              title="Drag to resize editor"
            />

            {/* Results */}
            <div className="flex-1 overflow-hidden flex flex-col relative">
              <ResultTabs />
            </div>
          </div>

          <RightSidebar />
        </div>

        <StatusBar />
      </div>
    </WorkspaceProvider>
  );
}

