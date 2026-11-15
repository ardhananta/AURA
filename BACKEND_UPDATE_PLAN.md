# 🛠️ Backend Update & Implementation Plan: Navigation & Tracking System

Dokumen ini merupakan panduan teknis bagi tim pengembang backend untuk memperbarui dan menyelesaikan integrasi endpoint **Universal Navigation** dan **Movement Tracking** pada API AURA (`https://aurabackend-eight.vercel.app/api/v1`).

---

## 📌 Ringkasan Status Integrasi Frontend

| Endpoint | Method | Status Frontend | Catatan Pengujian Live |
|---|---|---|---|
| `/api/v1/navigation/calculate-route` | `POST` | Terhubung ✅ (dengan OSRM Fallback) | Mengembalikan `success: true` namun `coordinates: null`, `distance: 0`, dan step `0,0`. Frontend saat ini beralih ke OSRM agar tidak crash. |
| `/api/v1/tracking/start-session` | `POST` | Terhubung ✅ | Menolak request tanpa token (`UNAUTHORIZED`). Memerlukan sesi user aktif. |
| `/api/v1/tracking/sync-waypoints` | `POST` | Terhubung ✅ | Mendukung smart incremental sync (mengirim titik baru per batch). |
| `/api/v1/tracking/stop-session` | `POST` | Terhubung ✅ | Mengirim titik akhir, mengharapkan kalkulasi agregasi & analisis AI. |
| `/api/v1/tracking/daily-history` | `GET` | Terhubung ✅ | Menerima parameter `user_id` dan `date` (YYYY-MM-DD). |

---

## 🚀 Rencana Pembaruan Backend (Task Breakdown)

### 1. Perbaikan Endpoint Rute (`POST /api/v1/navigation/calculate-route`)

#### Masalah Saat Ini
Hasil tes live:
```json
{
  "success": true,
  "data": {
    "coordinates": null,
    "distance_meters": 0,
    "duration_seconds": 0,
    "health_warnings": null,
    "map_markers": null,
    "polyline": "",
    "route_id": "route_-6_99_110_42_-7_00_110_41_-6993200",
    "steps": [
      {
        "distance_meters": 100,
        "duration_seconds": 20,
        "end_location": { "latitude": 0.001, "longitude": 0.001 },
        "instruction": "Mulai dari lokasi Anda",
        "maneuver": "straight",
        "start_location": { "latitude": 0, "longitude": 0 }
      }
    ],
    "traffic_segments": null
  }
}
```

#### Tindakan Perbaikan
1. **Integrasi Routing Engine Riil**:
   - Gunakan OSRM API internal/publik (`router.project-osrm.org`) atau TomTom Routing API di backend.
   - Ekstrak koordinat rute riil dalam format GeoJSON: `coordinates: [[longitude, latitude], ...]`.
2. **Kalkulasi Metrik Navigasi**:
   - `distance_meters`: Total jarak rute riil dalam satuan meter.
   - `duration_seconds`: Estimasi waktu tempuh dalam detik.
   - `steps`: Array turn-by-turn instructions berisi:
     - `instruction`: Nama jalan dan arah (e.g. *"Belok kanan ke Jl. Pemuda"*).
     - `maneuver`: `"turn-left" | "turn-right" | "straight" | "uturn" | "roundabout" | "arrive"`.
     - `start_location` & `end_location`: Koordinat lintang dan bujur.
3. **Peringatan Polusi & Bahaya (Health Warnings)**:
   - Gunakan PostGIS spatial query (`ST_DWithin` dalam radius 150m dari polyline rute) terhadap tabel `zones` Semarang.
   - Jika rute melewati zona dengan AQI > 100, sertakan objek pada array `health_warnings`:
     ```json
     {
       "warning_id": "hw_kaligawe_01",
       "type": "high_pollution",
       "severity": "high",
       "title": "Zona Polusi Tinggi - Kaligawe",
       "message": "AQI 156 (Tidak Sehat). Potensi paparan partikel PM2.5 tinggi.",
       "location": { "latitude": -6.9587, "longitude": 110.4578 },
       "aqi": 156,
       "pm2_5": 145,
       "health_risks": ["Iritasi saluran pernapasan", "Pemicu asma"],
       "recommendations": ["Gunakan masker N95", "Tutup jendela kendaraan"],
       "icon": "cloud",
       "color": "#9333EA"
     }
     ```
4. **Caching**:
   - Cache hasil rute di Redis dengan key `origin_dest_hash` selama 5 menit untuk efisiensi komputasi.

---

### 2. Implementasi Tracking: Start Session (`POST /api/v1/tracking/start-session`)

