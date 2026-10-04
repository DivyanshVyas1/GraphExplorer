import axios from "axios";

const API = axios.create({
  baseURL: "/api", // Vite proxy will forward this to http://localhost:8080/api
  withCredentials: true,  
  headers: {
    "Content-Type": "application/json",
  },
});

export default API;
