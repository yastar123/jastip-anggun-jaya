# Dokumentasi Lengkap — Jastip Anggun Jaya

Platform manajemen jastip ekspedisi untuk bisnis **Jastip Anggun Jaya**, meliputi pengelolaan paket masuk, penyerahan ke customer, pembayaran, dan laporan keuangan owner.

---

## Daftar Isi

1. [Gambaran Umum](#1-gambaran-umum)
2. [Login & Akun](#2-login--akun)
3. [Halaman Admin](#3-halaman-admin)
   - [Dashboard Admin](#31-dashboard-admin)
   - [Input Paket — 1 Paket](#32-input-paket--1-paket)
   - [Input Paket — Grup Paket](#33-input-paket--grup-paket)
   - [Import Excel](#34-import-excel)
   - [Label Barcode](#35-label-barcode)
   - [Scan Barcode & Pembayaran](#36-scan-barcode--pembayaran)
   - [Verifikasi Paket](#37-verifikasi-paket)
   - [Riwayat Pembayaran](#38-riwayat-pembayaran)
4. [Halaman Owner](#4-halaman-owner)
   - [Dashboard Owner](#41-dashboard-owner)
   - [Monitor Paket](#42-monitor-paket)
   - [Data Admin](#43-data-admin)
   - [Keuangan](#44-keuangan)
   - [Laporan](#45-laporan)
   - [Manajemen User](#46-manajemen-user)
5. [Rumus Perhitungan Ongkir](#5-rumus-perhitungan-ongkir)
   - [Berat Volume & Berat Pakai](#51-berat-volume--berat-pakai)
   - [Jastip Pesawat](#52-jastip-pesawat)
   - [Jastip Hemat+](#53-jastip-hemat)
   - [Jastip Kargo](#54-jastip-kargo)
   - [Jastip Pelni](#55-jastip-pelni)
6. [Status Paket](#6-status-paket)
7. [Format Barcode](#7-format-barcode)
8. [Alur Penggunaan Lengkap](#8-alur-penggunaan-lengkap)

---

## 1. Gambaran Umum

Jastip Anggun Jaya adalah layanan ekspedisi dari kota-kota besar (Jakarta, Surabaya, Makassar) ke **Manokwari, Papua Barat**. Platform ini digunakan oleh dua peran:

| Peran | Fungsi Utama |
|-------|-------------|
| **Admin** | Input paket, cetak label barcode, scan & serahkan paket, catat pembayaran |
| **Owner** | Pantau semua paket, lihat laporan keuangan, kelola akun admin |

---

## 2. Login & Akun

### Halaman Login
URL: `/` (halaman utama)

**Cara login:**
1. Masukkan **Nomor HP** (format: 08xxxxxxxxxx)
2. Masukkan **Password**
3. Klik **Masuk**

Sistem akan otomatis mengarahkan ke dashboard sesuai peran (admin → `/admin/dashboard`, owner → `/owner/dashboard`).

**Akun demo bawaan:**

| Peran | Nomor HP | Password |
|-------|----------|----------|
| Owner | 081200000000 | owner123 |
| Admin | 081200000001 | admin123 |

**Keamanan:**
- Password di-hash menggunakan SHA-256 + salt `jaj_salt_2024`
- Token autentikasi disimpan di `localStorage` (key: `jaj_token`)
- Sesi berlaku selama 7 hari

---

## 3. Halaman Admin

### 3.1 Dashboard Admin

URL: `/admin/dashboard`

Menampilkan ringkasan operasional hari ini dan grafik aktivitas.

**Kartu statistik (4 kotak atas):**
- **Total Paket** — jumlah semua paket yang pernah diinput
- **Paket Pending** — paket yang belum diserahkan ke customer
- **Paket Diserahkan** — paket yang sudah diserahkan
- **Paket Masuk Hari Ini** — jumlah paket yang diinput hari ini

**Grafik batang:**
- Menampilkan paket masuk vs paket keluar (diserahkan)
- Filter periode: **Minggu ini / Bulan ini / Tahun ini**

**Tabel paket terbaru:**
- Menampilkan 10 paket terakhir dari semua admin
- Klik baris → langsung ke detail paket di halaman Label Barcode

---

### 3.2 Input Paket — 1 Paket

URL: `/admin/packages/new` → Tab **1 Paket**

Digunakan untuk memasukkan satu paket secara manual.

**Field yang diisi:**

| Field | Keterangan |
|-------|-----------|
| Nama Customer | Nama penerima paket |
| Nama Barang | Deskripsi isi paket |
| Jenis Jastip | Pilih layanan: Pesawat / Hemat+ / Kargo / Pelni |
| Rute Pengiriman | Otomatis terisi sesuai jenis jastip |
| No. Resi | Nomor resi dari pengirim (bisa dikosongkan) |
| No. Paket | Nomor urut internal (opsional) |
| Tanggal Paket | Tanggal paket diterima (default: hari ini) |
| Jenis Packaging | Karton / Plastik / Kayu / Bubble Wrap / Karung / Lainnya |
| Berat Asli (kg) | Berat timbangan fisik |
| Panjang / Lebar / Tinggi (cm) | **Wajib diisi untuk Jastip Kargo** |
| Harga Kubikasi | Khusus kargo — tarif per M³/Ton (otomatis terisi dari tarif default) |

**Setelah simpan:**
- Barcode JAJ otomatis dibuat
- Paket langsung bisa dicetak dari halaman Label Barcode
- Status awal: **Pending**

---

### 3.3 Input Paket — Grup Paket

URL: `/admin/packages/new` → Tab **Grup Paket**

Digunakan saat ada banyak paket dari customer yang sama, layanan yang sama, dan tanggal yang sama — input lebih cepat karena data tersebut tidak perlu diulang.

**Cara kerja:**
1. Isi **Nama Customer**, **Jenis Jastip**, **Tanggal** sekali di awal
2. Tambah paket satu per satu — cukup isi nama barang, berat, dan dimensi
3. Klik **Tambah** untuk menambah paket berikutnya
4. Klik **Simpan Semua** untuk menyimpan seluruh grup sekaligus

**Keunggulan mode Grup:**
- Customer/layanan/tanggal tidak perlu diisi ulang tiap paket
- Ongkir dihitung otomatis untuk setiap entri
- Semua paket dalam satu grup bisa langsung dicetak labelnya sekaligus

---

### 3.4 Import Excel

URL: `/admin/packages/import`

Memungkinkan input banyak paket sekaligus dari file Excel/CSV.

**Langkah penggunaan:**
1. **Unduh template** — klik tombol "Unduh Template Excel" untuk mendapatkan format yang benar
2. **Isi template** — isi data paket sesuai kolom yang tersedia
3. **Upload file** — drag & drop atau klik untuk pilih file `.xlsx` / `.csv`
4. **Preview & validasi** — sistem menampilkan tabel hasil parsing; baris error ditandai merah
5. **Konfirmasi import** — klik "Import Paket" untuk menyimpan semua data yang valid

**Kolom template Excel:**

| Kolom | Keterangan | Wajib? |
|-------|-----------|--------|
| Nama Customer | Nama penerima | Ya |
| Nama Barang | Deskripsi barang | Ya |
| Jenis Jastip | `jastip pesawat` / `jastip hemat+` / `jastip kargo` / `jastip pelni` | Ya |
| Rute | Rute pengiriman | Ya |
| No. Resi | Nomor resi pengirim | Tidak |
| No. Paket | Nomor urut internal | Tidak |
| Tanggal | Format YYYY-MM-DD | Tidak |
| Berat Asli (kg) | Berat timbangan | Ya |
| Panjang (cm) | Dimensi panjang | Kargo: Ya |
| Lebar (cm) | Dimensi lebar | Kargo: Ya |
| Tinggi (cm) | Dimensi tinggi | Kargo: Ya |
| Jenis Packaging | karton / plastik / kayu / bubble_wrap / sack / lainnya | Tidak |

Ongkir dihitung otomatis oleh sistem saat import — tidak perlu diisi di Excel.

---

### 3.5 Label Barcode

URL: `/admin/barcode`

Pusat manajemen paket dan pencetakan label.

**Fitur pencarian & filter:**
- Cari berdasarkan nama customer, nomor resi, nama barang
- Filter berdasarkan jenis jastip
- Filter berdasarkan status (pending / diserahkan)
- Pagination 15 paket per halaman

**Aksi per paket:**
| Aksi | Keterangan |
|------|-----------|
| **Cetak Label** | Membuka halaman cetak label A4 lengkap dengan barcode QR |
| **Edit** | Ubah data paket (nama, resi, layanan, berat, dimensi, dll) |
| **Hapus** | Hapus paket dari sistem (dengan konfirmasi) |

**Tab tampilan:**
- **1 Paket** — cetak label satu paket per halaman A4
- **Grup Paket** — tampilkan semua paket dalam satu grup, cetak sekaligus

**Isi label cetak (A4):**
- Logo Jastip Anggun Jaya
- Barcode QR + kode JAJ
- Nama customer, nama barang, jenis jastip
- Rute pengiriman, tanggal, berat asli/volume/pakai
- Ongkir

---

### 3.6 Scan Barcode & Pembayaran

URL: `/admin/scan`

Halaman untuk memproses penyerahan paket ke customer dan mencatat pembayaran.

**Cara scan:**
1. **Kamera** — klik ikon kamera, arahkan ke QR barcode paket
2. **Upload foto** — upload gambar barcode dari galeri
3. **Input manual** — ketik kode JAJ secara langsung

**Setelah scan berhasil:**
Paket masuk ke **Keranjang Serah** (bisa scan banyak paket sekaligus sebelum konfirmasi).

**Proses penyerahan (per paket di keranjang):**
1. Pilih **Jenis Pembayaran:**
   - **Tunai** — bayar cash langsung
   - **Transfer** — transfer bank / QRIS
   - **Piutang** — bayar nanti / hutang
2. Klik **Serahkan** untuk konfirmasi — status paket berubah menjadi `diserahkan`
3. Atau klik **Tolak** untuk mengeluarkan paket dari keranjang (paket tetap `pending`)

**Fitur tambahan:**
- **Serahkan Semua** — serahkan seluruh paket dalam keranjang sekaligus dengan satu jenis pembayaran
- Riwayat scan sesi ditampilkan di bawah keranjang

---

### 3.7 Verifikasi Paket

URL: `/admin/verify`

Digunakan untuk memverifikasi kesesuaian paket fisik dengan data di sistem — biasanya saat paket tiba dari kota asal.

**Cara kerja:**
1. Pilih **nama customer** dari daftar di kiri (bisa dicari)
2. Scan barcode paket fisik (kamera / upload / manual)
3. Sistem mencocokkan barcode dengan paket milik customer tersebut:
   - **Cocok (✓)** — paket ditemukan dan sesuai nama customer
   - **Tidak Cocok (✗)** — barcode tidak ada, atau nama customer berbeda

**Output:**
- Riwayat verifikasi ditampilkan per sesi
- Bisa diexport ke Excel untuk keperluan arsip

---

### 3.8 Riwayat Pembayaran

URL: `/admin/riwayat-pembayaran`

Menampilkan semua paket yang sudah diserahkan beserta metode pembayarannya.

**Informasi yang ditampilkan:**
- Nama customer, nama barang, jenis jastip
- Tanggal serah, ongkir, jenis pembayaran (Tunai / Transfer / Piutang)
- Status piutang — bisa ditandai **Lunas** dari halaman ini

**Filter:**
- Filter berdasarkan jenis pembayaran
- Filter berdasarkan status piutang (belum lunas / lunas)

**Aksi Piutang:**
- Klik **Tandai Lunas** pada pembayaran piutang → status berubah menjadi lunas

---

## 4. Halaman Owner

### 4.1 Dashboard Owner

URL: `/owner/dashboard`

Sama dengan dashboard admin tetapi menampilkan data dari **semua admin** secara agregat. Owner bisa memantau performa keseluruhan bisnis.

---

### 4.2 Monitor Paket

URL: `/owner/packages`

Tampilan daftar semua paket dari seluruh admin.

**Fitur:**
- Cari berdasarkan nama customer, nomor resi, nama barang
- Filter status: Semua / Pending / Diserahkan
- Lihat detail per paket (nama barang, berat, ongkir, tanggal, admin yang input)
- Export ke Excel

**Aksi owner dari halaman ini:**
- Owner bisa melihat informasi lengkap setiap paket
- Owner juga bisa melakukan penyerahan darurat melalui fitur scan manual di halaman ini

---

### 4.3 Data Admin

URL: `/owner/admins`

Daftar semua akun admin beserta statistik masing-masing.

**Informasi per admin:**
- Nama, nomor HP, status aktif/nonaktif
- Jumlah paket yang diinput

---

### 4.4 Keuangan

URL: `/owner/finance`

Analisis keuangan bisnis secara visual dan tabular.

**Tab Ringkasan:**
- Total pendapatan (dari paket diserahkan)
- Breakdown per layanan (pie chart)
- Grafik pendapatan bulanan (bar chart)
- Filter: 3 bulan / 6 bulan / 12 bulan terakhir

**Tab Detail Transaksi:**
- Tabel semua paket yang diserahkan
- Filter rentang tanggal dan jenis layanan
- Export ke Excel

**Metrik yang dihitung:**
- Total ongkir dari semua paket `diserahkan`
- Pendapatan per layanan (pesawat, hemat+, kargo, pelni)
- Rata-rata ongkir per paket

---

### 4.5 Laporan

URL: `/owner/reports`

Laporan paket masuk dan keluar dalam periode tertentu.

**Tiga jenis laporan:**

| Jenis | Keterangan |
|-------|-----------|
| **Harian** | Pilih tanggal → tampil jam-per-jam |
| **Bulanan** | Pilih bulan → tampil hari-per-hari |
| **Tahunan** | Pilih tahun → tampil bulan-per-bulan |

**Kolom laporan:**
- Label (jam / tanggal / bulan)
- Paket Masuk (input)
- Paket Keluar (diserahkan)

**Export:**
- Export ke CSV / cetak laporan

---

### 4.6 Manajemen User

URL: `/owner/users`

Pengelolaan akun admin.

**Aksi yang tersedia:**

| Aksi | Keterangan |
|------|-----------|
| **Tambah Admin** | Buat akun admin baru (nama, nomor HP, password) |
| **Aktifkan / Nonaktifkan** | Toggle status aktif admin — admin nonaktif tidak bisa login |
| **Reset Password** | Ubah password admin tanpa perlu tahu password lama |

---

## 5. Rumus Perhitungan Ongkir

### 5.1 Berat Volume & Berat Pakai

Berat volume dihitung dari dimensi fisik paket. Setiap jenis layanan menggunakan **pembagi (divisor)** yang berbeda:

| Layanan | Rumus Berat Volume |
|---------|-------------------|
| Jastip Pesawat | `P × L × T ÷ 5.000` |
| Jastip Hemat+ | `P × L × T ÷ 4.000` |
| Jastip Pelni | `P × L × T ÷ 4.000` |
| Jastip Kargo | `P × L × T ÷ 1.000.000` (hasilnya dalam M³) |

> P = Panjang (cm), L = Lebar (cm), T = Tinggi (cm). Hasil dalam **kg** (kecuali kargo → M³).

**Berat Pakai** = `MAX(Berat Asli, Berat Volume)`

Sistem selalu memakai nilai yang **lebih besar** antara berat fisik dan berat volume sebagai dasar perhitungan ongkir.

---

### 5.2 Jastip Pesawat

Rute: **Jakarta → Manokwari**

Menggunakan **tarif bracket total** (bukan per kg × berat):

| Berat Pakai | Ongkir |
|-------------|--------|
| ≤ 0,2 kg | Rp 15.800 |
| ≤ 0,4 kg | Rp 30.800 |
| ≤ 0,5 kg | Rp 38.500 |
| ≤ 0,6 kg | Rp 46.200 |
| ≤ 0,7 kg | Rp 53.900 |
| ≤ 0,8 kg | Rp 61.600 |
| ≤ 0,9 kg | Rp 69.300 |
| ≤ 1 kg | Rp 77.000 |
| ≤ 2 kg | Rp 154.000 |
| ≤ 3 kg | Rp 231.000 |
| ≤ 5 kg | Rp 385.000 |
| ≤ 10 kg | Rp 770.000 |
| > 10 kg | Berat × Rp 77.000 |

**Tarif per kg acuan:** Rp 77.000/kg

---

### 5.3 Jastip Hemat+

Rute: **Surabaya → Manokwari**

```
Ongkir = MAX(Rp 10.000 ; Berat Pakai × Rp 10.000)
```

- Tarif: **Rp 10.000 per kg**
- Minimum ongkir: **Rp 10.000**

---

### 5.4 Jastip Kargo

Rute: **Jakarta/Surabaya → Manokwari**

Kargo menggunakan sistem **kubikasi** (volume/ton):

```
Kubikasi M³  = P × L × T ÷ 1.000.000
Berat Ton    = Berat Asli ÷ 1.000
Berat Pakai  = MAX(Kubikasi M³ ; Berat Ton)
Ongkir       = Berat Pakai × Tarif Kubikasi
```

**Dimensi P, L, T (Panjang, Lebar, Tinggi) WAJIB diisi untuk kargo.**

**Tarif Kubikasi:**
- Dikonfigurasi langsung dari form input paket
- Klik **"Simpan sebagai tarif default"** di field Harga Kubikasi → tarif tersimpan dan otomatis terisi di input berikutnya
- Tarif dapat berbeda per paket (bisa dioverride langsung di form)

**Minimum:** 10 M³/Ton (jika hasil berat pakai < 10, dibulatkan ke 10)

---

### 5.5 Jastip Pelni

Rute: **Jakarta → Manokwari** atau **Surabaya → Manokwari**

Menggunakan tarif per kg dengan **bracket progresif**:

**Jakarta → Manokwari:**

| Berat Pakai | Tarif/kg | Minimum |
|-------------|---------|---------|
| ≤ 10 kg | Rp 20.000 | Rp 20.000 |
| ≤ 20 kg | Rp 19.000 | — |
| ≤ 40 kg | Rp 18.000 | — |
| > 40 kg | Rp 17.000 | — |

```
Ongkir = MAX(Rp 20.000 ; Berat Pakai × Tarif/kg)
```

**Surabaya → Manokwari:**

| Berat Pakai | Tarif/kg | Minimum |
|-------------|---------|---------|
| ≤ 10 kg | Rp 18.000 | Rp 18.000 |
| ≤ 20 kg | Rp 17.000 | — |
| ≤ 40 kg | Rp 16.000 | — |
| > 40 kg | Rp 15.500 | — |

```
Ongkir = MAX(Rp 18.000 ; Berat Pakai × Tarif/kg)
```

> **Catatan bracket:** Tarif ditentukan berdasarkan **total berat**, bukan berlapis. Contoh: paket 15 kg → tarif Rp 19.000/kg → ongkir = 15 × 19.000 = Rp 285.000.

---

## 6. Status Paket

Sistem menggunakan dua status:

| Status | Label | Keterangan |
|--------|-------|-----------|
| `pending` | Pending | Paket sudah diinput, belum diserahkan ke customer |
| `diserahkan` | Diserahkan | Paket sudah diterima customer, pembayaran dicatat |

Perubahan status `pending → diserahkan` hanya terjadi melalui halaman **Scan Barcode & Pembayaran**.

---

## 7. Format Barcode

Setiap paket mendapat satu barcode unik saat pertama kali disimpan.

**Format:**
```
JAJ-<timestamp-base36>-<random-hex>
```

**Contoh:**
```
JAJ-lxk7a2b-4f9e
```

- `JAJ` — identitas bisnis (Jastip Anggun Jaya)
- `lxk7a2b` — timestamp saat paket dibuat, dikodekan dalam base-36 (huruf + angka, lebih pendek dari angka biasa)
- `4f9e` — 4 karakter hex acak untuk menghindari tabrakan jika ada paket dibuat di detik yang sama

Barcode ini ditampilkan dalam bentuk **QR Code** di label cetak dan bisa dibaca menggunakan kamera di halaman Scan.

---

## 8. Alur Penggunaan Lengkap

### Alur Normal (Admin)

```
1. LOGIN sebagai admin
        ↓
2. INPUT PAKET
   - Pilih: 1 Paket / Grup Paket / Import Excel
   - Isi data customer, barang, jenis jastip, berat/dimensi
   - Ongkir otomatis dihitung
   - Barcode JAJ dibuat otomatis
        ↓
3. CETAK LABEL BARCODE
   - Buka halaman Label Barcode
   - Cari paket atau langsung cetak dari notifikasi setelah input
   - Cetak label A4 → tempel ke paket fisik
        ↓
4. SAAT CUSTOMER AMBIL PAKET — SCAN & SERAHKAN
   - Buka halaman Scan Barcode
   - Scan QR code di paket (kamera / upload / manual)
   - Pilih jenis pembayaran: Tunai / Transfer / Piutang
   - Klik SERAHKAN → status paket jadi "Diserahkan"
        ↓
5. (Jika piutang) TANDAI LUNAS
   - Buka Riwayat Pembayaran
   - Cari pembayaran piutang → klik Tandai Lunas
```

### Alur Monitoring (Owner)

```
1. LOGIN sebagai owner
        ↓
2. DASHBOARD — cek ringkasan hari ini
        ↓
3. MONITOR PAKET — pantau semua paket real-time
        ↓
4. KEUANGAN — analisis pendapatan per periode/layanan
        ↓
5. LAPORAN — cetak/export laporan harian/bulanan/tahunan
        ↓
6. MANAJEMEN USER — tambah/nonaktifkan/reset password admin
```

### Alur Verifikasi Kedatangan Paket

```
1. Paket tiba dari kota asal (Jakarta/Surabaya)
        ↓
2. Admin buka VERIFIKASI PAKET
        ↓
3. Pilih nama customer dari daftar
        ↓
4. Scan barcode paket satu per satu
   - Cocok (✓) → paket valid, milik customer tersebut
   - Tidak Cocok (✗) → periksa ulang / cek database
        ↓
5. Export hasil verifikasi ke Excel untuk arsip
```

---

## Catatan Penting

- **Jastip Kargo:** dimensi P/L/T wajib diisi — ongkir tidak bisa dihitung tanpa dimensi
- **Tarif kargo default:** diatur langsung dari form input paket → field "Harga Kubikasi" → klik "Simpan sebagai tarif default"
- **Piutang:** paket tetap berstatus `diserahkan` meski belum lunas — pelunasan dicatat terpisah di Riwayat Pembayaran
- **Grup Paket:** semua paket dalam satu grup berbagi customer, layanan, dan tanggal — efisien untuk customer dengan banyak paket
- **Import Excel:** hanya baris valid yang diimport; baris error ditampilkan merah dan dilewati
