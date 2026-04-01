// ========================================
// APLIKASI PEMBAYARAN KAS - VERSION 4
// DENGAN TOKEN STORAGE (1 JAM)
// ========================================

// ========================================
// KONFIGURASI
// ========================================
const CONFIG = {
  CLIENT_ID:
    "234199179091-nuofe0hvh5875afo8cqdttupsk4quh5a.apps.googleusercontent.com",
  API_KEY: "AIzaSyAhF8Z68x7r-NMaAqRUwx8N_4yCG0Vp6tE",
  SPREADSHEET_ID: "1fprxhZDORuUdVAIXHvalJYkLTPWuZ_aP50I3p2Lw4h0",
  SCOPES: "https://www.googleapis.com/auth/spreadsheets",
  TOKEN_EXPIRY_HOURS: 1, // Token berlaku 1 jam
};

// Sheet names
const SHEETS = {
  PERSONAL: "Personal",
  TAHUN: "Tahun",
  MASTER_KAS: "MasterKas",
  PEMBAYARAN: "Pembayaran",
};

// ========================================
// TOKEN MANAGEMENT
// ========================================

class TokenManager {
  constructor() {
    this.storageKey = "google_sheets_token";
    this.expiryKey = "google_sheets_token_expiry";
  }

  // Simpan token ke localStorage dengan expiry time
  saveToken(tokenData) {
    const expiryTime = new Date();
    expiryTime.setHours(expiryTime.getHours() + CONFIG.TOKEN_EXPIRY_HOURS);

    const tokenStore = {
      access_token: tokenData.access_token,
      token_type: tokenData.token_type,
      scope: tokenData.scope,
      expiry: expiryTime.toISOString(),
    };

    localStorage.setItem(this.storageKey, JSON.stringify(tokenStore));
    localStorage.setItem(this.expiryKey, expiryTime.toISOString());

    console.log("Token saved, expires at:", expiryTime.toLocaleString());
  }

  // Ambil token dari localStorage
  getToken() {
    const tokenStr = localStorage.getItem(this.storageKey);
    if (!tokenStr) return null;

    try {
      const token = JSON.parse(tokenStr);
      const expiry = new Date(token.expiry);
      const now = new Date();

      // Cek apakah token masih berlaku
      if (now < expiry) {
        console.log(
          "Token masih valid, expires in:",
          Math.floor((expiry - now) / 1000 / 60),
          "minutes",
        );
        return token;
      } else {
        console.log("Token sudah expired");
        this.clearToken();
        return null;
      }
    } catch (e) {
      console.error("Error parsing token:", e);
      this.clearToken();
      return null;
    }
  }

  // Hapus token dari localStorage
  clearToken() {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.expiryKey);
    console.log("Token cleared");
  }

  // Cek apakah token masih valid
  isTokenValid() {
    const token = this.getToken();
    return token !== null;
  }

  // Dapatkan sisa waktu token dalam menit
  getTokenRemainingMinutes() {
    const expiryStr = localStorage.getItem(this.expiryKey);
    if (!expiryStr) return 0;

    const expiry = new Date(expiryStr);
    const now = new Date();
    const remaining = (expiry - now) / 1000 / 60;

    return Math.max(0, Math.floor(remaining));
  }
}

// Inisialisasi TokenManager
const tokenManager = new TokenManager();

// ========================================
// STATE
// ========================================
let tokenClient = null;
let gapiInited = false;
let gisInited = false;
let accessToken = null;
let currentPersonalData = [];
let currentTahunData = [];
let currentMasterKasData = [];
let currentPembayaranData = [];

// ========================================
// UTILITIES FUNCTIONS
// ========================================

function formatNumber(number) {
  if (number === null || number === undefined || isNaN(number)) {
    return "0";
  }
  return new Intl.NumberFormat("id-ID").format(number);
}

function formatRupiah(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "Rp 0";
  }
  return `Rp ${formatNumber(amount)}`;
}

function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function setupNominalInput(inputId, onValueChange) {
  const input = document.getElementById(inputId);
  if (!input) return null;

  const handleInput = (e) => {
    let rawValue = e.target.value.replace(/[^0-9]/g, "");
    if (rawValue === "") {
      e.target.value = "";
      if (onValueChange) onValueChange(0);
      return;
    }
    const numericValue = parseInt(rawValue, 10);
    e.target.value = formatNumber(numericValue);
    if (onValueChange) onValueChange(numericValue);
  };

  input.addEventListener("input", handleInput);

  return {
    input,
    getValue: () => {
      const raw = input.value.replace(/[^0-9]/g, "");
      return raw ? parseInt(raw, 10) : 0;
    },
    setValue: (value) => {
      if (value) {
        input.value = formatNumber(value);
      } else {
        input.value = "";
      }
    },
  };
}

function showLoading(show) {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) {
    if (show) {
      overlay.classList.add("show");
    } else {
      overlay.classList.remove("show");
    }
  }
}

function showToast(message, type = "success") {
  let toastContainer = document.getElementById("toastContainer");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toastContainer";
    toastContainer.style.position = "fixed";
    toastContainer.style.bottom = "20px";
    toastContainer.style.right = "20px";
    toastContainer.style.zIndex = "9999";
    document.body.appendChild(toastContainer);
  }

  const toastId = "toast-" + Date.now();
  const bgClass =
    type === "success"
      ? "bg-success"
      : type === "error"
        ? "bg-danger"
        : "bg-info";

  const toastHtml = `
    <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0" role="alert" aria-live="assertive" aria-atomic="true" data-bs-autohide="true" data-bs-delay="3000">
      <div class="d-flex">
        <div class="toast-body">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>
  `;

  toastContainer.insertAdjacentHTML("beforeend", toastHtml);
  const toastElement = document.getElementById(toastId);
  const toast = new bootstrap.Toast(toastElement);
  toast.show();

  toastElement.addEventListener("hidden.bs.toast", () => {
    toastElement.remove();
  });
}

// ========================================
// AGREGASI DATA PEMBAYARAN
// ========================================

function getAggregatedPayments() {
  const aggregations = {};

  for (let i = 1; i < currentPembayaranData.length; i++) {
    const row = currentPembayaranData[i];
    const personalName = row[0];
    const masterKasId = row[7] || getMasterKasIdByTarget(row[3]);
    const nominal = parseFloat(row[2] || 0);

    const key = `${personalName}|${masterKasId}`;
    if (!aggregations[key]) {
      aggregations[key] = {
        personalName: personalName,
        masterKasId: masterKasId,
        totalBayar: 0,
        details: [],
      };
    }
    aggregations[key].totalBayar += nominal;
    aggregations[key].details.push({
      tanggal: row[1],
      nominal: nominal,
      bukti: row[6],
    });
  }

  return aggregations;
}

function getMasterKasIdByTarget(targetNominal) {
  for (let i = 1; i < currentMasterKasData.length; i++) {
    if (parseFloat(currentMasterKasData[i][3]) === parseFloat(targetNominal)) {
      return i;
    }
  }
  return null;
}

function getPaymentStatus(totalBayar, target) {
  const selisih = totalBayar - target;
  let status = "";
  let statusBadge = "";

  if (selisih === 0) {
    status = "Lunas";
    statusBadge = "badge-lunas";
  } else if (selisih > 0) {
    status = "Lebih";
    statusBadge = "badge-lebih";
  } else {
    status = "Kurang";
    statusBadge = "badge-kurang";
  }

  return { selisih, status, statusBadge, selisihAbs: Math.abs(selisih) };
}

function getDisplayPayments() {
  const aggregations = getAggregatedPayments();
  const displayData = [];

  for (const key in aggregations) {
    const agg = aggregations[key];
    const masterKas = currentMasterKasData[agg.masterKasId];
    const target = masterKas ? parseFloat(masterKas[3] || 0) : 0;
    const { selisih, status, statusBadge } = getPaymentStatus(
      agg.totalBayar,
      target,
    );

    displayData.push({
      personalName: agg.personalName,
      masterKasId: agg.masterKasId,
      masterKasName: masterKas ? masterKas[0] : "-",
      masterKasPeriode: masterKas ? masterKas[1] : "-",
      totalBayar: agg.totalBayar,
      target: target,
      selisih: selisih,
      status: status,
      statusBadge: statusBadge,
      details: agg.details,
    });
  }

  return displayData;
}

function getTotalPembayaranPerPersonalKas(personalName, masterKasId) {
  let total = 0;
  for (let i = 1; i < currentPembayaranData.length; i++) {
    const row = currentPembayaranData[i];
    const rowMasterKasId =
      row[7] || getMasterKasIdByTarget(parseFloat(row[3] || 0));
    if (row[0] === personalName && rowMasterKasId == masterKasId) {
      total += parseFloat(row[2] || 0);
    }
  }
  return total;
}

