import { useState, useCallback } from 'react';
import DraftSidebar from '../../components/schema_draft/DraftSidebar';
import D3Canvas from '../../components/schema_draft/D3Canvas';
import PropertyPanel from '../../components/schema_draft/PropertyPanel';
import NgqlPreviewModal from '../../components/schema_draft/NgqlPreviewModal';
import Navbar from '../../components/layout/Navbar';

export default function SchemaDraft() {
  const [selectedElement, setSelectedElement] = useState(null); // { type: 'node' | 'edge', id: string, data: object }
  
  const handleSelect = useCallback((type, id, data, updateData, deleteElement) => {
    if (type) {
      setSelectedElement({ type, id, data, updateData, deleteElement });
    } else {
      setSelectedElement(null);
    }
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedElement(null);
  }, []);

  return (
    <div className="flex flex-col h-screen" style={{ background: '#0d1117' }}>
      <Navbar />
      <div className="flex flex-1 overflow-hidden text-gray-200">
        <DraftSidebar />
        <div className="flex-1 relative flex">
          <D3Canvas onSelect={handleSelect} />
          {selectedElement && (
            <PropertyPanel 
              element={selectedElement} 
              onClose={handleClosePanel} 
            />
          )}
        </div>
      </div>
      {/* nGQL Preview Modal — rendered at page root so it sits above everything */}
      <NgqlPreviewModal />
    </div>
  );
}
