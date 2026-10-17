import axios from "axios";

// Login/signup/google legitimately return 401 for bad credentials — never treat
// those as an expired session.
const AUTH_ROUTES = /\/auth\/(login|signup|verify-email|resend-code|google)\b/;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const url = err.config?.url || "";
    if (status === 401 && !AUTH_ROUTES.test(url) && localStorage.getItem("token")) {
      localStorage.removeItem("token");
      window.dispatchEvent(new Event("fintrack:unauthorized"));
    }
    return Promise.reject(err);
  }
);

export default api;
