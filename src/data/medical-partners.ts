export interface DoctorItem {
  id: string;
  name: string;
  specialization: string;
  hospital: string;
  hospitalId: string;
  ratingPercentage: number;
  experienceYears: number;
  practiceHours: string;
  about: string;
  image: any;
}

export interface HospitalItem {
  id: string;
  name: string;
  distance: string;
  distanceKm: number;
  rating: number;
  address: string;
  openHours: string;
  description: string;
  coordinates: {
    lat: number;
    lon: number;
  };
  image: any;
  facilities: {
    icon: string;
    label: string;
  }[];
}

export const DOCTORS_DATA: DoctorItem[] = [
  {
    id: 'dr-apung',
    name: 'dr. Apung Setiawati',
    specialization: 'Kedokteran Umum',
    hospital: 'RSUP Dr. Kariadi',
    hospitalId: 'rsup-kariadi',
    ratingPercentage: 100,
    experienceYears: 10,
    practiceHours: '08.00–15.00',
    about:
      'Dokter umum berpengalaman dalam konsultasi preventif, penanganan alergi dan keluhan pernapasan akibat paparan polutan, serta evaluasi kesehatan keluarga.',
    image: require('@/assets/homepage/drbunga.png'),
  },
  {
    id: 'dr-ibanez',
    name: 'dr. Yahama Tisak',
    specialization: 'Kedokteran Umum',
    hospital: 'RSUP Dr. Kariadi',
    hospitalId: 'rsup-kariadi',
    ratingPercentage: 100,
    experienceYears: 8,
    practiceHours: '09.00–16.00',
    about:
      'Dokter umum berdedikasi dalam konsultasi kesehatan preventif, penanganan awal keluhan infeksi saluran napas, dan edukasi gaya hidup sehat.',
    image: require('@/assets/dr/dr ibanez.png'),
  },
  {
    id: 'dr-daffa',
    name: 'dr. Agung Sp. P',
    specialization: 'Spesialis Paru',
    hospital: 'RSUP Dr. Kariadi',
    hospitalId: 'rsup-kariadi',
    ratingPercentage: 100,
    experienceYears: 12,
    practiceHours: '10.00–17.00',
    about:
      'Spesialis pulmonologi dengan keahlian penanganan asma kronis, bronkitis akut, dan evaluasi kapasitas fungsi paru akibat kualitas udara buruk.',
    image: require('@/assets/dr/dr daffa 2.png'),
  },
  {
    id: 'dr-erland',
    name: 'dr. Agung Sp.KO',
    specialization: 'Kedokteran Olahraga',
    hospital: 'RSUP Dr. Kariadi',
    hospitalId: 'rsup-kariadi',
    ratingPercentage: 100,
    experienceYears: 7,
    practiceHours: '08.30–14.30',
    about:
      'Spesialis kedokteran olahraga yang berfokus pada panduan aktivitas fisik aman di luar ruangan saat indeks polusi tinggi serta rehabilitasi pernapasan.',
    image: require('@/assets/dr/dr erland 2.png'),
  },
];

