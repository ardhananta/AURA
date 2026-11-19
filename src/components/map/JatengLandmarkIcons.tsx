import React from 'react';
import Svg, { Path, Circle, Rect, Polygon, Ellipse } from 'react-native-svg';

export interface LandmarkIconProps {
  size?: number;
  color?: string;
  secondaryColor?: string;
}

/**
 * 1. Kota Semarang - Tugu Muda
 * Ikon vektor tugu obelisk khas Kota Semarang dengan api abadi di pucuk tugu.
 */
export function TuguMudaSemarangIcon({ size = 24, color = '#1E293B', secondaryColor = '#EF4444' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Dasar / Pondasi Bertingkat Tugu Muda */}
      <Rect x="4" y="27" width="24" height="3" rx="1" fill={color} />
      <Rect x="7" y="24" width="18" height="3" rx="0.5" fill={color} />
      <Rect x="9" y="21" width="14" height="3" rx="0.5" fill={color} />
      {/* Pilar Obelisk 5 Sisi */}
      <Path d="M12 21 L13.5 8 L18.5 8 L20 21 Z" fill={color} opacity={0.9} />
      <Path d="M15 21 L15.5 8 L16.5 8 L17 21 Z" fill="#FFFFFF" opacity={0.3} />
      {/* Puncak Obelisk Piramida */}
      <Path d="M13.5 8 L16 3 L18.5 8 Z" fill={color} />
      {/* Lidah Api Perjuangan di Puncak Tugu */}
      <Path
        d="M16 1 C15 3 14 4 14.5 5.5 C15 7 16 7 16 7 C16 7 17 7 17.5 5.5 C18 4 17 3 16 1 Z"
        fill={secondaryColor}
      />
      <Circle cx="16" cy="4.5" r="1" fill="#FDE047" />
    </Svg>
  );
}

/**
 * 2. Kota Surakarta / Solo - Keraton Solo (Gapura Kori Kamandungan)
 */
export function KeratonSoloIcon({ size = 24, color = '#1E293B' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Atap Joglo Tumpuk Keraton */}
      <Path d="M16 4 L26 12 L24 14 L21 13 L21 27 L11 27 L11 13 L8 14 L6 12 Z" fill={color} />
      {/* Mahkota Gapura */}
      <Path d="M16 1 L17.5 4 L14.5 4 Z" fill="#FACC15" />
      {/* Gerbang Lengkung Kori */}
      <Path d="M13 27 L13 18 C13 16.3 14.3 15 16 15 C17.7 15 19 16.3 19 18 L19 27 Z" fill="#FFFFFF" />
      <Circle cx="16" cy="11" r="1.5" fill="#FACC15" />
    </Svg>
  );
}

/**
 * 3. Magelang - Candi Borobudur (Stupa Utama)
 */
export function BorobudurStupaIcon({ size = 24, color = '#1E293B' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Puncak Spire Chattra */}
      <Rect x="15" y="2" width="2" height="6" fill={color} />
      <Circle cx="16" cy="2" r="1.5" fill="#FACC15" />
      {/* Kubah Stupa Induk */}
      <Path d="M16 7 C11.5 7 9 11 9 16 L23 16 C23 11 20.5 7 16 7 Z" fill={color} />
      {/* Teras Bertingkat Lingkaran Arupadhatu */}
      <Rect x="6" y="16" width="20" height="3" rx="0.5" fill={color} opacity={0.9} />
      <Rect x="4" y="19" width="24" height="3" rx="0.5" fill={color} opacity={0.8} />
      <Rect x="2" y="22" width="28" height="4" rx="1" fill={color} />
      {/* Lubang Belah Ketupat Relikui */}
      <Circle cx="13" cy="12" r="1" fill="#FFFFFF" />
      <Circle cx="16" cy="12" r="1" fill="#FFFFFF" />
      <Circle cx="19" cy="12" r="1" fill="#FFFFFF" />
    </Svg>
  );
}

/**
 * 4. Kudus - Menara Kudus
 */
export function MenaraKudusIcon({ size = 24, color = '#1E293B' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Atap Tumpang Menara */}
      <Path d="M16 2 L22 7 L10 7 Z" fill="#DC2626" />
      <Path d="M16 6 L24 12 L8 12 Z" fill="#DC2626" />
      {/* Menara Bata Merah Bertingkat */}
      <Rect x="10" y="12" width="12" height="5" fill={color} />
      <Rect x="9" y="17" width="14" height="5" fill={color} opacity={0.9} />
      <Rect x="8" y="22" width="16" height="6" fill={color} />
      <Rect x="6" y="27" width="20" height="3" rx="0.5" fill={color} />
      {/* Pintu Relung Khas Menara */}
      <Path d="M14 28 L14 23 C14 22 15 21 16 21 C17 21 18 22 18 23 L18 28 Z" fill="#FFFFFF" />
    </Svg>
  );
}