function getPaymentDetails(personalName, masterKasId) {
  const details = [];
  for (let i = 1; i < currentPembayaranData.length; i++) {
    const row = currentPembayaranData[i];
    const rowMasterKasId =
      row[7] || getMasterKasIdByTarget(parseFloat(row[3] || 0));
    if (row[0] === personalName && rowMasterKasId == masterKasId) {
      details.push({
        rowIndex: i,
        tanggal: row[1],
        nominal: parseFloat(row[2] || 0),
        bukti: row[6],
      });
    }
  }
  return details;
}

// ========================================
// GOOGLE SHEETS API FUNCTIONS
// ========================================

async function readSheet(sheetName, range = "A:Z") {
  try {
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: `${sheetName}!${range}`,
    });
    return response.result.values || [];
  } catch (error) {
    console.error(`Error reading ${sheetName}:`, error);
    return [];
  }
}

async function writeSheet(sheetName, range, values) {
  if (!accessToken) {
    alert("Silakan login terlebih dahulu!");
    return false;
  }
  try {
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: `${sheetName}!${range}`,
      valueInputOption: "USER_ENTERED",
      resource: { values: values },
    });
    return true;
  } catch (error) {
    console.error(`Error writing to ${sheetName}:`, error);
    alert("Gagal menyimpan data: " + error.message);
    return false;
  }
}

async function appendSheet(sheetName, values) {
  if (!accessToken) {
    alert("Silakan login terlebih dahulu!");
    return false;
  }
  try {
    await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
      valueInputOption: "USER_ENTERED",
      resource: { values: values },
    });
    return true;
  } catch (error) {
    console.error(`Error appending to ${sheetName}:`, error);
    alert("Gagal menambah data: " + error.message);
    return false;
  }
}

async function deleteRow(sheetName, rowIndex) {
  if (!accessToken) {
    alert("Silakan login terlebih dahulu!");
    return false;
  }
  if (!confirm("Yakin ingin menghapus data ini?")) {
    return false;
  }
  try {
    const sheetMetadata = await gapi.client.sheets.spreadsheets.get({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
    });
    const sheet = sheetMetadata.result.sheets.find(
      (s) => s.properties.title === sheetName,
    );
    const sheetId = sheet.properties.sheetId;
    await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      resource: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: "ROWS",
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      },
    });
    return true;
  } catch (error) {
    console.error(`Error deleting row from ${sheetName}:`, error);
    alert("Gagal menghapus data: " + error.message);
    return false;
  }
}

// ========================================
// AUTHENTICATION FUNCTIONS
// ========================================

function isAuthenticated() {
  return accessToken !== null && gapi.client.getToken() !== null;
}

function enableEditButtons() {
  document
    .querySelectorAll('[id^="btnAdd"]')
    .forEach((btn) => (btn.disabled = false));
}

function disableEditButtons() {
  document
    .querySelectorAll('[id^="btnAdd"]')
    .forEach((btn) => (btn.disabled = true));
}

function gapiLoaded() {
  gapi.load("client", initializeGapiClient);
}

async function initializeGapiClient() {
  await gapi.client.init({
    apiKey: CONFIG.API_KEY,
    discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
  });
  gapiInited = true;

  // Cek apakah ada token tersimpan di localStorage
  const savedToken = tokenManager.getToken();

  if (savedToken && savedToken.access_token) {
    console.log("Menggunakan token dari localStorage");
    // Set token ke gapi client
    gapi.client.setToken({
      access_token: savedToken.access_token,
      token_type: savedToken.token_type,
      scope: savedToken.scope,
    });
    accessToken = savedToken.access_token;

    // Tampilkan sisa waktu token
    const remainingMinutes = tokenManager.getTokenRemainingMinutes();
    showToast(
      `Login otomatis berhasil. Token berlaku ${remainingMinutes} menit lagi`,
      "success",
    );

    await updateSigninStatus(true);
    enableEditButtons();
    loadAllData();
  } else {
    console.log("Tidak ada token tersimpan atau token expired");
    loadAllData();
  }
}

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: CONFIG.SCOPES,
    callback: "",
  });
  gisInited = true;
}

async function handleAuthClick() {
  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) {
      console.error("Auth error:", resp);
      showToast("Login gagal: " + resp.error, "error");
      throw resp;
    }

    const token = gapi.client.getToken();
    accessToken = token.access_token;

    // Simpan token ke localStorage
    tokenManager.saveToken({
      access_token: token.access_token,
      token_type: token.token_type,
      scope: token.scope,
    });

    await updateSigninStatus(true);
    enableEditButtons();
    await loadAllData();

    const remainingMinutes = tokenManager.getTokenRemainingMinutes();
    showToast(
      `Login berhasil! Token berlaku ${remainingMinutes} menit`,
      "success",
    );
  };

  if (gapi.client.getToken() === null) {
    tokenClient.requestAccessToken({ prompt: "consent" });
  } else {
    tokenClient.requestAccessToken({ prompt: "" });
  }
}

function handleSignoutClick() {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken("");
    accessToken = null;
  }

  // Hapus token dari localStorage
  tokenManager.clearToken();

  updateSigninStatus(false);
  disableEditButtons();
  loadAllData();
  showToast("Logout berhasil", "info");
}

async function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    const loginSection = document.getElementById("loginSection");
    const userSection = document.getElementById("userSection");
    if (loginSection) loginSection.style.display = "none";
    if (userSection) userSection.style.display = "block";

    const userNameSpan = document.getElementById("userName");
    if (userNameSpan) userNameSpan.textContent = ":)";

    const userAvatar = document.getElementById("userAvatar");
    if (userAvatar) userAvatar.src = "./blink.png";

    // Tampilkan sisa waktu token di tooltip atau di user info
    const remainingMinutes = tokenManager.getTokenRemainingMinutes();
    if (remainingMinutes > 0 && userNameSpan) {
      userNameSpan.title = `Token berlaku hingga ${remainingMinutes} menit lagi`;
    }
  } else {
    const loginSection = document.getElementById("loginSection");
    const userSection = document.getElementById("userSection");
    if (loginSection) loginSection.style.display = "block";
    if (userSection) userSection.style.display = "none";
  }
}

// ========================================
// DASHBOARD FUNCTIONS
// ========================================

function showDashboard() {
  const dashboardSection = document.getElementById("dashboardSection");
  const dataMasterSection = document.getElementById("dataMasterSection");
  if (dashboardSection) dashboardSection.style.display = "block";
  if (dataMasterSection) dataMasterSection.style.display = "none";
  loadDashboardData();

  // Update active state pada navbar
  const navLinks = document.querySelectorAll(".navbar-nav .nav-link");
  navLinks.forEach((link) => {
    link.classList.remove("active");
    if (link.textContent.includes("Beranda")) {
      link.classList.add("active");
    }
  });
}

function showDataMaster() {
  const dashboardSection = document.getElementById("dashboardSection");
  const dataMasterSection = document.getElementById("dataMasterSection");
  if (dashboardSection) dashboardSection.style.display = "none";
  if (dataMasterSection) dataMasterSection.style.display = "block";
  refreshPaymentDisplay();

  // Update active state pada navbar
  const navLinks = document.querySelectorAll(".navbar-nav .nav-link");
  navLinks.forEach((link) => {
    link.classList.remove("active");
    if (link.textContent.includes("Data Master")) {
      link.classList.add("active");
    }
  });
}

async function loadDashboardData() {
  const displayPayments = getDisplayPayments();

  // Hitung total personal
  const totalPersonal = currentPersonalData.length - 1;
  const totalPersonalElem = document.getElementById("totalPersonal");
  if (totalPersonalElem) totalPersonalElem.textContent = totalPersonal;

  // Hitung total setoran dan target
  let totalSetoran = 0;
  let totalTarget = 0;

  for (const payment of displayPayments) {
    totalSetoran += payment.totalBayar;
  }

  for (let i = 1; i < currentMasterKasData.length; i++) {
    if (currentMasterKasData[i][4] === "Aktif") {
      totalTarget += parseFloat(currentMasterKasData[i][3] || 0);
    }
  }

  const totalSetoranElem = document.getElementById("totalSetoran");
  const totalTargetElem = document.getElementById("totalTarget");
  if (totalSetoranElem)
    totalSetoranElem.textContent = formatRupiah(totalSetoran);
  if (totalTargetElem) totalTargetElem.textContent = formatRupiah(totalTarget);

  const persentase = totalTarget > 0 ? (totalSetoran / totalTarget) * 100 : 0;
  const persentaseElem = document.getElementById("totalPersentase");
  if (persentaseElem) persentaseElem.textContent = `${persentase.toFixed(1)}%`;

  // Load ringkasan per master kas
  loadRingkasanKasTable(displayPayments);

  // Load rekap per personal
  loadRekapPersonalTable(displayPayments);

  // Load filter dropdown untuk rekap
  const filterSelect = document.getElementById("filterMasterKasRekap");
  if (filterSelect) {
    let options = '<option value="">Semua Kas</option>';
    for (let i = 1; i < currentMasterKasData.length; i++) {
      if (currentMasterKasData[i][4] === "Aktif") {
        options += `<option value="${i}">${currentMasterKasData[i][0]} - ${currentMasterKasData[i][1]}</option>`;
      }
    }
    filterSelect.innerHTML = options;

    filterSelect.onchange = () => {
      const filterValue = filterSelect.value;
      loadRekapPersonalTable(displayPayments, filterValue);
    };
  }
}