export const HOSPITALS_DATA: HospitalItem[] = [
  {
    id: 'rsup-kariadi',
    name: 'RSUP. Dr Kariadi',
    distance: '1,2 km – Terdekat',
    distanceKm: 1.2,
    rating: 5.0,
    address: 'Jl. DR. Sutomo No.16, Randusari, Semarang',
    openHours: 'Buka 24 Jam',
    description:
      'Rumah sakit rujukan nasional utama tipe A di Jawa Tengah dengan pusat rujukan pulmonologi terlengkap, fasilitas laboratorium canggih, dan unit gawat darurat siaga 24 jam.',
    coordinates: {
      lat: -6.9936,
      lon: 110.4078,
    },
    image: require('@/assets/dr/hospital_kariadi.jpg'),
    facilities: [
      { icon: 'medical-outline', label: 'IGD 24 Jam' },
      { icon: 'fitness-outline', label: 'Rawat Jalan' },
      { icon: 'bed-outline', label: 'Rawat Inap' },
      { icon: 'heart-circle-outline', label: 'Klinik Paru' },
      { icon: 'flask-outline', label: 'Laboratorium' },
    ],
  },
  {
    id: 'rsud-wongsonegoro',
    name: 'RSUD Wongsonegoro',
    distance: '3,8 km',
    distanceKm: 3.8,
    rating: 5.0,
    address: 'Jl. Fatmawati No.1, Mangunharjo, Tembalang, Semarang',
    openHours: 'Buka 24 Jam',
    description:
      'Rumah sakit umum daerah tipe B rujukan modern dengan gedung paviliun baru, instalasi gawat darurat lengkap, dan poliklinik spesialis paru komprehensif.',
    coordinates: {
      lat: -7.0392,
      lon: 110.4682,
    },
    image: require('@/assets/dr/hospital_wongsonegoro.jpg'),
    facilities: [
      { icon: 'medical-outline', label: 'IGD 24 Jam' },
      { icon: 'fitness-outline', label: 'Rawat Jalan' },
      { icon: 'bed-outline', label: 'Rawat Inap' },
      { icon: 'flask-outline', label: 'Farmasi 24 Jam' },
    ],
  },
  {
    id: 'rs-telogorejo',
    name: 'SMC RS Telogorejo',
    distance: '2,5 km',
    distanceKm: 2.5,
    rating: 4.9,
    address: 'Jl. KH. Ahmad Dahlan, Pekunden, Semarang Tengah',
    openHours: 'Buka 24 Jam',
    description:
      'Pusat layanan kesehatan modern di pusat kota Semarang yang menyediakan dokter spesialis lengkap, ruang rawat inap eksklusif, serta farmasi 24 jam.',
    coordinates: {
      lat: -6.9882,
      lon: 110.4237,
    },
    image: require('@/assets/dr/hospital_kariadi.jpg'),
    facilities: [
      { icon: 'medical-outline', label: 'IGD 24 Jam' },
      { icon: 'fitness-outline', label: 'Rawat Jalan' },
      { icon: 'bed-outline', label: 'Rawat Inap' },
      { icon: 'flask-outline', label: 'Farmasi 24 Jam' },
    ],
  },
  {
    id: 'rs-columbia-asia',
    name: 'RS Columbia Asia',
    distance: '4,1 km',
    distanceKm: 4.1,
    rating: 4.8,
    address: 'Jl. Siliwangi No.143, Kalibanteng Kulon, Semarang',
    openHours: 'Buka 24 Jam',
    description:
      'Rumah sakit swasta berstandar internasional dengan keunggulan respons cepat UGD, diagnostik radiologi terpadu, dan perawatan ramah keluarga.',
    coordinates: {
      lat: -6.9868,
      lon: 110.3842,
    },
    image: require('@/assets/dr/hospital_kariadi.jpg'),
    facilities: [
      { icon: 'medical-outline', label: 'IGD 24 Jam' },
      { icon: 'fitness-outline', label: 'Rawat Jalan' },
      { icon: 'bed-outline', label: 'Rawat Inap' },
      { icon: 'shield-checkmark-outline', label: 'Ambulans Cepat' },
    ],
  },
  {
    id: 'rs-elisabeth',
    name: 'RS St. Elisabeth',
    distance: '3,3 km',
    distanceKm: 3.3,
    rating: 4.9,
    address: 'Jl. Kawi No.1, Tegalsari, Candisari, Semarang',
    openHours: 'Buka 24 Jam',
    description:
      'Rumah sakit bersejarah di kawasan perbukitan sejuk Candi Semarang, dikenal dengan pelayanan penuh dedikasi dan poliklinik pernapasan terpercaya.',
    coordinates: {
      lat: -7.0094,
      lon: 110.4222,
    },
    image: require('@/assets/dr/hospital_kariadi.jpg'),
    facilities: [
      { icon: 'medical-outline', label: 'IGD 24 Jam' },
      { icon: 'fitness-outline', label: 'Rawat Jalan' },
      { icon: 'bed-outline', label: 'Rawat Inap' },
      { icon: 'leaf-outline', label: 'Kawasan Asri' },
    ],
  },
];
