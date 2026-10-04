import Navbar from '../../components/layout/Navbar';
import { Network, Upload, PenTool } from 'lucide-react';

const DATASET_CARDS = [
  {
    id: 'schema',
    title: 'Schema',
    description: 'You can use the Schema page to operate graph spaces in NebulaGraph',
    Icon: Network,
  },
  {
    id: 'import',
    title: 'Import Data',
    description: 'You can use the Import page to batch import vertex and edge data into NebulaGraph for graph exploration and data analysis.',
    Icon: Upload,
  },
  {
    id: 'draft',
    title: 'Draft Schema',
    description: 'You can design your schemas on the canvas to visually display the relationships between vertices and edges.',
    Icon: PenTool,
  },
];

export default function Datasets() {
  return (
    <div className="flex flex-col h-screen bg-[#0d1117]">
      <Navbar />
      
      <div className="flex-1 overflow-auto p-10">
        <div className="max-w-7xl mx-auto flex flex-col pt-4">
          
          {/* Welcome Header */}
          <div className="flex items-center justify-between mb-12">
            <h1 className="text-[40px] text-white font-light tracking-wide">
              Welcome to <span className="font-bold">Graph Explorer</span>
            </h1>
          </div>

          {/* Functions Introduction Divider */}
          <div className="border-b border-white/10 pb-3 mb-10">
            <h3 className="text-xs font-bold text-gray-400 tracking-[0.15em] uppercase">
              Functions Introduction
            </h3>
          </div>

          {/* Cards */}
          <div className="flex gap-6 justify-center">
          {DATASET_CARDS.map((card) => (
            <div 
              key={card.id} 
              className="bg-[#161b22] border border-white/5 rounded-xl p-8 flex flex-col w-[380px] hover:border-white/10 transition-colors shadow-lg"
            >
              <div className="mb-6">
                <card.Icon className="w-8 h-8 text-[#00e5ff] stroke-[2.5]" />
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-4 tracking-wide">{card.title}</h2>
              
              <p className="text-sm text-gray-400 leading-relaxed mb-10 flex-1">
                {card.description}
              </p>
              
              <div className="flex gap-4 mt-auto">
                <button className="cursor-pointer bg-[#00e5ff] hover:bg-[#00cce6] text-black font-bold py-2.5 px-8 rounded-sm transition-colors text-sm w-32">
                  Start
                </button>
                <button className="cursor-pointer border border-[#00e5ff] text-[#00e5ff] hover:bg-[#00e5ff]/10 font-bold py-2.5 px-6 rounded-sm transition-colors text-sm w-32">
                  Documents
                </button>
              </div>
            </div>
          ))}
          </div>
        </div>
      </div>
    </div>
  );
}