function loadRingkasanKasTable(displayPayments) {
  const tbody = document.getElementById("ringkasanKasTable");
  if (!tbody) return;

  const kasSummary = {};

  for (let i = 1; i < currentMasterKasData.length; i++) {
    const kas = currentMasterKasData[i];
    if (kas[4] === "Aktif") {
      kasSummary[i] = {
        id: i,
        nama: kas[0],
        periode: kas[1],
        target: parseFloat(kas[3] || 0),
        terkumpul: 0,
      };
    }
  }

  for (const payment of displayPayments) {
    if (kasSummary[payment.masterKasId]) {
      kasSummary[payment.masterKasId].terkumpul += payment.totalBayar;
    }
  }

  if (Object.keys(kasSummary).length === 0) {
    tbody.innerHTML =
      '32<td colspan="7" class="text-center">Belum ada data kas</td></tr>';
    return;
  }

  let html = "";
  let no = 1;
  for (const key in kasSummary) {
    const kas = kasSummary[key];
    const selisih = kas.terkumpul - kas.target;
    const persentase = kas.target > 0 ? (kas.terkumpul / kas.target) * 100 : 0;
    const selisihText =
      selisih >= 0
        ? `+${formatRupiah(selisih)}`
        : `-${formatRupiah(Math.abs(selisih))}`;
    const selisihClass = selisih >= 0 ? "text-success" : "text-danger";

    html += `
      <tr>
        <td>${no++}</td>
        <td>${kas.nama}</td>
        <td>${kas.periode}</td>
        <td>${formatRupiah(kas.target)}</td>
        <td>${formatRupiah(kas.terkumpul)}</td>
        <td class="${selisihClass}">${selisihText}</td>
        <td>
          <div class="progress" style="height: 20px;">
            <div class="progress-bar ${persentase >= 100 ? "bg-success" : "bg-primary"}" 
                 style="width: ${Math.min(persentase, 100)}%">
              ${persentase.toFixed(1)}%
            </div>
          </div>
        </td>
      </tr>
    `;
  }
  tbody.innerHTML = html;
}

function loadRekapPersonalTable(displayPayments, filterKasId = "") {
  const tbody = document.getElementById("rekapPersonalTable");
  if (!tbody) return;

  const personalSummary = {};

  let filteredPayments = displayPayments;
  if (filterKasId) {
    filteredPayments = displayPayments.filter(
      (p) => p.masterKasId == filterKasId,
    );
  }

  for (const payment of filteredPayments) {
    if (!personalSummary[payment.personalName]) {
      personalSummary[payment.personalName] = {
        personalName: payment.personalName,
        totalBayar: 0,
        payments: [],
      };
    }
    personalSummary[payment.personalName].totalBayar += payment.totalBayar;
    personalSummary[payment.personalName].payments.push(payment);
  }

  if (Object.keys(personalSummary).length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="text-center">Belum ada data pembayaran</td></tr>';
    return;
  }

  let html = "";
  let no = 1;
  for (const key in personalSummary) {
    const personal = personalSummary[key];
    let detailsHtml = "";
    for (const payment of personal.payments) {
      const targetText = formatRupiah(payment.target);
      const bayarText = formatRupiah(payment.totalBayar);
      const statusClass =
        payment.status === "Lunas"
          ? "text-success"
          : payment.status === "Lebih"
            ? "text-warning"
            : "text-danger";
      detailsHtml += `
        <div class="mb-1">
          <strong>${payment.masterKasName}</strong><br>
          Target: ${targetText} | Bayar: ${bayarText}<br>
          Status: <span class="${statusClass}">${payment.status}</span>
          ${payment.selisih !== 0 ? ` (${payment.selisih > 0 ? "+" : "-"}${formatRupiah(Math.abs(payment.selisih))})` : ""}
        </div>
        <hr class="my-1">
      `;
    }

    html += `
      <tr>
        <td>${no++}</td>
        <td><strong>${personal.personalName}</strong></td>
        <td class="fw-bold">${formatRupiah(personal.totalBayar)}</td>
        <td>${detailsHtml}</td>
      </tr>
    `;
  }
  tbody.innerHTML = html;
}

// ========================================
// DATA LOADING FUNCTIONS
// ========================================

async function loadAllData() {
  showLoading(true);
  try {
    await Promise.all([
      loadPersonalData(),
      loadTahunData(),
      loadMasterKasData(),
      loadPembayaranDataRaw(),
    ]);
    refreshPaymentDisplay();
    loadDashboardData();
  } catch (error) {
    console.error("Error loading data:", error);
    showToast("Gagal memuat data", "error");
  }
  showLoading(false);
}

async function loadPersonalData() {
  const data = await readSheet(SHEETS.PERSONAL);
  currentPersonalData = data;
  const tbody = document.getElementById("personalTableBody");

  if (!tbody) return;

  if (data.length <= 1) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="text-center">Belum ada data personal</td></tr>';
    return;
  }

  let html = "";
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const statusBadge = row[3] === "Aktif" ? "success" : "secondary";
    html += `
      <tr>
        <td>${i}</td>
        <td>${row[0] || ""}</td>
        <td>${row[1] || ""}</td>
        <td>${row[2] || ""}</td>
        <td><span class="badge bg-${statusBadge}">${row[3] || ""}</span></td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-sm btn-warning" onclick="editPersonal(${i})" ${!isAuthenticated() ? "disabled" : ""}>
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="deletePersonal(${i})" ${!isAuthenticated() ? "disabled" : ""}>
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }
  tbody.innerHTML = html;

  const personalSelect = document.getElementById("pembayaranPersonal");
  if (personalSelect) {
    let personalOptions = '<option value="">Pilih Personal</option>';
    for (let i = 1; i < data.length; i++) {
      if (data[i][3] === "Aktif") {
        personalOptions += `<option value="${data[i][0]}">${data[i][0]}</option>`;
      }
    }
    personalSelect.innerHTML = personalOptions;
  }
}

async function loadTahunData() {
  const data = await readSheet(SHEETS.TAHUN);
  currentTahunData = data;
  const tbody = document.getElementById("tahunTableBody");
  const select = document.getElementById("masterKasTahun");

  if (!tbody) return;

  if (data.length <= 1) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="text-center">Belum ada data tahun</td></tr>';
    if (select) select.innerHTML = '<option value="">Pilih Tahun</option>';
    return;
  }

  let html = "";
  let options = '<option value="">Pilih Tahun</option>';
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const statusBadge = row[2] === "Aktif" ? "success" : "secondary";
    html += `
      <tr>
        <td>${i}</td>
        <td>${row[0] || ""}</td>
        <td>${row[1] || ""}</td>
        <td><span class="badge bg-${statusBadge}">${row[2] || ""}</span></td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-sm btn-warning" onclick="editTahun(${i})" ${!isAuthenticated() ? "disabled" : ""}>
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteTahun(${i})" ${!isAuthenticated() ? "disabled" : ""}>
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
    if (row[2] === "Aktif") {
      options += `<option value="${row[0]}">${row[0]}</option>`;
    }
  }
  tbody.innerHTML = html;
  if (select) select.innerHTML = options;
}