/**
 * 5. Demak - Masjid Agung Demak
 */
export function MasjidDemakIcon({ size = 24, color = '#1E293B' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Atap Tumpang Tiga Masjid Demak */}
      <Path d="M16 3 L21 8 L11 8 Z" fill="#15803D" />
      <Path d="M16 7 L24 13 L8 13 Z" fill="#15803D" />
      <Path d="M16 12 L27 19 L5 19 Z" fill="#15803D" />
      {/* Badan Bangunan & Tiang Saka Guru */}
      <Rect x="7" y="19" width="18" height="8" fill={color} />
      <Rect x="5" y="27" width="22" height="3" rx="1" fill={color} />
      {/* Pintu Masuk */}
      <Path d="M13 27 L13 22 C13 21 14 20 16 20 C18 20 19 21 19 22 L19 27 Z" fill="#FFFFFF" />
    </Svg>
  );
}

/**
 * 6. Pekalongan - Canting & Kain Batik
 */
export function BatikPekalonganIcon({ size = 24, color = '#1E293B' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Gagang & Badan Canting Tembaga */}
      <Path d="M7 25 L17 15 C19 13 22 13 24 15 C26 17 26 20 24 22 C22 24 19 24 17 22 Z" fill="#D97706" />
      {/* Cucuk Canting / Moncong Lilin */}
      <Path d="M25 15 L29 11 L28 10 L24 13 Z" fill="#B45309" />
      {/* Tetesan Lilin Malam Membentuk Motif Batik */}
      <Circle cx="29" cy="8" r="1.5" fill="#F59E0B" />
      <Path d="M5 27 L10 22 L7 19 L2 24 Z" fill={color} />
      <Circle cx="20" cy="18" r="2" fill="#FFFFFF" />
    </Svg>
  );
}

/**
 * 7. Brebes - Bawang Merah & Telur Asin
 */
export function BawangBrebesIcon({ size = 24, color = '#E11D48' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Umbi Bawang Merah Brebes */}
      <Path
        d="M16 4 C16 4 10 11 10 18 C10 24 13 28 16 28 C19 28 22 24 22 18 C22 11 16 4 16 4 Z"
        fill={color}
      />
      {/* Garis Serat Kulit Bawang */}
      <Path d="M16 4 C13 11 13 24 16 28" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
      {/* Batang Daun Hijau di Atas */}
      <Path d="M16 4 L14 1" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" />
      <Path d="M16 4 L18 1.5" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round" />
      {/* Ikon Telur Asin Pendamping */}
      <Circle cx="24" cy="22" r="5" fill="#38BDF8" opacity={0.8} />
      <Circle cx="24" cy="22" r="2.5" fill="#EA580C" />
    </Svg>
  );
}

/**
 * 8. Cilacap - Kilang Minyak & Mercusuar
 */
export function KilangCilacapIcon({ size = 24, color = '#1E293B' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Menara Distilasi / Kilang */}
      <Rect x="7" y="10" width="8" height="17" rx="1" fill={color} />
      {/* Cerobong Api Flare */}
      <Rect x="19" y="8" width="3" height="19" fill={color} />
      <Path d="M20.5 2 C19.5 4 19 5.5 19.5 6.5 C20 7.5 21 7.5 21 7.5 C21 7.5 22 7.5 22.5 6.5 C23 5.5 21.5 4 20.5 2 Z" fill="#EF4444" />
      {/* Tangki Bola Gas Sphere */}
      <Circle cx="11" cy="6" r="3" fill="#3B82F6" />
      <Rect x="4" y="27" width="24" height="3" rx="1" fill={color} />
    </Svg>
  );
}

/**
 * 9. Boyolali - Sapi Perah
 */
export function SapiBoyolaliIcon({ size = 24, color = '#1E293B' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Kepala Sapi */}
      <Path d="M11 12 C11 9 13 7 16 7 C19 7 21 9 21 12 L21 21 C21 24 19 26 16 26 C13 26 11 24 11 21 Z" fill={color} />
      {/* Moncong Putih */}
      <Rect x="13" y="19" width="6" height="5" rx="2" fill="#FFFFFF" />
      <Circle cx="14.5" cy="21.5" r="0.8" fill={color} />
      <Circle cx="17.5" cy="21.5" r="0.8" fill={color} />
      {/* Tanduk Kiri & Kanan */}
      <Path d="M11 9 C9 8 7 5 6 3 C8 5 10 7 11 9 Z" fill="#F59E0B" />
      <Path d="M21 9 C23 8 25 5 26 3 C24 5 22 7 21 9 Z" fill="#F59E0B" />
      {/* Telinga Sapi */}
      <Path d="M11 13 L6 14 L8 17 Z" fill="#E2E8F0" />
      <Path d="M21 13 L26 14 L24 17 Z" fill="#E2E8F0" />
      {/* Mata */}
      <Circle cx="13.5" cy="13" r="1.2" fill="#FFFFFF" />
      <Circle cx="18.5" cy="13" r="1.2" fill="#FFFFFF" />
    </Svg>
  );
}