#### Spesifikasi Request
Header: `Authorization: Bearer <jwt_token>`
```json
{
  "user_id": "user_uuid_123",
  "session_name": "Perjalanan Pulang Kantor",
  "start_location": {
    "latitude": -6.9932,
    "longitude": 110.4203,
    "timestamp": "2026-11-15T08:00:00Z"
  }
}
```

#### Tindakan Backend
1. Validasi token JWT dari header `Authorization`. Pastikan `user_id` sesuai dengan identitas pengguna dalam klaim token.
2. Generate UUID unik `session_id` (misal: `sess_usr123_1705310400`).
3. Simpan baris baru ke tabel `tracking_sessions`:
   - `session_id`, `user_id`, `session_name`, `started_at = now()`, `status = 'active'`.
4. Simpan titik awal ke tabel `waypoints`.
5. Return respons status `201 Created`:
   ```json
   {
     "success": true,
     "data": {
       "session_id": "sess_usr123_1705310400",
       "started_at": "2026-11-15T08:00:00Z",
       "status": "active"
     }
   }
   ```

---

### 3. Implementasi Smart Waypoints Sync (`POST /api/v1/tracking/sync-waypoints`)

#### Spesifikasi Request
Header: `Authorization: Bearer <jwt_token>`
```json
{
  "session_id": "sess_usr123_1705310400",
  "user_id": "user_uuid_123",
  "waypoints": [
    {
      "latitude": -6.9935,
      "longitude": 110.4208,
      "timestamp": "2026-11-15T08:02:00Z",
      "accuracy_meters": 8.5,
      "speed_mps": 4.2,
      "heading": 135
    }
  ],
  "is_final": false
}
```

#### Tindakan Backend
1. Validasi `session_id` milik `user_id` dan berstatus `'active'`.
2. Batch insert ke tabel `waypoints`:
   - Buat geometry point: `ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)`.
   - Lakukan spatial lookup terhadap tabel `zones` untuk mencocokkan `zone_id` dan mendeteksi apakah lokasi berada di area indoor atau outdoor.
   - Ambil nilai `aqi` dan `pm2_5` terkini dari `zone_aqi_readings`.
3. Return respons:
   ```json
   {
     "success": true,
     "data": {
       "synced_count": 10,
       "session_id": "sess_usr123_1705310400",
       "total_waypoints": 45,
       "last_sync_at": "2026-11-15T08:15:30Z"
     }
   }
   ```

---

### 4. Implementasi Stop Session & Health AI Analysis (`POST /api/v1/tracking/stop-session`)

#### Spesifikasi Request
Header: `Authorization: Bearer <jwt_token>`
```json
{
  "session_id": "sess_usr123_1705310400",
  "user_id": "user_uuid_123",
  "end_location": {
    "latitude": -7.0015,
    "longitude": 110.4128,
    "timestamp": "2026-11-15T08:45:00Z"
  }
}
```

#### Tindakan Backend
1. Update status sesi: `status = 'completed'`, `ended_at = now()`.
2. Hitung statistik kumulatif dari seluruh waypoints sesi ini:
   - `total_outdoor_minutes`: Durasi pergerakan di luar ruangan.
   - `total_indoor_minutes`: Durasi saat terdeteksi diam/indoor.
   - `average_outdoor_aqi`: Rata-rata AQI selama outdoor.
   - `average_outdoor_pm25`: Rata-rata konsentrasi PM2.5.
   - `max_aqi`: Nilai AQI puncak yang dilewati.
   - `worst_area_name`: Nama area/zona dengan polusi terburuk.
   - `distance_km`: Total jarak tempuh (via `ST_Length(ST_MakeLine(geom)::geography) / 1000`).
3. **Analisis AI (LLM via Groq / Llama-3)**:
   - Kirim prompt ringkas dengan statistik perjalanan ke Groq API:
     - Input: Durasi outdoor, AQI rata-rata, zona terburuk, profil sensitivitas pengguna.
     - Output JSON terstruktur:
       - `impact_score` (0-100)
       - `risk_level` ("Rendah" | "Sedang" | "Tinggi" | "Berbahaya")
       - `summary`: Penjelasan dampak kesehatan dalam Bahasa Indonesia.
       - `recommendations`: 3-4 tips perawatan pasca perjalanan (misal: cuci muka, minum air, pelembab).