async function loadMasterKasData() {
  const data = await readSheet(SHEETS.MASTER_KAS);
  currentMasterKasData = data;
  const tbody = document.getElementById("masterKasTableBody");
  const select = document.getElementById("pembayaranMasterKas");
  const filterSelect = document.getElementById("filterMasterKas");

  if (!tbody) return;

  if (data.length <= 1) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="text-center">Belum ada data master kas</td></tr>';
    if (select) select.innerHTML = '<option value="">Pilih Jenis Kas</option>';
    if (filterSelect)
      filterSelect.innerHTML = '<option value="">Semua Jenis Kas</option>';
    return;
  }

  let html = "";
  let options = '<option value="">Pilih Jenis Kas</option>';
  let filterOptions = '<option value="">Semua Jenis Kas</option>';

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const statusBadge = row[4] === "Aktif" ? "success" : "secondary";
    const nominal = formatNumber(parseFloat(row[3] || 0));
    html += `
      <tr>
        <td>${i}</td>
        <td>${row[0] || ""}</td>
        <td>${row[1] || ""}</td>
        <td>${row[2] || ""}</td>
        <td>Rp ${nominal}</td>
        <td><span class="badge bg-${statusBadge}">${row[4] || ""}</span></td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-sm btn-warning" onclick="editMasterKas(${i})" ${!isAuthenticated() ? "disabled" : ""}>
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteMasterKas(${i})" ${!isAuthenticated() ? "disabled" : ""}>
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
    if (row[4] === "Aktif") {
      options += `<option value="${i}" data-max="${row[3]}">${row[0]} - ${row[1]}</option>`;
      filterOptions += `<option value="${i}">${row[0]} - ${row[1]}</option>`;
    }
  }
  tbody.innerHTML = html;
  if (select) select.innerHTML = options;
  if (filterSelect) filterSelect.innerHTML = filterOptions;
}

async function loadPembayaranDataRaw() {
  const data = await readSheet(SHEETS.PEMBAYARAN);
  currentPembayaranData = data;
}

function refreshPaymentDisplay() {
  const displayPayments = getDisplayPayments();
  const tbody = document.getElementById("pembayaranTableBody");
  const filterKas = document.getElementById("filterMasterKas")?.value;
  const filterStatus = document.getElementById("filterStatusPembayaran")?.value;

  if (!tbody) return;

  let filteredPayments = displayPayments;
  if (filterKas) {
    filteredPayments = filteredPayments.filter(
      (p) => p.masterKasId == filterKas,
    );
  }
  if (filterStatus) {
    filteredPayments = filteredPayments.filter(
      (p) => p.status === filterStatus,
    );
  }

  if (filteredPayments.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" class="text-center">Belum ada data pembayaran</td></tr>';
    return;
  }

  let html = "";
  let no = 1;
  for (const payment of filteredPayments) {
    const targetText = formatRupiah(payment.target);
    const bayarText = formatRupiah(payment.totalBayar);
    const selisihText =
      payment.selisih >= 0
        ? `+${formatRupiah(payment.selisih)}`
        : `-${formatRupiah(Math.abs(payment.selisih))}`;
    const selisihClass = payment.selisih >= 0 ? "text-success" : "text-danger";

    html += `
      <tr>
        <td>${no++}</td>
        <td><strong>${payment.personalName}</strong></td>
        <td>${payment.masterKasName}<br><small class="text-muted">${payment.masterKasPeriode}</small></td>
        <td class="fw-bold">${bayarText}</div>
        <td>${targetText}</div>
        <td class="${selisihClass}">${selisihText}</div>
        <td><span class="badge ${payment.statusBadge}">${payment.status}</span></div>
        <td>
          <div class="action-buttons">
            <button class="btn btn-sm btn-info" onclick="viewPaymentDetails('${payment.personalName}', ${payment.masterKasId})">
              <i class="bi bi-eye"></i>
            </button>
            ${
              isAuthenticated()
                ? `
            <button class="btn btn-sm btn-warning" onclick="editPaymentAggregate(${payment.masterKasId}, '${payment.personalName}')">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="deletePaymentAggregate(${payment.masterKasId}, '${payment.personalName}')">
              <i class="bi bi-trash"></i>
            </button>
            `
                : ""
            }
          </div>
        </div>
       </div>
    `;
  }
  tbody.innerHTML = html;
}

// ========================================
// PEMBAYARAN FUNCTIONS (CRUD)
// ========================================

function showAddPembayaranModal() {
  document.getElementById("pembayaranModalTitle").textContent =
    "Tambah Pembayaran";
  document.getElementById("pembayaranForm").reset();
  document.getElementById("pembayaranId").value = "";
  document.getElementById("targetNominal").value = "";
  document.getElementById("totalSudahDibayar").value = "";
  document.getElementById("sisaPreview").value = "";
  document.getElementById("statusPreview").value = "";

  setupNominalInput("pembayaranNominal", () => {
    updatePaymentPreview();
  });

  new bootstrap.Modal(document.getElementById("pembayaranModal")).show();
}

async function updatePaymentPreview() {
  const select = document.getElementById("pembayaranMasterKas");
  const option = select.options[select.selectedIndex];
  const maxNominal = parseFloat(option.getAttribute("data-max") || 0);
  const personalName = document.getElementById("pembayaranPersonal").value;
  const masterKasId = select.value;

  const targetNominalElem = document.getElementById("targetNominal");
  if (targetNominalElem) {
    targetNominalElem.value = maxNominal ? formatRupiah(maxNominal) : "";
  }

  if (personalName && masterKasId) {
    const totalSudahDibayar = getTotalPembayaranPerPersonalKas(
      personalName,
      parseInt(masterKasId),
    );
    const nominalInput = document.getElementById("pembayaranNominal");
    const nominalTambahan = nominalInput.value
      ? parseInt(nominalInput.value.replace(/[^0-9]/g, ""))
      : 0;
    const totalSetelah = totalSudahDibayar + nominalTambahan;
    const selisih = totalSetelah - maxNominal;

    const totalSudahDibayarElem = document.getElementById("totalSudahDibayar");
    if (totalSudahDibayarElem)
      totalSudahDibayarElem.value = formatRupiah(totalSudahDibayar);

    const sisaPreviewElem = document.getElementById("sisaPreview");
    const statusPreviewElem = document.getElementById("statusPreview");

    if (sisaPreviewElem && statusPreviewElem) {
      if (selisih === 0) {
        sisaPreviewElem.value = "LUNAS";
        statusPreviewElem.value = "Lunas";
      } else if (selisih > 0) {
        sisaPreviewElem.value = `Kelebihan ${formatRupiah(selisih)}`;
        statusPreviewElem.value = "Lebih";
      } else {
        sisaPreviewElem.value = `Kekurangan ${formatRupiah(Math.abs(selisih))}`;
        statusPreviewElem.value = "Kurang";
      }
    }
  }
}

function updateTargetNominal() {
  updatePaymentPreview();
}

function calculateStatus() {
  updatePaymentPreview();
}

async function savePembayaran() {
  const form = document.getElementById("pembayaranForm");
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  showLoading(true);
  const select = document.getElementById("pembayaranMasterKas");
  const option = select.options[select.selectedIndex];
  const maxNominal = parseFloat(option.getAttribute("data-max") || 0);
  const personalName = document.getElementById("pembayaranPersonal").value;
  const masterKasId = select.value;
  const tanggal = document.getElementById("pembayaranTanggal").value;
  const nominalInput = document.getElementById("pembayaranNominal");
  const nominal = parseInt(nominalInput.value.replace(/[^0-9]/g, "") || 0);
  const bukti = document.getElementById("pembayaranBukti").value || "";

  const totalSudahDibayar = getTotalPembayaranPerPersonalKas(
    personalName,
    parseInt(masterKasId),
  );
  const totalSetelah = totalSudahDibayar + nominal;
  const selisih = totalSetelah - maxNominal;
  let status;
  if (selisih === 0) status = "Lunas";
  else if (selisih > 0) status = "Lebih";
  else status = "Kurang";

  const values = [
    [
      personalName,
      tanggal,
      nominal,
      maxNominal,
      selisih,
      status,
      bukti,
      masterKasId,
    ],
  ];

  const success = await appendSheet(SHEETS.PEMBAYARAN, values);

  if (success) {
    bootstrap.Modal.getInstance(
      document.getElementById("pembayaranModal"),
    ).hide();
    await loadPembayaranDataRaw();
    refreshPaymentDisplay();
    loadDashboardData();
    showToast("Pembayaran berhasil ditambahkan");
  }
  showLoading(false);
}

function viewPaymentDetails(personalName, masterKasId) {
  const details = getPaymentDetails(personalName, masterKasId);
  const masterKas = currentMasterKasData[masterKasId];
  const target = masterKas ? parseFloat(masterKas[3] || 0) : 0;
  const totalBayar = details.reduce((sum, d) => sum + d.nominal, 0);
  const selisih = totalBayar - target;

  let detailsHtml = `
    <div class="mb-3">
      <h6>Ringkasan</h6>
      <table class="table table-sm table-bordered">
        <tr><td style="width: 120px"><strong>Personal</strong></td><td><strong>${personalName}</strong></td></tr>
        <tr><td><strong>Jenis Kas</strong></td><td>${masterKas ? masterKas[0] : "-"}</td></tr>
        <tr><td><strong>Periode</strong></td><td>${masterKas ? masterKas[1] : "-"}</td></tr>
        <tr><td><strong>Target</strong></td><td class="fw-bold">${formatRupiah(target)}</td></tr>
        <tr><td><strong>Total Bayar</strong></td><td class="fw-bold text-primary">${formatRupiah(totalBayar)}</td></tr>
        <tr><td><strong>Status</strong></td><td><span class="badge ${selisih === 0 ? "badge-lunas" : selisih > 0 ? "badge-lebih" : "badge-kurang"}">${selisih === 0 ? "Lunas" : selisih > 0 ? "Lebih" : "Kurang"}</span></td></tr>
        <tr><td><strong>Selisih</strong></td><td class="${selisih >= 0 ? "text-success" : "text-danger"} fw-bold">${selisih >= 0 ? `+${formatRupiah(selisih)}` : `-${formatRupiah(Math.abs(selisih))}`}</td></tr>
      </table>
    </div>
    <h6 class="mt-3">Detail Transaksi</h6>
    <div class="table-responsive">
      <table class="table table-sm table-hover">
        <thead class="table-light">
          <tr>
            <th style="width: 50px">No</th>
            <th>Tanggal</th>
            <th>Nominal</th>
            <th>Bukti</th>
            <th style="width: 100px">Aksi</th>
          </tr>
        </thead>
        <tbody id="transactionDetailsBody">
  `;

  let no = 1;
  for (const detail of details) {
    detailsHtml += `
      <tr id="transaction-row-${detail.rowIndex}" data-rowindex="${detail.rowIndex}" data-nominal="${detail.nominal}" data-tanggal="${detail.tanggal}" data-bukti="${detail.bukti || ""}">
        <td>${no++}</td>
        <td class="transaction-tanggal">${formatDate(detail.tanggal)}</td>
        <td class="transaction-nominal">${formatRupiah(detail.nominal)}</td>
        <td class="transaction-bukti">${detail.bukti ? `<button class="btn btn-sm btn-info" onclick="viewBukti('${detail.bukti}')"><i class="bi bi-eye"></i> Lihat</button>` : "-"}</td>
        <td>
          <button class="btn btn-sm btn-warning me-1" onclick="editSingleTransaction(${detail.rowIndex}, '${personalName}', ${masterKasId})" title="Edit transaksi ini">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteSingleTransaction(${detail.rowIndex}, '${personalName}', ${masterKasId})" title="Hapus transaksi ini">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }

  detailsHtml += `
        </tbody>
      </table>
    </div>
    <div class="mt-3 text-end">
      <button class="btn btn-primary btn-sm" onclick="showAddPaymentForPersonal('${personalName}', ${masterKasId})">
        <i class="bi bi-plus-circle"></i> Tambah Transaksi Baru
      </button>
    </div>
  `;

  const modalHtml = `
    <div class="modal fade" id="detailPaymentModal" tabindex="-1" data-bs-backdrop="static">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-receipt"></i> Detail Pembayaran - ${personalName}
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            ${detailsHtml}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Tutup</button>
            <button type="button" class="btn btn-success" onclick="refreshPaymentData()">
              <i class="bi bi-arrow-repeat"></i> Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const existingModal = document.getElementById("detailPaymentModal");
  if (existingModal) existingModal.remove();

  document.body.insertAdjacentHTML("beforeend", modalHtml);
  const modal = new bootstrap.Modal(
    document.getElementById("detailPaymentModal"),
  );
  modal.show();

  document
    .getElementById("detailPaymentModal")
    .addEventListener("hidden.bs.modal", () => {
      document.getElementById("detailPaymentModal").remove();
    });
}

// Fungsi untuk edit single transaction
async function editSingleTransaction(rowIndex, personalName, masterKasId) {
  // Cari detail transaksi berdasarkan rowIndex
  const details = getPaymentDetails(personalName, masterKasId);
  const transaction = details.find((d) => d.rowIndex === rowIndex);

  if (!transaction) {
    showToast("Transaksi tidak ditemukan", "error");
    return;
  }

  const masterKas = currentMasterKasData[masterKasId];
  const target = masterKas ? parseFloat(masterKas[3] || 0) : 0;
  const totalLainnya = details.reduce((sum, d) => {
    if (d.rowIndex !== rowIndex) return sum + d.nominal;
    return sum;
  }, 0);

  // Buat modal edit
  const editModalHtml = `
    <div class="modal fade" id="editTransactionModal" tabindex="-1" data-bs-backdrop="static">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-pencil-square"></i> Edit Transaksi
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label fw-bold">Personal</label>
              <input type="text" class="form-control" value="${personalName}" readonly>
            </div>
            <div class="mb-3">
              <label class="form-label fw-bold">Jenis Kas</label>
              <input type="text" class="form-control" value="${masterKas ? masterKas[0] + " - " + masterKas[1] : "-"}" readonly>
            </div>
            <div class="mb-3">
              <label class="form-label fw-bold">Target Kas</label>
              <input type="text" class="form-control" value="${formatRupiah(target)}" readonly>
            </div>
            <div class="mb-3">
              <label class="form-label fw-bold">Total Pembayaran Lainnya</label>
              <input type="text" class="form-control" value="${formatRupiah(totalLainnya)}" readonly>
              <small class="text-muted">Total pembayaran selain transaksi ini</small>
            </div>
            <hr>
            <div class="mb-3">
              <label for="editTanggal" class="form-label fw-bold">Tanggal Pembayaran <span class="text-danger">*</span></label>
              <input type="date" class="form-control" id="editTanggal" value="${transaction.tanggal}" required>
            </div>
            <div class="mb-3">
              <label for="editNominal" class="form-label fw-bold">Nominal Bayar (Rp) <span class="text-danger">*</span></label>
              <input type="text" class="form-control" id="editNominal" value="${formatNumber(transaction.nominal)}" required>
            </div>
            <div class="mb-3">
              <label for="editBukti" class="form-label">Bukti Pembayaran (URL)</label>
              <input type="url" class="form-control" id="editBukti" value="${transaction.bukti || ""}" placeholder="https://...">
              <small class="text-muted">Upload bukti ke Google Drive dan masukkan link di sini</small>
            </div>
            <div class="alert alert-info mt-3" id="editPreviewInfo">
              <strong>Preview Setelah Edit:</strong><br>
              <span id="previewTotalSetelah"></span><br>
              <span id="previewStatus"></span>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
            <button type="button" class="btn btn-primary" onclick="saveEditedTransaction(${rowIndex}, '${personalName}', ${masterKasId}, ${target})">
              <i class="bi bi-save"></i> Simpan Perubahan
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const existingEditModal = document.getElementById("editTransactionModal");
  if (existingEditModal) existingEditModal.remove();

  document.body.insertAdjacentHTML("beforeend", editModalHtml);

  // Setup nominal input dengan formatting
  const nominalInput = document.getElementById("editNominal");
  if (nominalInput) {
    setupNominalInputForElement(nominalInput, () => {
      updateEditPreview(totalLainnya, target);
    });
  }

  // Update preview awal
  updateEditPreview(totalLainnya, target);

  const modal = new bootstrap.Modal(
    document.getElementById("editTransactionModal"),
  );
  modal.show();

  document
    .getElementById("editTransactionModal")
    .addEventListener("hidden.bs.modal", () => {
      document.getElementById("editTransactionModal").remove();
    });
}

