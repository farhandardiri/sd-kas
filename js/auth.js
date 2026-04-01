// ========================================
// MODUL AUTHENTICATION
// ========================================

let tokenClient = null;
let gapiInited = false;
let gisInited = false;
let accessToken = null;

// Konfigurasi dari window.CONFIG
const getConfig = () => window.CONFIG;

export function isAuthenticated() {
  return accessToken !== null && gapi.client.getToken() !== null;
}

export function getAccessToken() {
  return accessToken;
}

export function gapiLoaded() {
  gapi.load("client", initializeGapiClient);
}

async function initializeGapiClient() {
  const config = getConfig();
  await gapi.client.init({
    apiKey: config.API_KEY,
    discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
  });
  gapiInited = true;

  // Cek apakah sudah ada token yang tersimpan
  const token = gapi.client.getToken();
  if (token) {
    accessToken = token.access_token;
    await updateSigninStatus(true);
    if (window.onAuthStateChange) {
      window.onAuthStateChange(true);
    }
  }
}

export function gisLoaded() {
  const config = getConfig();
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: config.CLIENT_ID,
    scope: config.SCOPES,
    callback: "", // defined later
  });
  gisInited = true;
}

export async function handleAuthClick() {
  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) {
      throw resp;
    }
    accessToken = gapi.client.getToken().access_token;
    await updateSigninStatus(true);
    if (window.onAuthStateChange) {
      window.onAuthStateChange(true);
    }
  };

  if (gapi.client.getToken() === null) {
    tokenClient.requestAccessToken({ prompt: "consent" });
  } else {
    tokenClient.requestAccessToken({ prompt: "" });
  }
}

export function handleSignoutClick() {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken("");
    accessToken = null;
  }
  updateSigninStatus(false);
  if (window.onAuthStateChange) {
    window.onAuthStateChange(false);
  }
}

async function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    document.getElementById("loginSection").style.display = "none";
    document.getElementById("userSection").style.display = "block";

    // Tampilkan info user default
    document.getElementById("userName").textContent = ":)";
    document.getElementById("userAvatar").src =
      "https://ui-avatars.com/api/?background=4285f4&color=fff&bold=true&size=32&name=U";
  } else {
    document.getElementById("loginSection").style.display = "block";
    document.getElementById("userSection").style.display = "none";
  }
}

export function enableEditButtons() {
  document
    .querySelectorAll('[id^="btnAdd"]')
    .forEach((btn) => (btn.disabled = false));
}

export function disableEditButtons() {
  document
    .querySelectorAll('[id^="btnAdd"]')
    .forEach((btn) => (btn.disabled = true));
}

// Initialize on load
export function initAuth() {
  const script1 = document.createElement("script");
  script1.src = "https://apis.google.com/js/api.js";
  script1.onload = gapiLoaded;
  document.body.appendChild(script1);

  const script2 = document.createElement("script");
  script2.src = "https://accounts.google.com/gsi/client";
  script2.onload = gisLoaded;
  document.body.appendChild(script2);
}
