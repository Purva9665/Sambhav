import axios from 'axios';

export const TOKEN_KEY = 'sambhav_token';
export const USER_KEY = 'sambhav_user';

/** Broadcast so AuthContext can tear down React state, not just localStorage. */
export const SESSION_EXPIRED = 'sambhav:session-expired';

const base = import.meta.env.VITE_API_URL?.replace(/\/+$/, '');

const axiosClient = axios.create({
  baseURL: base ? `${base}/api/v1` : '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    const payload = error.response?.data;

    // A dead or expired token must log the UI out, not just clear storage.
    // Previously the keys were removed but React state kept `user` set, so the
    // app looked signed in while every request 401'd.
    if (status === 401 || status === 403) {
      const hadToken = Boolean(localStorage.getItem(TOKEN_KEY));
      const authProblem =
        /token|session|expired|unauthenticated/i.test(payload?.message || '') || status === 401;

      if (hadToken && authProblem) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        window.dispatchEvent(new CustomEvent(SESSION_EXPIRED));
      }
    }

    if (error.code === 'ECONNABORTED') {
      return Promise.reject({ message: 'The server took too long to respond. Please try again.' });
    }

    return Promise.reject(
      payload || { message: 'Could not reach the server. Check your connection and try again.' }
    );
  }
);

export default axiosClient;