function updateEditPreview(totalLainnya, target) {
  const nominalInput = document.getElementById("editNominal");
  const nominalRaw = nominalInput?.value.replace(/[^0-9]/g, "") || "0";
  const nominal = parseInt(nominalRaw) || 0;
  const totalSetelah = totalLainnya + nominal;
  const selisih = totalSetelah - target;

  const previewTotalSetelah = document.getElementById("previewTotalSetelah");
  const previewStatus = document.getElementById("previewStatus");

  if (previewTotalSetelah) {
    previewTotalSetelah.innerHTML = `<strong>Total Bayar Setelah Edit:</strong> ${formatRupiah(totalSetelah)}`;
  }

  if (previewStatus) {
    let statusText = "";
    let statusClass = "";
    if (selisih === 0) {
      statusText = "LUNAS";
      statusClass = "text-success";
    } else if (selisih > 0) {
      statusText = `LEBIH (${formatRupiah(selisih)})`;
      statusClass = "text-warning";
    } else {
      statusText = `KURANG (${formatRupiah(Math.abs(selisih))})`;
      statusClass = "text-danger";
    }
    previewStatus.innerHTML = `<strong>Status:</strong> <span class="${statusClass} fw-bold">${statusText}</span>`;
  }
}

async function editPaymentAggregate(masterKasId, personalName) {
  viewPaymentDetails(personalName, masterKasId);
}

async function deletePaymentAggregate(masterKasId, personalName) {
  if (!confirm(`Hapus semua pembayaran untuk ${personalName} pada kas ini?`))
    return;

  showLoading(true);
  const details = getPaymentDetails(personalName, masterKasId);
  let success = true;

  for (let i = details.length - 1; i >= 0; i--) {
    const detail = details[i];
    const delSuccess = await deleteRow(SHEETS.PEMBAYARAN, detail.rowIndex);
    if (!delSuccess) success = false;
  }

  if (success) {
    await loadPembayaranDataRaw();
    refreshPaymentDisplay();
    loadDashboardData();
    showToast(`Semua pembayaran ${personalName} berhasil dihapus`);
  }
  showLoading(false);
}

// ========================================
// PERSONAL CRUD FUNCTIONS
// ========================================

function showAddPersonalModal() {
  document.getElementById("personalModalTitle").textContent = "Tambah Personal";
  document.getElementById("personalForm").reset();
  document.getElementById("personalId").value = "";

  // Reset error states
  const formElements = document.getElementById("personalForm").elements;
  for (let element of formElements) {
    element.classList.remove("is-invalid");
  }

  const modal = new bootstrap.Modal(document.getElementById("personalModal"));
  modal.show();
}

