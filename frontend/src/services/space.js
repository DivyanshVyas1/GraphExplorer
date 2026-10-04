import API from './api';

export const getSpacesService = async () => {
  const res = await API.get('/spaces');
  return res.data; // List of spaces with node/edge counts
};

export const getSpaceAnalyticsService = async (spaceName) => {
  const res = await API.get(`/spaces/${spaceName}/analytics`);
  return res.data; // Detailed analytics (tags, edgeTypes, totalNodes)
};
