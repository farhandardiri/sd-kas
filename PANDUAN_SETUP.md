# PANDUAN SETUP APLIKASI PEMBAYARAN KAS

## 🔧 LANGKAH SETUP

### 1. BUAT GOOGLE SPREADSHEET

1. Buka Google Sheets: https://sheets.google.com
2. Buat spreadsheet baru dengan nama "Database Kas"
3. Buat 4 sheet dengan nama persis seperti ini:
   - **Personal**
   - **Tahun**
   - **MasterKas**
   - **Pembayaran**

### 2. SETUP STRUKTUR TABEL

#### Sheet: Personal
Baris 1 (Header):
| Nama | Email | No HP | Status |

Contoh data baris 2:
| John Doe | john@email.com | 081234567890 | Aktif |

---

#### Sheet: Tahun
Baris 1 (Header):
| Tahun | Keterangan | Status |

Contoh data baris 2:
| 2024 | Tahun Ajaran 2024 | Aktif |

---

#### Sheet: MasterKas
Baris 1 (Header):
| Nama Kas | Periode | Tahun | Maksimal Setoran | Status |

Contoh data baris 2:
| Kas Bulanan | Januari-Maret 2024 | 2024 | 100000 | Aktif |

---

#### Sheet: Pembayaran
Baris 1 (Header):
| Nama Personal | Tanggal | Nominal | Target | Selisih | Status | Bukti |

Contoh data baris 2:
| John Doe | 2024-01-15 | 100000 | 100000 | 0 | Lunas | https://drive.google.com/... |

---

### 3. DAPATKAN SPREADSHEET ID

1. Buka spreadsheet yang sudah dibuat
2. Lihat URL di browser, contoh:
   ```
   https://docs.google.com/spreadsheets/d/1abc123XYZ456/edit
   ```
3. Copy bagian antara `/d/` dan `/edit` → `1abc123XYZ456`
4. Ini adalah **SPREADSHEET_ID** Anda

---

### 4. SETUP GOOGLE CLOUD PROJECT

#### A. Buat Project Baru
1. Buka: https://console.cloud.google.com
2. Klik dropdown project → "New Project"
3. Nama project: "Aplikasi Kas"
4. Klik "Create"

#### B. Enable Google Sheets API
1. Di dashboard, cari "Google Sheets API"
2. Klik "Enable"

#### C. Buat API Key
1. Menu: APIs & Services → Credentials
2. Klik "Create Credentials" → "API Key"
3. Copy **API_KEY** yang muncul
4. (Opsional) Klik "Restrict Key" → pilih "Google Sheets API"

#### D. Buat OAuth 2.0 Client ID
1. Menu: APIs & Services → Credentials
2. Klik "Create Credentials" → "OAuth client ID"
3. Jika diminta, setup "OAuth consent screen" dulu:
   - User Type: External
   - App name: Aplikasi Kas
   - User support email: email Anda
   - Developer contact: email Anda
   - Scopes: Tidak perlu tambah scope
   - Test users: Tambahkan email Anda
4. Kembali ke Credentials → "Create Credentials" → "OAuth client ID"
5. Application type: **Web application**
6. Name: "Aplikasi Kas Web Client"
7. Authorized JavaScript origins: 
   - `http://localhost`
   - `http://localhost:8000`
   - (Atau domain website Anda jika sudah ada)
8. Klik "Create"
9. Copy **CLIENT_ID** (format: xxxx.apps.googleusercontent.com)

---

### 5. KONFIGURASI FILE HTML

Buka file `kas-app.html`, cari bagian ini (sekitar baris 460):

```javascript
const CONFIG = {
    CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
    API_KEY: 'YOUR_GOOGLE_API_KEY',
    SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID',
    SCOPES: 'https://www.googleapis.com/auth/spreadsheets'
};
```

Ganti dengan data Anda:
```javascript
const CONFIG = {
    CLIENT_ID: '123456789-abcdef.apps.googleusercontent.com',  // Dari langkah 4D
    API_KEY: 'AIzaSyABCDEF123456789',                        // Dari langkah 4C
    SPREADSHEET_ID: '1abc123XYZ456',                          // Dari langkah 3
    SCOPES: 'https://www.googleapis.com/auth/spreadsheets'
};
```