async function editPersonal(rowIndex) {
  // Pastikan rowIndex valid
  if (!rowIndex || rowIndex < 1 || rowIndex >= currentPersonalData.length) {
    showToast("Data tidak ditemukan", "error");
    return;
  }

  const row = currentPersonalData[rowIndex];
  if (!row) {
    showToast("Data tidak ditemukan", "error");
    return;
  }

  // Isi form dengan data yang akan diedit
  document.getElementById("personalModalTitle").textContent = "Edit Personal";
  document.getElementById("personalId").value = rowIndex;
  document.getElementById("personalNama").value = row[0] || "";
  document.getElementById("personalEmail").value = row[1] || "";
  document.getElementById("personalHP").value = row[2] || "";
  document.getElementById("personalStatus").value = row[3] || "Aktif";

  // Reset error states
  const formElements = document.getElementById("personalForm").elements;
  for (let element of formElements) {
    element.classList.remove("is-invalid");
  }

  const modal = new bootstrap.Modal(document.getElementById("personalModal"));
  modal.show();
}

async function savePersonal() {
  const form = document.getElementById("personalForm");
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  showLoading(true);

  const rowIndex = document.getElementById("personalId").value;
  const nama = document.getElementById("personalNama").value.trim();
  const email = document.getElementById("personalEmail").value.trim();
  const hp = document.getElementById("personalHP").value.trim();
  const status = document.getElementById("personalStatus").value;

  // Validasi tambahan
  if (!nama) {
    showToast("Nama personal wajib diisi", "error");
    showLoading(false);
    return;
  }

  const values = [[nama, email, hp, status]];

  let success;
  if (rowIndex && rowIndex !== "") {
    // Mode Edit
    const numericIndex = parseInt(rowIndex);
    success = await writeSheet(
      SHEETS.PERSONAL,
      `A${numericIndex + 1}:D${numericIndex + 1}`,
      values,
    );
    if (success) {
      showToast("Data personal berhasil diperbarui");
    }
  } else {
    // Mode Tambah
    success = await appendSheet(SHEETS.PERSONAL, values);
    if (success) {
      showToast("Data personal berhasil ditambahkan");
    }
  }

  if (success) {
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("personalModal"),
    );
    modal.hide();
    await loadPersonalData();
    loadDashboardData();
  }

  showLoading(false);
}

async function deletePersonal(rowIndex) {
  if (!confirm(`Yakin ingin menghapus data personal ini?`)) return;

  showLoading(true);
  const success = await deleteRow(SHEETS.PERSONAL, rowIndex);
  if (success) {
    await loadPersonalData();
    loadDashboardData();
    showToast("Data personal berhasil dihapus");
  }
  showLoading(false);
}

// ========================================
// TAHUN CRUD FUNCTIONS
// ========================================

function showAddTahunModal() {
  document.getElementById("tahunModalTitle").textContent = "Tambah Tahun";
  document.getElementById("tahunForm").reset();
  document.getElementById("tahunId").value = "";

  // Set default tahun ke tahun saat ini
  const currentYear = new Date().getFullYear();
  document.getElementById("tahunValue").value = currentYear;

  const modal = new bootstrap.Modal(document.getElementById("tahunModal"));
  modal.show();
}

async function editTahun(rowIndex) {
  if (!rowIndex || rowIndex < 1 || rowIndex >= currentTahunData.length) {
    showToast("Data tidak ditemukan", "error");
    return;
  }

  const row = currentTahunData[rowIndex];
  if (!row) {
    showToast("Data tidak ditemukan", "error");
    return;
  }

  document.getElementById("tahunModalTitle").textContent = "Edit Tahun";
  document.getElementById("tahunId").value = rowIndex;
  document.getElementById("tahunValue").value = row[0] || "";
  document.getElementById("tahunKeterangan").value = row[1] || "";
  document.getElementById("tahunStatus").value = row[2] || "Aktif";

  const modal = new bootstrap.Modal(document.getElementById("tahunModal"));
  modal.show();
}

async function saveTahun() {
  const form = document.getElementById("tahunForm");
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  showLoading(true);

  const rowIndex = document.getElementById("tahunId").value;
  const tahunValue = document.getElementById("tahunValue").value;
  const keterangan = document.getElementById("tahunKeterangan").value;
  const status = document.getElementById("tahunStatus").value;

  // Validasi tahun sudah ada
  const tahunExists = currentTahunData.some((row, idx) => {
    if (rowIndex && idx == rowIndex) return false;
    return row[0] == tahunValue;
  });

  if (tahunExists) {
    showToast(`Tahun ${tahunValue} sudah terdaftar`, "error");
    showLoading(false);
    return;
  }

  const values = [[tahunValue, keterangan, status]];

  let success;
  if (rowIndex && rowIndex !== "") {
    const numericIndex = parseInt(rowIndex);
    success = await writeSheet(
      SHEETS.TAHUN,
      `A${numericIndex + 1}:C${numericIndex + 1}`,
      values,
    );
    if (success) showToast("Data tahun berhasil diperbarui");
  } else {
    success = await appendSheet(SHEETS.TAHUN, values);
    if (success) showToast("Data tahun berhasil ditambahkan");
  }

  if (success) {
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("tahunModal"),
    );
    modal.hide();
    await loadTahunData();
    await loadMasterKasData();
  }

  showLoading(false);
}

async function deleteTahun(rowIndex) {
  // Cek apakah tahun digunakan di master kas
  const isUsed = currentMasterKasData.some((row, idx) => {
    if (idx === 0) return false;
    return row[2] == currentTahunData[rowIndex]?.[0];
  });

  if (isUsed) {
    showToast(
      "Tahun ini sedang digunakan di Master Kas, tidak dapat dihapus",
      "error",
    );
    return;
  }

  if (!confirm(`Yakin ingin menghapus data tahun ini?`)) return;

  showLoading(true);
  const success = await deleteRow(SHEETS.TAHUN, rowIndex);
  if (success) {
    await loadTahunData();
    showToast("Data tahun berhasil dihapus");
  }
  showLoading(false);
}

// ========================================
// PEMBAYARAN FUNCTIONS (DIPERBAIKI)
// ========================================

function showAddPembayaranModal() {
  document.getElementById("pembayaranModalTitle").textContent =
    "Tambah Pembayaran";
  document.getElementById("pembayaranForm").reset();
  document.getElementById("pembayaranId").value = "";
  document.getElementById("targetNominal").value = "";
  document.getElementById("totalSudahDibayar").value = "";
  document.getElementById("sisaPreview").value = "";
  document.getElementById("statusPreview").value = "";

  // Set tanggal default ke hari ini
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("pembayaranTanggal").value = today;

  // Setup nominal input dengan formatting
  setupNominalInput("pembayaranNominal", () => {
    updatePaymentPreview();
  });

  const modal = new bootstrap.Modal(document.getElementById("pembayaranModal"));
  modal.show();
}

async function editPembayaran(rowIndex, masterKasId, personalName) {
  // Fungsi ini untuk mengedit semua pembayaran untuk personal dan kas tertentu
  const details = getPaymentDetails(personalName, masterKasId);
  if (details.length === 0) {
    showToast("Tidak ada data pembayaran untuk diedit", "error");
    return;
  }

  // Untuk saat ini, kita tampilkan detail dan beri opsi edit per transaksi
  viewPaymentDetails(personalName, masterKasId);

  // Tambahkan tombol edit pada modal detail
  setTimeout(() => {
    const modalBody = document.querySelector("#detailPaymentModal .modal-body");
    if (modalBody) {
      const editButtons = modalBody.querySelectorAll(".btn-edit-transaction");
      if (editButtons.length === 0) {
        // Tambahkan tombol edit all
        const footer = document.querySelector(
          "#detailPaymentModal .modal-footer",
        );
        if (footer) {
          const editAllBtn = document.createElement("button");
          editAllBtn.className = "btn btn-warning";
          editAllBtn.innerHTML =
            '<i class="bi bi-pencil-square"></i> Edit Semua Transaksi';
          editAllBtn.onclick = () => {
            showEditAllTransactionsModal(personalName, masterKasId);
          };
          footer.insertBefore(editAllBtn, footer.firstChild);
        }
      }
    }
  }, 100);
}