/**
 * 10. Klaten - Candi Prambanan
 */
export function PrambananKlatenIcon({ size = 24, color = '#1E293B' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Puncak Menara Siwa Prambanan yang Menjulang Tinggi */}
      <Path d="M16 2 L17.5 7 L14.5 7 Z" fill="#F59E0B" />
      <Path d="M16 6 L19 12 L13 12 Z" fill={color} />
      <Path d="M16 11 L21 18 L11 18 Z" fill={color} />
      <Path d="M16 17 L23 25 L9 25 Z" fill={color} />
      <Rect x="6" y="25" width="20" height="4" rx="0.5" fill={color} />
      {/* Candi Pengapit Kecil di Samping */}
      <Path d="M7 21 L9 25 L5 25 Z" fill={color} opacity={0.7} />
      <Path d="M25 21 L27 25 L23 25 Z" fill={color} opacity={0.7} />
    </Svg>
  );
}

/**
 * 11. Jepara - Ukiran Kayu Khas Jepara
 */
export function UkiranJeparaIcon({ size = 24, color = '#D97706' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Sulur Daun & Bunga Ukir Tradisional */}
      <Path
        d="M16 16 C12 10 6 12 6 17 C6 22 12 24 16 21 C20 24 26 22 26 17 C26 12 20 10 16 16 Z"
        fill={color}
      />
      <Path
        d="M16 5 C14 8 13 12 16 16 C19 12 18 8 16 5 Z"
        fill="#B45309"
      />
      <Circle cx="16" cy="16" r="3" fill="#FDE68A" />
      <Circle cx="16" cy="16" r="1.5" fill="#78350F" />
    </Svg>
  );
}

/**
 * 12. Wonogiri - Waduk Gajah Mungkur
 */
export function WadukWonogiriIcon({ size = 24, color = '#0284C7' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Dinding Bendungan / Pintu Air */}
      <Rect x="5" y="8" width="22" height="6" rx="1" fill="#475569" />
      <Path d="M7 14 L11 26 L21 26 L25 14 Z" fill="#64748B" />
      {/* Air Bendungan Mengalir */}
      <Path d="M12 20 C14 22 18 22 20 20" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
      <Path d="M10 24 C13 26 19 26 22 24" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" />
      <Circle cx="16" cy="11" r="1.5" fill="#EF4444" />
    </Svg>
  );
}

/**
 * 13. Tegal Kab - Poci Teh Slawi
 */
export function PociTegalIcon({ size = 24, color = '#B45309' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Badan Teko Poci Tanah Liat */}
      <Circle cx="16" cy="18" r="8" fill={color} />
      {/* Tutup Poci dengan Pegangan */}
      <Rect x="12" y="9" width="8" height="3" rx="1.5" fill="#78350F" />
      <Circle cx="16" cy="8" r="1.5" fill="#78350F" />
      {/* Moncong Poci */}
      <Path d="M8 17 C6 16 4 13 4 11 C6 11 8 13 10 15 Z" fill={color} />
      {/* Gagang Poci Kanan */}
      <Path d="M22 13 C26 13 27 21 22 22" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Uap Hangat Teh */}
      <Path d="M14 4 C13 2 15 1 16 2" stroke="#F59E0B" strokeWidth="1.2" strokeLinecap="round" />
    </Svg>
  );
}

/**
 * 14. Pati - Padi & Gerbang Majapahit (Bumi Mina Tani)
 */
export function PadiPatiIcon({ size = 24, color = '#EAB308' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Batang & Bulir Padi Mas */}
      <Path d="M16 28 C16 16 12 8 8 4" stroke="#854D0E" strokeWidth="2" strokeLinecap="round" />
      <Circle cx="10" cy="7" r="2" fill={color} />
      <Circle cx="13" cy="10" r="2" fill={color} />
      <Circle cx="11" cy="13" r="2" fill={color} />
      <Circle cx="15" cy="15" r="2" fill={color} />
      <Circle cx="13" cy="18" r="2" fill={color} />
      <Circle cx="17" cy="20" r="2" fill={color} />
      <Circle cx="15" cy="23" r="2" fill={color} />
      {/* Ikan Mina Bahari */}
      <Path d="M20 10 C24 10 28 14 28 14 C28 14 24 18 20 18 C19 18 18 16 18 14 C18 12 19 10 20 10 Z" fill="#38BDF8" />
      <Polygon points="27,14 30,11 30,17" fill="#38BDF8" />
    </Svg>
  );
}

