import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

export default function PropertyPanel({ element, onClose }) {
  
  // Local state for fast typing, syncs to context on blur/change
  const [label, setLabel] = useState('');
  const [comment, setComment] = useState('');
  const [properties, setProperties] = useState([]);

  useEffect(() => {
    if (element) {
      setLabel(element.data?.label || '');
      setComment(element.data?.comment || '');
      setProperties(element.data?.properties || []);
    }
  }, [element]);

  const updateElementData = (newData) => {
    if (element.updateData) {
      element.updateData(newData);
    }
  };

  const handleAddProperty = () => {
    const newProps = [...properties, { name: '', type: 'string', defaultValue: '' }];
    setProperties(newProps);
    updateElementData({ properties: newProps });
  };

  const handlePropertyChange = (index, field, value) => {
    const newProps = [...properties];
    newProps[index][field] = value;
    setProperties(newProps);
    updateElementData({ properties: newProps });
  };

  const handleDeleteProperty = (index) => {
    const newProps = properties.filter((_, i) => i !== index);
    setProperties(newProps);
    updateElementData({ properties: newProps });
  };

  const handleDeleteElement = () => {
    if (element.deleteElement) {
      element.deleteElement();
    }
    onClose();
  };

  return (
    <div className="w-80 bg-[#161b22] border-l border-white/5 h-full flex flex-col shrink-0 animate-in slide-in-from-right-4 duration-200">
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <h3 className="text-gray-200 font-bold capitalize">{element.type} Details</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        
        {/* Basic Info */}
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-red-400 font-bold mb-1 block">* {element.type === 'node' ? 'Tag' : 'Edge'} Name</label>
            <input 
              className="w-full bg-[#0d1117] border border-white/10 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cyan-500"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                updateElementData({ label: e.target.value });
              }}
              placeholder="e.g. player"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-bold mb-1 block">Comment</label>
            <textarea 
              className="w-full bg-[#0d1117] border border-white/10 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cyan-500 resize-none h-20"
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                updateElementData({ comment: e.target.value });
              }}
            />
          </div>
        </div>

        {/* Properties */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-gray-300">Properties</h4>
            <button 
              onClick={handleAddProperty}
              className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-xs font-semibold"
            >
              <Plus className="w-3 h-3" /> Add Property
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {properties.map((prop, idx) => (
              <div key={idx} className="bg-[#0d1117] border border-white/5 p-3 rounded-lg flex flex-col gap-2 relative group">
                <button 
                  onClick={() => handleDeleteProperty(idx)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
                <input 
                  placeholder="Property Name"
                  className="bg-transparent border-b border-white/10 px-1 py-1 text-sm text-gray-200 focus:outline-none focus:border-cyan-500"
                  value={prop.name}
                  onChange={(e) => handlePropertyChange(idx, 'name', e.target.value)}
                />
                <select 
                  className="bg-[#161b22] border border-white/10 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none"
                  value={prop.type}
                  onChange={(e) => handlePropertyChange(idx, 'type', e.target.value)}
                >
                  <option value="string">string</option>
                  <option value="int">int</option>
                  <option value="double">double</option>
                  <option value="bool">bool</option>
                  <option value="timestamp">timestamp</option>
                </select>
              </div>
            ))}
            {properties.length === 0 && (
              <div className="text-xs text-gray-500 italic text-center py-4">No properties added.</div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-white/5">
        <button 
          onClick={handleDeleteElement}
          className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded py-2 text-sm font-bold transition-colors"
        >
          <Trash2 className="w-4 h-4" /> Delete {element.type}
        </button>
      </div>
    </div>
  );
}
