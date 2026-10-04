import './SpaceAnalytics.css';
import { useSpace } from '../../context/spaceContext';

export default function SpaceAnalytics() {
  const { analytics, loadingAnalytics, selectedSpace, selectedColor } = useSpace();

  if (!selectedSpace) return null;

  const totalNodes = analytics?.totalNodes ?? 0;
  const totalEdges = analytics?.totalEdges ?? 0;
  const topTag = analytics?.tags?.[0]?.count ?? 0;
  const topTagName = analytics?.tags?.[0]?.name;

  const formatNumber = (num) => new Intl.NumberFormat('en-IN').format(num);

  return (
    <div
      className="w-full h-full rounded-xl border border-white/5 p-6 flex flex-col gap-4 transition-all duration-300"
      style={{
        background: `linear-gradient(135deg, ${selectedColor?.cardBgActive || '#0c2535'} 0%, #0d1117 100%)`,
        borderColor: `${selectedColor?.hex || '#22d3ee'}22`,
      }}
    >
      <h2 className="text-base font-bold text-white">Space Analytics</h2>

      {loadingAnalytics ? (
        <div className="flex gap-2 items-center text-gray-500 text-sm animate-pulse">
          Loading analytics...
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-8 mt-2">

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-500 tracking-widest uppercase">Total Nodes</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-3xl font-bold text-white">{formatNumber(totalNodes)}</span>
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-500 tracking-widest uppercase">Total Edges</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-3xl font-bold text-white">{formatNumber(totalEdges)}</span>
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-500 tracking-widest uppercase">
              {topTagName ? `Top Tag: ${topTagName}` : 'Tag Entities'}
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-3xl font-bold text-white">{formatNumber(topTag)}</span>
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>

        </div>
      )}

      {analytics?.note && (
        <p className="text-xs text-gray-600 mt-2 italic">{analytics.note}</p>
      )}
    </div>
  );
}