function showEditAllTransactionsModal(personalName, masterKasId) {
  const details = getPaymentDetails(personalName, masterKasId);
  const masterKas = currentMasterKasData[masterKasId];
  const target = masterKas ? parseFloat(masterKas[3] || 0) : 0;

  let transactionsHtml = `
    <div class="mb-3">
      <h6>Edit Transaksi untuk ${personalName}</h6>
      <p>Jenis Kas: ${masterKas ? masterKas[0] : "-"}</p>
      <p>Target: ${formatRupiah(target)}</p>
    </div>
    <div class="table-responsive">
      <table class="table table-sm">
        <thead>
          <tr><th>Tanggal</th><th>Nominal</th><th>Bukti</th><th>Aksi</th></tr>
        </thead>
        <tbody>
  `;

  for (let i = 0; i < details.length; i++) {
    const detail = details[i];
    transactionsHtml += `
      <tr id="transaction-row-${detail.rowIndex}">
        <td><input type="date" class="form-control form-control-sm edit-tanggal" data-idx="${detail.rowIndex}" value="${detail.tanggal}"></td>
        <td><input type="text" class="form-control form-control-sm edit-nominal" data-idx="${detail.rowIndex}" value="${formatNumber(detail.nominal)}"></td>
        <td><input type="url" class="form-control form-control-sm edit-bukti" data-idx="${detail.rowIndex}" value="${detail.bukti || ""}"></td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="deleteSingleTransaction(${detail.rowIndex})">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }

  transactionsHtml += `
        </tbody>
      </table>
    </div>
  `;

  const modalHtml = `
    <div class="modal fade" id="editAllTransactionsModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Edit Transaksi - ${personalName}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            ${transactionsHtml}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
            <button type="button" class="btn btn-primary" onclick="saveAllEditedTransactions('${personalName}', ${masterKasId})">
              <i class="bi bi-save"></i> Simpan Semua Perubahan
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const existingModal = document.getElementById("editAllTransactionsModal");
  if (existingModal) existingModal.remove();

  document.body.insertAdjacentHTML("beforeend", modalHtml);
  const modal = new bootstrap.Modal(
    document.getElementById("editAllTransactionsModal"),
  );
  modal.show();

  // Setup nominal input formatting untuk semua input nominal
  setTimeout(() => {
    const nominalInputs = document.querySelectorAll(
      "#editAllTransactionsModal .edit-nominal",
    );
    nominalInputs.forEach((input) => {
      setupNominalInputForElement(input);
    });
  }, 100);
}

function setupNominalInputForElement(inputElement, onValueChange) {
  const handleInput = (e) => {
    let rawValue = e.target.value.replace(/[^0-9]/g, "");
    if (rawValue === "") {
      e.target.value = "";
      if (onValueChange) onValueChange(0);
      return;
    }
    const numericValue = parseInt(rawValue, 10);
    e.target.value = formatNumber(numericValue);
    if (onValueChange) onValueChange(numericValue);
  };

  inputElement.addEventListener("input", handleInput);

  return {
    input: inputElement,
    getValue: () => {
      const raw = inputElement.value.replace(/[^0-9]/g, "");
      return raw ? parseInt(raw, 10) : 0;
    },
  };
}

async function saveEditedTransaction(
  rowIndex,
  personalName,
  masterKasId,
  target,
) {
  const tanggal = document.getElementById("editTanggal").value;
  const nominalInput = document.getElementById("editNominal");
  const nominalRaw = nominalInput?.value.replace(/[^0-9]/g, "") || "0";
  const nominal = parseInt(nominalRaw) || 0;
  const bukti = document.getElementById("editBukti").value || "";

  if (!tanggal) {
    showToast("Tanggal wajib diisi", "error");
    return;
  }

  if (nominal <= 0) {
    showToast("Nominal harus lebih dari 0", "error");
    return;
  }

  showLoading(true);

  // Hitung total pembayaran lainnya
  const details = getPaymentDetails(personalName, masterKasId);
  let totalLainnya = 0;
  for (const detail of details) {
    if (detail.rowIndex !== rowIndex) {
      totalLainnya += detail.nominal;
    }
  }

  const totalSetelah = totalLainnya + nominal;
  const selisih = totalSetelah - target;

  let status;
  if (selisih === 0) status = "Lunas";
  else if (selisih > 0) status = "Lebih";
  else status = "Kurang";

  const values = [
    [
      personalName,
      tanggal,
      nominal,
      target,
      selisih,
      status,
      bukti,
      masterKasId,
    ],
  ];

  const success = await writeSheet(
    SHEETS.PEMBAYARAN,
    `A${rowIndex + 1}:H${rowIndex + 1}`,
    values,
  );

  if (success) {
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("editTransactionModal"),
    );
    if (modal) modal.hide();

    // Refresh data
    await loadPembayaranDataRaw();
    refreshPaymentDisplay();
    loadDashboardData();

    // Refresh detail modal jika masih terbuka
    const detailModal = document.getElementById("detailPaymentModal");
    if (detailModal && detailModal.classList.contains("show")) {
      // Tutup modal detail
      const modalDetail = bootstrap.Modal.getInstance(detailModal);
      if (modalDetail) modalDetail.hide();

      // Buka ulang dengan data terbaru
      setTimeout(() => {
        viewPaymentDetails(personalName, masterKasId);
      }, 300);
    }

    showToast("Transaksi berhasil diperbarui");
  } else {
    showToast("Gagal menyimpan perubahan", "error");
  }

  showLoading(false);
}

async function saveAllEditedTransactions(personalName, masterKasId) {
  showLoading(true);

  const details = getPaymentDetails(personalName, masterKasId);
  let success = true;

  for (const detail of details) {
    const tanggalInput = document.querySelector(
      `#transaction-row-${detail.rowIndex} .edit-tanggal`,
    );
    const nominalInput = document.querySelector(
      `#transaction-row-${detail.rowIndex} .edit-nominal`,
    );
    const buktiInput = document.querySelector(
      `#transaction-row-${detail.rowIndex} .edit-bukti`,
    );

    if (tanggalInput && nominalInput) {
      const newTanggal = tanggalInput.value;
      const newNominalRaw = nominalInput.value.replace(/[^0-9]/g, "");
      const newNominal = parseInt(newNominalRaw) || 0;
      const newBukti = buktiInput?.value || "";

      const masterKas = currentMasterKasData[masterKasId];
      const target = masterKas ? parseFloat(masterKas[3] || 0) : 0;

      // Hitung ulang total pembayaran setelah perubahan
      let totalSetelah = 0;
      for (const d of details) {
        if (d.rowIndex === detail.rowIndex) {
          totalSetelah += newNominal;
        } else {
          totalSetelah += d.nominal;
        }
      }

      const selisih = totalSetelah - target;
      let status;
      if (selisih === 0) status = "Lunas";
      else if (selisih > 0) status = "Lebih";
      else status = "Kurang";

      const values = [
        [
          personalName,
          newTanggal,
          newNominal,
          target,
          selisih,
          status,
          newBukti,
          masterKasId,
        ],
      ];

      const writeSuccess = await writeSheet(
        SHEETS.PEMBAYARAN,
        `A${detail.rowIndex + 1}:H${detail.rowIndex + 1}`,
        values,
      );

      if (!writeSuccess) success = false;
    }
  }

  if (success) {
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("editAllTransactionsModal"),
    );
    modal.hide();
    await loadPembayaranDataRaw();
    refreshPaymentDisplay();
    loadDashboardData();
    showToast("Semua perubahan berhasil disimpan");
  } else {
    showToast("Terjadi kesalahan saat menyimpan", "error");
  }

  showLoading(false);
}

async function deleteSingleTransaction(rowIndex, personalName, masterKasId) {
  if (!confirm("Yakin ingin menghapus transaksi ini?")) return;

  showLoading(true);
  const success = await deleteRow(SHEETS.PEMBAYARAN, rowIndex);

  if (success) {
    await loadPembayaranDataRaw();
    refreshPaymentDisplay();
    loadDashboardData();

    // Refresh detail modal jika masih terbuka
    const detailModal = document.getElementById("detailPaymentModal");
    if (detailModal && detailModal.classList.contains("show")) {
      const modalDetail = bootstrap.Modal.getInstance(detailModal);
      if (modalDetail) modalDetail.hide();

      setTimeout(() => {
        viewPaymentDetails(personalName, masterKasId);
      }, 300);
    }

    showToast("Transaksi berhasil dihapus");
  }

  showLoading(false);
}

function showAddPaymentForPersonal(personalName, masterKasId) {
  // Tutup modal detail terlebih dahulu
  const detailModal = document.getElementById("detailPaymentModal");
  if (detailModal) {
    const modal = bootstrap.Modal.getInstance(detailModal);
    if (modal) modal.hide();
  }

  // Buka modal tambah pembayaran dengan data yang sudah terisi
  document.getElementById("pembayaranModalTitle").textContent =
    "Tambah Pembayaran";
  document.getElementById("pembayaranForm").reset();
  document.getElementById("pembayaranId").value = "";
  document.getElementById("targetNominal").value = "";
  document.getElementById("totalSudahDibayar").value = "";
  document.getElementById("sisaPreview").value = "";
  document.getElementById("statusPreview").value = "";

  // Set tanggal default ke hari ini
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("pembayaranTanggal").value = today;

  // Set personal dan master kas
  document.getElementById("pembayaranPersonal").value = personalName;
  document.getElementById("pembayaranMasterKas").value = masterKasId;

  // Trigger update preview
  setTimeout(() => {
    updateTargetNominal();
  }, 100);

  // Setup nominal input dengan formatting
  setupNominalInput("pembayaranNominal", () => {
    updatePaymentPreview();
  });

  const modal = new bootstrap.Modal(document.getElementById("pembayaranModal"));
  modal.show();
}