/**
 * 15. Wonosobo - Dieng & Telaga Warna
 */
export function DiengWonosoboIcon({ size = 24, color = '#15803D' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Gunung Sindoro Sumbing */}
      <Path d="M3 24 L13 6 L23 24 Z" fill={color} />
      <Path d="M15 24 L23 10 L31 24 Z" fill="#16A34A" opacity={0.8} />
      {/* Kawah Telaga Warna Tosca */}
      <Ellipse cx="16" cy="24" rx="10" ry="4" fill="#06B6D4" />
      <Circle cx="16" cy="24" r="2" fill="#FACC15" />
    </Svg>
  );
}

/**
 * 16. Blora - Pohon Kayu Jati
 */
export function PohonJatiBloraIcon({ size = 24, color = '#15803D' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Batang Kayu Jati Kokoh */}
      <Rect x="14" y="16" width="4" height="12" rx="1" fill="#78350F" />
      {/* Rindang Daun Jati Daun Lebar */}
      <Circle cx="16" cy="11" r="8" fill={color} />
      <Circle cx="11" cy="13" r="6" fill="#16A34A" />
      <Circle cx="21" cy="13" r="6" fill="#16A34A" />
    </Svg>
  );
}

/**
 * Generic Regional Icon untuk daerah pegunungan/pantai lainnya
 */
export function GenericMountainIcon({ size = 24, color = '#15803D' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M4 25 L16 7 L28 25 Z" fill={color} />
      <Path d="M12 25 L20 13 L28 25 Z" fill="#22C55E" opacity={0.8} />
      <Path d="M16 7 L18 12 L14 12 Z" fill="#FFFFFF" />
    </Svg>
  );
}

export function GenericCoastalIcon({ size = 24, color = '#0284C7' }: LandmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M4 22 C9 18 13 24 17 21 C21 18 25 24 29 21" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M6 26 C10 23 14 27 18 25 C22 23 25 27 28 25" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
      <Circle cx="16" cy="9" r="4" fill="#FACC15" />
    </Svg>
  );
}

/**
 * Resolver Ikon Landmark Berdasarkan Region ID
 */
export function getLandmarkIcon(regionId: string, size = 22, color = '#1E293B'): React.ReactNode {
  switch (regionId) {
    case 'reg_33_74': // Kota Semarang
      return <TuguMudaSemarangIcon size={size} color={color} secondaryColor="#EF4444" />;

    case 'reg_33_72': // Kota Surakarta
      return <KeratonSoloIcon size={size} color={color} />;

    case 'reg_33_71': // Kota Magelang
    case 'reg_33_08': // Kab Magelang
      return <BorobudurStupaIcon size={size} color={color} />;

    case 'reg_33_19': // Kudus
      return <MenaraKudusIcon size={size} color={color} />;

    case 'reg_33_21': // Demak
      return <MasjidDemakIcon size={size} color={color} />;

    case 'reg_33_75': // Kota Pekalongan
    case 'reg_33_26': // Kab Pekalongan
      return <BatikPekalonganIcon size={size} color={color} />;

    case 'reg_33_29': // Brebes
      return <BawangBrebesIcon size={size} color="#E11D48" />;

    case 'reg_33_01': // Cilacap
      return <KilangCilacapIcon size={size} color={color} />;

    case 'reg_33_09': // Boyolali
      return <SapiBoyolaliIcon size={size} color={color} />;

    case 'reg_33_10': // Klaten
      return <PrambananKlatenIcon size={size} color={color} />;

    case 'reg_33_20': // Jepara
      return <UkiranJeparaIcon size={size} color="#D97706" />;

    case 'reg_33_12': // Wonogiri
      return <WadukWonogiriIcon size={size} color="#0284C7" />;

    case 'reg_33_28': // Kab Tegal
    case 'reg_33_76': // Kota Tegal
      return <PociTegalIcon size={size} color="#B45309" />;

    case 'reg_33_18': // Pati
      return <PadiPatiIcon size={size} color="#EAB308" />;

    case 'reg_33_07': // Wonosobo
    case 'reg_33_04': // Banjarnegara
      return <DiengWonosoboIcon size={size} color="#15803D" />;

    case 'reg_33_16': // Blora
      return <PohonJatiBloraIcon size={size} color="#15803D" />;

    case 'reg_33_73': // Salatiga
    case 'reg_33_23': // Temanggung
    case 'reg_33_13': // Karanganyar
      return <GenericMountainIcon size={size} color="#15803D" />;

    case 'reg_33_17': // Rembang
    case 'reg_33_27': // Pemalang
    case 'reg_33_25': // Batang
    case 'reg_33_24': // Kendal
    case 'reg_33_05': // Kebumen
      return <GenericCoastalIcon size={size} color="#0284C7" />;

    default:
      return <TuguMudaSemarangIcon size={size} color={color} />;
  }
}