4. Return respons lengkap:
   ```json
   {
     "success": true,
     "data": {
       "session_id": "sess_usr123_1705310400",
       "started_at": "2026-11-15T08:00:00Z",
       "ended_at": "2026-11-15T08:45:00Z",
       "duration_minutes": 45,
       "distance_km": 6.8,
       "stats": {
         "total_outdoor_minutes": 40,
         "total_indoor_minutes": 5,
         "average_outdoor_aqi": 128,
         "average_outdoor_pm25": 82,
         "max_aqi": 156,
         "worst_area_name": "Jl. Pemuda - Simpang Lima",
         "worst_area_aqi": 156,
         "waypoints_processed": 45
       },
       "analysis": {
         "impact_score": 68,
         "risk_level": "Sedang",
         "summary": "Anda terpapar polusi sedang selama 40 menit di koridor Jl. Pemuda.",
         "recommendations": [
           "Bersihkan wajah dengan air mengalir dan pembersih lembut",
           "Minum air putih minimal 300ml untuk hidrasi",
           "Gunakan pelembab jika kulit terasa kering"
         ]
       }
     }
   }
   ```

---

### 5. Implementasi Daily History (`GET /api/v1/tracking/daily-history`)

#### Spesifikasi Request
Header: `Authorization: Bearer <jwt_token>`  
Query Parameters: `?user_id=user_uuid_123&date=YYYY-MM-DD`

#### Tindakan Backend
1. Ambil seluruh sesi milik `user_id` pada tanggal `date` dari `tracking_sessions`.
2. Ambil seluruh waypoints dari sesi-sesi tersebut, diurutkan berdasarkan `timestamp ASC`.
3. Hitung agregasi harian (`daily_stats`).
4. Return respons:
   ```json
   {
     "success": true,
     "data": {
       "date": "2026-11-15",
       "sessions": [ ... ],
       "combined_waypoints": [
         {
           "latitude": -6.9932,
           "longitude": 110.4203,
           "timestamp": "2026-11-15T08:00:00Z",
           "classification": "outdoor",
           "aqi": 110,
           "pm2_5": 75,
           "zone_name": "Simpang Lima",
           "speed_mps": 4.5
         }
       ],
       "daily_stats": {
         "total_outdoor_minutes": 85,
         "total_indoor_minutes": 20,
         "average_outdoor_aqi": 122,
         "average_outdoor_pm25": 78,
         "max_aqi": 156,
         "worst_area_name": "Simpang Lima",
         "worst_area_aqi": 156,
         "waypoints_processed": 120
       }
     }
   }
   ```

---

## 🗄️ Database Schema Migration (PostgreSQL + PostGIS)

```sql
-- 1. Tabel Sesi Tracking
CREATE TABLE IF NOT EXISTS tracking_sessions (
    session_id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    session_name VARCHAR(128),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'completed', 'cancelled'
    distance_km NUMERIC(8, 2) DEFAULT 0,
    duration_minutes INTEGER DEFAULT 0,
    total_outdoor_minutes INTEGER DEFAULT 0,
    total_indoor_minutes INTEGER DEFAULT 0,
    average_outdoor_aqi INTEGER DEFAULT 0,
    max_aqi INTEGER DEFAULT 0,
    worst_area_name VARCHAR(128),
    impact_score INTEGER,
    risk_level VARCHAR(32),
    ai_summary TEXT,
    ai_recommendations JSONB
);

CREATE INDEX IF NOT EXISTS idx_tracking_sessions_user_date 
ON tracking_sessions(user_id, started_at);

-- 2. Tabel Waypoints
CREATE TABLE IF NOT EXISTS waypoints (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL REFERENCES tracking_sessions(session_id) ON DELETE CASCADE,
    location GEOMETRY(Point, 4326) NOT NULL,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    accuracy_meters NUMERIC(6, 2),
    speed_mps NUMERIC(6, 2),
    heading NUMERIC(5, 2),
    classification VARCHAR(20) DEFAULT 'outdoor', -- 'outdoor', 'indoor'
    zone_id VARCHAR(64),
    zone_name VARCHAR(128),
    aqi INTEGER,
    pm2_5 NUMERIC(6, 2)
);

CREATE INDEX IF NOT EXISTS idx_waypoints_session_time 
ON waypoints(session_id, recorded_at);

CREATE INDEX IF NOT EXISTS idx_waypoints_geom 
ON waypoints USING GIST(location);
```

---

## 🔒 Catatan Keamanan & Autentikasi
1. **JWT Verification**: Token autentikasi dikirim pada header `Authorization: Bearer <token>`. Middleware backend wajib memverifikasi signature dan masa berlaku token.
2. **User Ownership**: Pastikan sesi atau histori yang diakses sesuai dengan `uid` dari klaim token pengguna (mencegah IDOR).
3. **Data Privacy**: Koordinat GPS pengguna disimpan secara aman dan diakses hanya oleh pemilik akun.

---

Dokumen ini siap dijadikan acuan langsung untuk pengerjaan backend. Frontend AURA saat ini telah siap 100% menerima format respons di atas.
