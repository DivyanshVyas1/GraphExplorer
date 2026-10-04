import axios from 'axios';

const API_URL = '/api/drafts'; // Uses Nginx proxy to route to backend

export const draftApi = {
  getDrafts: async () => {
    const response = await axios.get(`${API_URL}/`);
    return response.data;
  },

  getDraftById: async (id) => {
    const response = await axios.get(`${API_URL}/${id}`);
    return response.data;
  },

  createDraft: async (draftData) => {
    const response = await axios.post(`${API_URL}/`, draftData);
    return response.data;
  },

  updateDraft: async (id, draftData) => {
    const response = await axios.put(`${API_URL}/${id}`, draftData);
    return response.data;
  },

  deleteDraft: async (id) => {
    const response = await axios.delete(`${API_URL}/${id}`);
    return response.data;
  },
};
