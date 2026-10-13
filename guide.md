# 📘 Panduan Lengkap Integrasi Aura Frontend & Backend (guide.md)

Dokumen ini merangkum seluruh implementasi arsitektur frontend mobile **Aura**, integrasi penuh dengan backend (**Go + Vercel** di `https://aurabackend-eight.vercel.app`), pengelolaan token aman, penanganan error, serta panduan pengujian.

---

## 🌐 1. Konfigurasi Backend & Kontrak API

- **Base URL API**: `https://aurabackend-eight.vercel.app` (dikonfigurasi via `EXPO_PUBLIC_API_URL` di [`.env`](file:///Users/daffa/AURA/.env)).
- **Format Respon Seragam**:
  - **Berhasil (Success)**: `{ "success": true, "data": { ... } }`
  - **Gagal (Error)**: `{ "success": false, "error": { "code": "ERROR_CODE", "message": "Pesan error" } }`

---

## 🔐 2. Penyimpanan Token Aman (Token Storage)

Dibuat di [`src/services/storage.ts`](file:///Users/daffa/AURA/src/services/storage.ts) dengan pendekatan lintas platform:
- **Mobile (iOS & Android)**: Menggunakan [`expo-secure-store`](https://docs.expo.dev/versions/latest/sdk/securestore/) untuk enkripsi Keychain (iOS) & Keystore (Android).
- **Web**: Menggunakan `localStorage` dengan in-memory fallback.

Menyimpan 2 buah token:
1. `idToken` (JWT): Masa aktif 1 jam, disematkan otomatis pada header `Authorization: Bearer <idToken>`.
2. `refreshToken`: Masa aktif panjang, digunakan untuk meminta `idToken` baru saat kadaluarsa.

---

## ⚡ 3. HTTP Client & Auto-Refresh Interceptor (Axios)

Dibuat di [`src/services/api.ts`](file:///Users/daffa/AURA/src/services/api.ts):

1. **Request Interceptor**:
   - Membaca `idToken` dari `TokenStorage`.
   - Otomatis menyisipkan header: `Authorization: Bearer <idToken>`.

2. **Response Interceptor (Silent Auto-Refresh)**:
   - Jika menerima status **`401 Unauthorized`**:
     1. Menandai request dengan `_retry = true`.
     2. Mengambil `refreshToken` dari storage.
     3. Mengirim `POST /api/auth/refresh` ke backend.
     4. Menyimpan `idToken` baru.
     5. Mengulangi request awal secara otomatis tanpa mengganggu pengalaman pengguna.
   - Jika refresh token expired atau di-revoke:
     1. Menghapus token dari storage.
     2. Men-trigger callback `onSessionExpired` untuk mengarahkan pengguna kembali ke halaman Login.

---

## 🗺️ 4. Penanganan Error (Error Mapping)

Dibuat di [`src/utils/error-mapper.ts`](file:///Users/daffa/AURA/src/utils/error-mapper.ts) untuk menerjemahkan `error.code` dari backend menjadi pesan yang ramah pengguna:

| Error Code | Status | Pesan yang Ditampilkan ke User |
| :--- | :---: | :--- |
| `EMAIL_EXISTS` | 409 | "Email sudah terdaftar, silakan gunakan email lain atau login." |
| `INVALID_CREDENTIALS` | 401 | "Email atau password salah." |
| `VALIDATION_ERROR` | 422 | Menampilkan pesan spesifik dari backend (misal: "Password minimal 8 karakter"). |
| `USER_DISABLED` | 403 | "Akun ini telah dinonaktifkan. Hubungi admin." |
| `TOO_MANY_ATTEMPTS` | 429 | "Terlalu banyak percobaan gagal. Silakan tunggu beberapa saat lagi." |
| `TOKEN_REVOKED` | 401 | "Sesi telah berakhir karena logout dari perangkat lain." |
| Network Error | - | "Tidak dapat terhubung ke server. Periksa koneksi internet Anda." |

---

## 📱 5. State Management & Auth Context

Dibuat di [`src/context/auth-context.tsx`](file:///Users/daffa/AURA/src/context/auth-context.tsx) dan dipasang di root layout [`src/app/_layout.tsx`](file:///Users/daffa/AURA/src/app/_layout.tsx):

- **State yang disediakan**:
  - `user`: Profil user aktif (`uid`, `name`, `email`, `lastLoginAt`).
  - `isLoading`: Status inisialisasi/pengecekan token saat aplikasi dibuka.
  - `isAuthenticated`: `true` jika user sedang login dan memiliki profil valid.
- **Fungsi yang disediakan**:
  - `login(email, password)`: Memanggil `POST /api/auth/login`, menyimpan token, mengupdate user.
  - `register(name, email, password)`: Memanggil `POST /api/auth/register`, langsung auto-login, menyimpan token.
  - `logout()`: Memanggil `POST /api/auth/logout`, menghapus token lokal, meredirect ke Login.
  - `checkAuth()`: Memverifikasi sesi dengan memanggil `GET /api/auth/me`.

---

## 🖥️ 6. Layar yang Terhubung dengan Backend

1. **Layar Masuk (Login)** - [`src/app/index.tsx`](file:///Users/daffa/AURA/src/app/index.tsx)
   - Validasi frontend (email valid, password minimal 8 karakter).
   - Memanggil `useAuth().login()`.
   - Menampilkan banner error interaktif jika terjadi kesalahan (misal: `INVALID_CREDENTIALS`).
   - Berhasil login → redirect otomatis ke [`/dashboard`](file:///Users/daffa/AURA/src/app/dashboard.tsx).

2. **Layar Buat Akun (Register)** - [`src/app/register.tsx`](file:///Users/daffa/AURA/src/app/register.tsx)
   - Validasi frontend (nama wajib & <= 100 char, email valid, password minimal 8 char & <= 128 char, konfirmasi password cocok).
   - Memanggil `useAuth().register()`.
   - Menangani error `EMAIL_EXISTS` jika email sudah terpakai.
   - Berhasil register → auto-login & langsung diarahkan ke [`/dashboard`](file:///Users/daffa/AURA/src/app/dashboard.tsx).

3. **Layar Lupa Password** - [`src/app/forgot-password.tsx`](file:///Users/daffa/AURA/src/app/forgot-password.tsx)
   - Validasi email dan pengiriman instruksi pemulihan.

4. **Layar Dashboard (Halaman Terproteksi)** - [`src/app/dashboard.tsx`](file:///Users/daffa/AURA/src/app/dashboard.tsx)
   - Menampilkan data profil live dari backend (`name`, `email`, `uid`, `lastLoginAt`).
   - Badge status otentikasi JWT aktif.
   - Tombol pengujian live `GET /api/auth/me` untuk menguji Bearer token.
   - Tombol **Logout** dengan konfirmasi dialog, memanggil `POST /api/auth/logout` dan menghapus token.

---

## 🧪 7. Cara Menguji Aplikasi

```bash
# Jalankan Expo Dev Server
bunx expo start

# Jalankan Typecheck TypeScript
bunx tsc --noEmit
```

1. Buka aplikasi di Expo Go atau browser web.
2. Coba daftarkan akun baru di **Buat Akun** dengan password >= 8 karakter.
3. Setelah berhasil, aplikasi akan langsung login dan membuka **Dashboard**.
4. Di Dashboard, tekan tombol *"Panggil GET /api/auth/me"* untuk menguji respon Bearer token.
5. Tekan *"Keluar dari Akun (Logout)"* untuk menguji logout dan pembersihan token.
