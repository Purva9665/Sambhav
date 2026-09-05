import axios from 'axios';

export const TOKEN_KEY = 'sambhav_token';
export const USER_KEY = 'sambhav_user';

/** Broadcast so AuthContext can tear down React state, not just localStorage. */
export const SESSION_EXPIRED = 'sambhav:session-expired';

/** Fired while a request is waiting on a sleeping server, so the UI can say so. */
export const SERVER_WAKING = 'sambhav:server-waking';

const base = import.meta.env.VITE_API_URL?.replace(/\/+$/, '');

/**
 * Render's free tier stops the API after 15 minutes idle and takes roughly
 * 30–60 seconds to start it again. A short timeout turns that into "the server
 * took too long to respond" on the first sign-in after any break, so the
 * ceiling is generous enough to cover a cold start.
 */
const COLD_START_MS = 60000;

/** How long before we tell the user the server is waking rather than broken. */
const WAKING_NOTICE_MS = 4000;

const axiosClient = axios.create({
  baseURL: base ? `${base}/api/v1` : '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: COLD_START_MS
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // A request that is merely slow is almost always a sleeping server, not a
  // broken one. Say that instead of leaving a silent spinner.
  config.__wakingTimer = setTimeout(() => {
    window.dispatchEvent(new CustomEvent(SERVER_WAKING));
  }, WAKING_NOTICE_MS);

  return config;
});

const clearWakingTimer = (config) => {
  if (config?.__wakingTimer) clearTimeout(config.__wakingTimer);
};

axiosClient.interceptors.response.use(
  (response) => {
    clearWakingTimer(response.config);
    return response.data;
  },
  (error) => {
    clearWakingTimer(error.config);

    const status = error.response?.status;
    const payload = error.response?.data;

    // A dead or expired token must log the UI out, not just clear storage.
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
      return Promise.reject({
        message:
          'The server is still starting up. This happens after a period of ' +
          'inactivity and takes about a minute. Please try again.'
      });
    }

    return Promise.reject(
      payload || { message: 'Could not reach the server. Check your connection and try again.' }
    );
  }
);

/**
 * Wake the API without blocking anything.
 *
 * Called as soon as the app loads so the server is starting while the user is
 * still typing their password, instead of the first real request paying the
 * full cold-start cost. Failure is expected and ignored.
 */
export function warmUpServer() {
  const url = base ? `${base}/api/v1/health` : '/api/v1/health';
  fetch(url, { method: 'GET', cache: 'no-store' }).catch(() => {});
}

export default axiosClient;