---

### 6. SETUP SHARING SPREADSHEET

1. Buka spreadsheet Anda
2. Klik tombol "Share" di kanan atas
3. Pilih "Anyone with the link" → "Viewer"
4. Atau tambahkan email spesifik yang boleh akses

---

### 7. JALANKAN APLIKASI

#### Opsi 1: Menggunakan Local Server (Recommended)
```bash
# Menggunakan Python
python -m http.server 8000

# Atau menggunakan PHP
php -S localhost:8000

# Atau menggunakan Node.js
npx http-server -p 8000
```

Buka browser: `http://localhost:8000/kas-app.html`

#### Opsi 2: Upload ke Hosting
1. Upload file `kas-app.html` ke hosting Anda
2. Update "Authorized JavaScript origins" di Google Cloud Console dengan domain hosting Anda

---

## 🎯 CARA MENGGUNAKAN

### Tanpa Login (View Only):
- Buka aplikasi
- Anda bisa melihat semua data di 4 tab
- Tombol tambah/edit/hapus akan disabled

### Dengan Login (Full Access):
1. Klik "Login dengan Google"
2. Pilih akun Google Anda
3. Izinkan akses ke Google Sheets
4. Setelah login, semua tombol akan aktif:
   - ✅ Tambah data
   - ✅ Edit data
   - ✅ Hapus data

---

## 📋 FITUR APLIKASI

### 1. Master Personal
- Kelola data anggota/personal
- Field: Nama, Email, No HP, Status (Aktif/Non-Aktif)

### 2. Master Tahun
- Kelola data tahun periode
- Field: Tahun, Keterangan, Status

### 3. Master Pembayaran Kas
- Kelola jenis-jenis kas dengan periode custom
- Field: Nama Kas, Periode, Tahun, Maksimal Setoran, Status

### 4. Pembayaran Kas
- Input transaksi pembayaran
- Otomatis menghitung status: Lunas/Kurang/Lebih
- Upload bukti pembayaran (link Google Drive)
- Filter by nama & status
- **Logika perhitungan per transaksi:**
  - Nominal = Target → Status: **Lunas**
  - Nominal > Target → Status: **Lebih**
  - Nominal < Target → Status: **Kurang**

---

## 🔒 KEAMANAN

- OAuth Google memastikan hanya user yang login bisa edit
- Data tersimpan di Google Sheets milik Anda
- Bisa set permission spreadsheet sesuai kebutuhan

---

## 🐛 TROUBLESHOOTING

### Error: "Access blocked: This app's request is invalid"
**Solusi**: 
- Pastikan OAuth consent screen sudah disetup
- Tambahkan email Anda ke "Test users"

### Data tidak muncul
**Solusi**:
- Cek SPREADSHEET_ID sudah benar
- Cek nama sheet PERSIS seperti panduan (case-sensitive)
- Cek spreadsheet sharing settings

### Login tidak muncul
**Solusi**:
- Buka lewat http server (bukan file:/// protocol)
- Clear browser cache
- Cek CLIENT_ID dan API_KEY sudah benar

### Error CORS
**Solusi**:
- Jalankan dengan local server, bukan buka file langsung
- Update Authorized JavaScript origins di Google Cloud

---

## 📞 TIPS

1. **Backup data**: Export spreadsheet secara berkala
2. **Bukti pembayaran**: Upload gambar ke Google Drive, set "Anyone with link can view", copy link
3. **Performance**: Jika data sudah banyak (>1000 baris), pertimbangkan arsip data lama
4. **Mobile**: Aplikasi responsive, bisa diakses dari HP

---

## 🎨 KUSTOMISASI

Anda bisa edit CSS di file HTML untuk mengubah:
- Warna tema (cari `--primary-color`, `--success-color`, dll)
- Logo navbar
- Font
- Layout

---

Selamat menggunakan! 🎉
