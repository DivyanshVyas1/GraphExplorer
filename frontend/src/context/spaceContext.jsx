import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSpacesService, getSpaceAnalyticsService } from '../services/space';

const SpaceContext = createContext(null);

// Color palette assigned by index — each space gets a unique color
export const SPACE_COLORS = [
  { border: 'border-cyan-400',   glow: 'shadow-[0_0_24px_rgba(34,211,238,0.15)]',  analytics: 'from-[#062028] to-[#0d1b2a]', hex: '#22d3ee', cardBg: '#0a1e28',   cardBgActive: '#0c2535',   btn: '#22d3ee' },
  { border: 'border-green-400',  glow: 'shadow-[0_0_24px_rgba(74,222,128,0.15)]',  analytics: 'from-[#062010] to-[#0d1b14]', hex: '#4ade80', cardBg: '#0a1e12',   cardBgActive: '#0c2516',   btn: '#4ade80' },
  { border: 'border-orange-400', glow: 'shadow-[0_0_24px_rgba(251,146,60,0.15)]',  analytics: 'from-[#1e1000] to-[#1a1200]', hex: '#f59e0b', cardBg: '#1a1100',   cardBgActive: '#201500',   btn: '#f59e0b' },
  { border: 'border-purple-400', glow: 'shadow-[0_0_24px_rgba(192,132,252,0.15)]', analytics: 'from-[#160a2e] to-[#0d0d1e]', hex: '#c084fc', cardBg: '#130a26',   cardBgActive: '#180c30',   btn: '#c084fc' },
  { border: 'border-pink-400',   glow: 'shadow-[0_0_24px_rgba(244,114,182,0.15)]', analytics: 'from-[#28061a] to-[#1a0d14]', hex: '#f472b6', cardBg: '#200816',   cardBgActive: '#280a1c',   btn: '#f472b6' },
  { border: 'border-blue-400',   glow: 'shadow-[0_0_24px_rgba(96,165,250,0.15)]',  analytics: 'from-[#061428] to-[#0a0e20]', hex: '#60a5fa', cardBg: '#081222',   cardBgActive: '#0a1828',   btn: '#60a5fa' },
];

export function SpaceProvider({ children }) {
  const [spaces, setSpaces] = useState([]);
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [selectedColor, setSelectedColor] = useState(SPACE_COLORS[0]);
  const [analytics, setAnalytics] = useState(null);
  const [loadingSpaces, setLoadingSpaces] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const fetchSpaces = useCallback(async () => {
    setLoadingSpaces(true);
    try {
      const data = await getSpacesService();
      setSpaces(data);
      if (data.length > 0 && !selectedSpace) {
        setSelectedSpace(data[0].id);
        setSelectedColor(SPACE_COLORS[0]);
      }
    } catch (err) {
      console.error("Failed to fetch spaces", err);
    } finally {
      setLoadingSpaces(false);
    }
  }, [selectedSpace]);

  // Fetch spaces on mount
  useEffect(() => {
    fetchSpaces();
  }, []);

  // Fetch analytics when selected space changes
  useEffect(() => {
    if (!selectedSpace) return;
    const fetchAnalytics = async () => {
      setLoadingAnalytics(true);
      try {
        const data = await getSpaceAnalyticsService(selectedSpace);
        setAnalytics(data);
      } catch (err) {
        console.error("Failed to fetch analytics", err);
        setAnalytics(null);
      } finally {
        setLoadingAnalytics(false);
      }
    };
    fetchAnalytics();
  }, [selectedSpace]);

  const selectSpace = useCallback((spaceId, colorIndex) => {
    setSelectedSpace(spaceId);
    setSelectedColor(SPACE_COLORS[colorIndex % SPACE_COLORS.length]);
  }, []);

  return (
    <SpaceContext.Provider value={{
      spaces,
      selectedSpace,
      selectedColor,
      analytics,
      loadingSpaces,
      loadingAnalytics,
      selectSpace,
      refetchSpaces: fetchSpaces
    }}>
      {children}
    </SpaceContext.Provider>
  );
}

export function useSpace() {
  const ctx = useContext(SpaceContext);
  if (!ctx) throw new Error('useSpace must be used inside SpaceProvider');
  return ctx;
}
