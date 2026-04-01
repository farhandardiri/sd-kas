// ========================================
// MODUL UTILITIES & FORMATTERS
// ========================================

// Format mata uang Rupiah
export function formatRupiah(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "Rp 0";
  }
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Parse format Rupiah ke number
export function parseRupiah(rupiahString) {
  if (!rupiahString) return 0;
  const cleanString = rupiahString.replace(/[^0-9,-]/g, "").replace(",", ".");
  return parseFloat(cleanString) || 0;
}

// Format angka dengan pemisah ribuan
export function formatNumber(number) {
  if (number === null || number === undefined || isNaN(number)) {
    return "0";
  }
  return new Intl.NumberFormat("id-ID").format(number);
}

// Format tanggal ke format Indonesia
export function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

// Format tanggal untuk input date (YYYY-MM-DD)
export function formatDateInput(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Hitung selisih dan status pembayaran
export function calculatePaymentStatus(nominal, target) {
  const nominalNum = parseFloat(nominal) || 0;
  const targetNum = parseFloat(target) || 0;
  const selisih = nominalNum - targetNum;

  let status;
  if (selisih === 0) {
    status = "Lunas";
  } else if (selisih > 0) {
    status = "Lebih";
  } else {
    status = "Kurang";
  }

  return {
    selisih: selisih,
    status: status,
    selisihAbs: Math.abs(selisih),
    statusText:
      status === "Lunas"
        ? "Lunas"
        : `${status} (Rp ${formatNumber(Math.abs(selisih))})`,
  };
}

// Validasi nominal input
export function validateNominalInput(value) {
  // Hanya menerima angka dan titik/koma
  let cleaned = value.toString().replace(/[^0-9]/g, "");
  if (cleaned === "") return "";
  return parseInt(cleaned, 10);
}

// Event handler untuk input nominal dengan format Rupiah
export function setupNominalInputHandler(inputElement, onUpdate) {
  const handleInput = (e) => {
    let rawValue = e.target.value.replace(/[^0-9]/g, "");
    if (rawValue === "") {
      e.target.value = "";
      if (onUpdate) onUpdate(0);
      return;
    }

    const numericValue = parseInt(rawValue, 10);
    e.target.value = formatNumber(numericValue);
    if (onUpdate) onUpdate(numericValue);
  };

  inputElement.addEventListener("input", handleInput);
  inputElement.addEventListener("focus", (e) => {
    // Hapus format saat focus untuk memudahkan edit
    const raw = e.target.value.replace(/[^0-9]/g, "");
    if (raw) e.target.value = raw;
  });

  inputElement.addEventListener("blur", (e) => {
    // Format ulang saat blur
    const raw = e.target.value.replace(/[^0-9]/g, "");
    if (raw) {
      e.target.value = formatNumber(parseInt(raw, 10));
    }
  });

  return handleInput;
}

// Setup input nominal dengan formatting otomatis
export function setupNominalInput(inputId, onValueChange) {
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

// Loading overlay
export function showLoading(show) {
  const overlay = document.getElementById("loadingOverlay");
  if (show) {
    overlay.classList.add("show");
  } else {
    overlay.classList.remove("show");
  }
}

// Filter data di tabel
export function setupFilter(
  tableId,
  searchInputId,
  filterSelectId,
  columnMapping,
) {
  const searchInput = document.getElementById(searchInputId);
  const filterSelect = document.getElementById(filterSelectId);
  const tbody = document.getElementById(tableId);

  const filterData = () => {
    const searchTerm = searchInput?.value.toLowerCase() || "";
    const filterValue = filterSelect?.value || "";
    const rows = tbody.querySelectorAll("tr");

    rows.forEach((row) => {
      const searchText = columnMapping.search
        ? row.cells[columnMapping.search]?.textContent.toLowerCase() || ""
        : "";
      const filterText = columnMapping.filter
        ? row.cells[columnMapping.filter]?.textContent || ""
        : "";

      const matchSearch = !searchTerm || searchText.includes(searchTerm);
      const matchFilter = !filterValue || filterText.includes(filterValue);

      row.style.display = matchSearch && matchFilter ? "" : "none";
    });
  };

  if (searchInput) searchInput.addEventListener("input", filterData);
  if (filterSelect) filterSelect.addEventListener("change", filterData);

  return filterData;
}

// Toast notification
export function showToast(message, type = "success") {
  // Buat element toast jika belum ada
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
        <div class="toast-body">
          ${message}
        </div>
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

// Export default untuk kemudahan
export default {
  formatRupiah,
  parseRupiah,
  formatNumber,
  formatDate,
  formatDateInput,
  calculatePaymentStatus,
  validateNominalInput,
  setupNominalInput,
  setupNominalInputHandler,
  showLoading,
  setupFilter,
  showToast,
};