async function refreshPaymentData() {
  showLoading(true);
  await loadPembayaranDataRaw();
  refreshPaymentDisplay();
  loadDashboardData();
  showLoading(false);
  showToast("Data berhasil di-refresh");
}

async function savePembayaran() {
  const form = document.getElementById("pembayaranForm");
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  showLoading(true);

  const select = document.getElementById("pembayaranMasterKas");
  const option = select.options[select.selectedIndex];
  const maxNominal = parseFloat(option.getAttribute("data-max") || 0);
  const personalName = document.getElementById("pembayaranPersonal").value;
  const masterKasId = select.value;
  const tanggal = document.getElementById("pembayaranTanggal").value;
  const nominalInput = document.getElementById("pembayaranNominal");
  const nominal = parseInt(nominalInput.value.replace(/[^0-9]/g, "") || 0);
  const bukti = document.getElementById("pembayaranBukti").value || "";

  // Validasi
  if (!personalName) {
    showToast("Pilih personal terlebih dahulu", "error");
    showLoading(false);
    return;
  }

  if (!masterKasId) {
    showToast("Pilih jenis kas terlebih dahulu", "error");
    showLoading(false);
    return;
  }

  if (!tanggal) {
    showToast("Tanggal pembayaran wajib diisi", "error");
    showLoading(false);
    return;
  }

  if (nominal <= 0) {
    showToast("Nominal pembayaran harus lebih dari 0", "error");
    showLoading(false);
    return;
  }

  const totalSudahDibayar = getTotalPembayaranPerPersonalKas(
    personalName,
    parseInt(masterKasId),
  );
  const totalSetelah = totalSudahDibayar + nominal;
  const selisih = totalSetelah - maxNominal;

  let status;
  if (selisih === 0) status = "Lunas";
  else if (selisih > 0) status = "Lebih";
  else status = "Kurang";

  const values = [
    [
      personalName,
      tanggal,
      nominal,
      maxNominal,
      selisih,
      status,
      bukti,
      masterKasId,
    ],
  ];

  const success = await appendSheet(SHEETS.PEMBAYARAN, values);

  if (success) {
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("pembayaranModal"),
    );
    if (modal) modal.hide();
    await loadPembayaranDataRaw();
    refreshPaymentDisplay();
    loadDashboardData();
    showToast("Pembayaran berhasil ditambahkan");
  }

  showLoading(false);
}

async function deletePaymentAggregate(masterKasId, personalName) {
  if (!confirm(`Hapus semua pembayaran untuk ${personalName} pada kas ini?`))
    return;

  showLoading(true);
  const details = getPaymentDetails(personalName, masterKasId);
  let success = true;

  for (let i = details.length - 1; i >= 0; i--) {
    const detail = details[i];
    const delSuccess = await deleteRow(SHEETS.PEMBAYARAN, detail.rowIndex);
    if (!delSuccess) success = false;
  }

  if (success) {
    await loadPembayaranDataRaw();
    refreshPaymentDisplay();
    loadDashboardData();
    showToast(`Semua pembayaran ${personalName} berhasil dihapus`);
  }
  showLoading(false);
}

// ========================================
// MASTER KAS CRUD FUNCTIONS
// ========================================

function showAddMasterKasModal() {
  document.getElementById("masterKasModalTitle").textContent =
    "Tambah Master Kas";
  document.getElementById("masterKasForm").reset();
  document.getElementById("masterKasId").value = "";
  setupNominalInput("masterKasMax");
  new bootstrap.Modal(document.getElementById("masterKasModal")).show();
}

async function editMasterKas(rowIndex) {
  const row = currentMasterKasData[rowIndex];
  document.getElementById("masterKasModalTitle").textContent =
    "Edit Master Kas";
  document.getElementById("masterKasId").value = rowIndex;
  document.getElementById("masterKasNama").value = row[0];
  document.getElementById("masterKasPeriode").value = row[1];
  document.getElementById("masterKasTahun").value = row[2];
  const nominalInput = setupNominalInput("masterKasMax");
  if (nominalInput) nominalInput.setValue(parseFloat(row[3] || 0));
  document.getElementById("masterKasStatus").value = row[4];
  new bootstrap.Modal(document.getElementById("masterKasModal")).show();
}

async function saveMasterKas() {
  const form = document.getElementById("masterKasForm");
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  showLoading(true);
  const rowIndex = document.getElementById("masterKasId").value;
  const nominalInput = document.getElementById("masterKasMax");
  const nominalValue = nominalInput.value.replace(/[^0-9]/g, "");
  const values = [
    [
      document.getElementById("masterKasNama").value,
      document.getElementById("masterKasPeriode").value,
      document.getElementById("masterKasTahun").value,
      nominalValue || "0",
      document.getElementById("masterKasStatus").value,
    ],
  ];
  let success;
  if (rowIndex) {
    success = await writeSheet(
      SHEETS.MASTER_KAS,
      `A${parseInt(rowIndex) + 1}:E${parseInt(rowIndex) + 1}`,
      values,
    );
  } else {
    success = await appendSheet(SHEETS.MASTER_KAS, values);
  }
  if (success) {
    bootstrap.Modal.getInstance(
      document.getElementById("masterKasModal"),
    ).hide();
    await loadMasterKasData();
    loadDashboardData();
    showToast("Data master kas berhasil disimpan");
  }
  showLoading(false);
}

async function deleteMasterKas(rowIndex) {
  showLoading(true);
  const success = await deleteRow(SHEETS.MASTER_KAS, rowIndex);
  if (success) {
    await loadMasterKasData();
    loadDashboardData();
    showToast("Data master kas berhasil dihapus");
  }
  showLoading(false);
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

function viewBukti(url) {
  document.getElementById("buktiFrame").src = url;
  new bootstrap.Modal(document.getElementById("buktiModal")).show();
}

// Setup filter listeners
document.addEventListener("DOMContentLoaded", () => {
  const filterKas = document.getElementById("filterMasterKas");
  const filterStatus = document.getElementById("filterStatusPembayaran");

  if (filterKas) {
    filterKas.addEventListener("change", () => refreshPaymentDisplay());
  }
  if (filterStatus) {
    filterStatus.addEventListener("change", () => refreshPaymentDisplay());
  }

  const tabs = document.querySelectorAll("#mainTabs button");
  tabs.forEach((tab) => {
    tab.addEventListener("shown.bs.tab", (event) => {
      const targetId = event.target.getAttribute("data-bs-target");
      if (targetId === "#pembayaran") {
        refreshPaymentDisplay();
      } else if (targetId === "#personal") {
        loadPersonalData();
      } else if (targetId === "#tahun") {
        loadTahunData();
      } else if (targetId === "#master-kas") {
        loadMasterKasData();
      }
    });
  });

  showDashboard();
});

// ========================================
// EXPOSE FUNCTIONS TO WINDOW
// ========================================

window.handleAuthClick = handleAuthClick;
window.handleSignoutClick = handleSignoutClick;
window.showDashboard = showDashboard;
window.showDataMaster = showDataMaster;
window.showAddPersonalModal = showAddPersonalModal;
window.editPersonal = editPersonal;
window.savePersonal = savePersonal;
window.deletePersonal = deletePersonal;
window.showAddTahunModal = showAddTahunModal;
window.editTahun = editTahun;
window.saveTahun = saveTahun;
window.deleteTahun = deleteTahun;
window.showAddMasterKasModal = showAddMasterKasModal;
window.editMasterKas = editMasterKas;
window.saveMasterKas = saveMasterKas;
window.deleteMasterKas = deleteMasterKas;
window.showAddPembayaranModal = showAddPembayaranModal;
window.updateTargetNominal = updateTargetNominal;
window.calculateStatus = calculateStatus;
window.savePembayaran = savePembayaran;
window.viewPaymentDetails = viewPaymentDetails;
window.editPaymentAggregate = editPaymentAggregate;
window.deletePaymentAggregate = deletePaymentAggregate;
window.viewBukti = viewBukti;
window.showEditAllTransactionsModal = showEditAllTransactionsModal;
window.deleteSingleTransaction = deleteSingleTransaction;
window.saveAllEditedTransactions = saveAllEditedTransactions;
window.editPembayaran = editPembayaran;
window.editSingleTransaction = editSingleTransaction;
window.saveEditedTransaction = saveEditedTransaction;
window.showAddPaymentForPersonal = showAddPaymentForPersonal;
window.refreshPaymentData = refreshPaymentData;
window.updateEditPreview = updateEditPreview;

// ========================================
// INITIALIZATION
// ========================================

function initGoogleAPI() {
  const script1 = document.createElement("script");
  script1.src = "https://apis.google.com/js/api.js";
  script1.onload = gapiLoaded;
  document.body.appendChild(script1);
  const script2 = document.createElement("script");
  script2.src = "https://accounts.google.com/gsi/client";
  script2.onload = gisLoaded;
  document.body.appendChild(script2);
}

initGoogleAPI();
