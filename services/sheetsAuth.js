self.SPM = self.SPM || {};

// --- Cross-browser Google OAuth (works on Chrome, Edge, Brave, etc.) ---
// chrome.identity.getAuthToken() only exists on Chrome, since it reads the
// Google account signed into the browser profile directly. Edge (and other
// Chromium browsers) don't implement it. chrome.identity.launchWebAuthFlow()
// is the one identity method that's part of the actual spec and works
// everywhere, so we use that instead, with our own small token cache on top
// (launchWebAuthFlow has no built-in caching the way getAuthToken did).

const SPM_CLIENT_ID = "853824720939-uf2dneomk7s49aecikc661ctkb12d1uk.apps.googleusercontent.com";
const SPM_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];
const TOKEN_STORAGE_KEY = "spm_auth_token";
const EXPIRY_BUFFER_MS = 60 * 1000; // refresh a little before actual expiry

function readCachedToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get([TOKEN_STORAGE_KEY], (result) => {
      const cached = result[TOKEN_STORAGE_KEY];
      if (cached && cached.token && cached.expiresAt > Date.now() + EXPIRY_BUFFER_MS) {
        resolve(cached.token);
      } else {
        resolve(null);
      }
    });
  });
}

function writeCachedToken(token, expiresInSeconds) {
  return new Promise((resolve) => {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    chrome.storage.local.set({ [TOKEN_STORAGE_KEY]: { token, expiresAt } }, resolve);
  });
}

function clearCachedTokenStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.remove([TOKEN_STORAGE_KEY], resolve);
  });
}

// Runs Google's OAuth implicit flow in a browser-native auth tab/popup.
// interactive=false tries to complete silently (no UI) using prompt=none;
// this only succeeds if the user already has an active Google session and
// has previously consented, otherwise it errors out and the caller should
// retry with interactive=true.
function runWebAuthFlow(interactive) {
  return new Promise((resolve, reject) => {
    const redirectUri = chrome.identity.getRedirectURL();
    // Prints the exact redirect URI this browser/install is using. If Google
    // ever rejects sign-in with "redirect_uri_mismatch", this is the exact
    // string that needs to be added to the OAuth client's Authorized
    // redirect URIs in Google Cloud Console.
    console.log("[SPM] OAuth redirect URI for this install:", redirectUri);
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", SPM_CLIENT_ID);
    authUrl.searchParams.set("response_type", "token");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", SPM_SCOPES.join(" "));
    authUrl.searchParams.set("prompt", interactive ? "consent" : "none");

    chrome.identity.launchWebAuthFlow(
      { url: authUrl.toString(), interactive },
      (responseUrl) => {
        if (chrome.runtime.lastError || !responseUrl) {
          reject(
            chrome.runtime.lastError ||
              new Error("Google sign-in was cancelled or failed.")
          );
          return;
        }

        let params;
        try {
          const hash = new URL(responseUrl).hash.replace(/^#/, "");
          params = new URLSearchParams(hash);
        } catch (e) {
          reject(new Error("Could not parse Google's sign-in response."));
          return;
        }

        const token = params.get("access_token");
        const expiresIn = parseInt(params.get("expires_in") || "3600", 10);
        const error = params.get("error");

        if (error || !token) {
          reject(new Error(error || "No access token returned from Google."));
          return;
        }

        resolve({ token, expiresIn });
      }
    );
  });
}

// Public: returns a valid token, reusing a cached one when possible so the
// user isn't re-prompted on every send. interactive=true allows the
// sign-in tab to appear the first time / once the cached token expires.
async function getAuthToken(interactive = true) {
  const cached = await readCachedToken();
  if (cached) return cached;

  const { token, expiresIn } = await runWebAuthFlow(interactive);
  await writeCachedToken(token, expiresIn);
  return token;
}

// Clears the cached token so the next getAuthToken() call re-authenticates.
async function clearAuthToken(token) {
  await clearCachedTokenStorage();
}

SPM.getAuthToken = getAuthToken;
SPM.clearAuthToken = clearAuthToken;
