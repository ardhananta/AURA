import axios from 'axios';

export type LandscapeType = 'kota' | 'gunung' | 'pesisir';

export interface RealtimeTerrainResult {
  landscape: LandscapeType;
  elevation: number;
  reason: string;
}

export const terrainService = {
  /**
   * Fast keyword-based terrain classification
   */
  classifyTerrainByName(name: string = '', category: string = ''): LandscapeType {
    const text = `${name} ${category}`.toLowerCase();
    if (
      text.includes('pantai') ||
      text.includes('pesisir') ||
      text.includes('pelabuhan') ||
      text.includes('tanjung') ||
      text.includes('laut') ||
      text.includes('marina') ||
      text.includes('pantura') ||
      text.includes('kenjeran') ||
      text.includes('ancol') ||
      text.includes('muara') ||
      text.includes('dermaga') ||
      text.includes('semarang utara') ||
      text.includes('jakarta utara') ||
      text.includes('surabaya utara')
    ) {
      return 'pesisir';
    }
    if (
      text.includes('gunung') ||
      text.includes('dago') ||
      text.includes('lembang') ||
      text.includes('bukit') ||
      text.includes('ungaran') ||
      text.includes('bandung') ||
      text.includes('puncak') ||
      text.includes('candi') ||
      text.includes('dataran tinggi') ||
      text.includes('lereng') ||
      text.includes('hutan') ||
      text.includes('pegunungan') ||
      text.includes('batu') ||
      text.includes('dieng') ||
      text.includes('wonosobo')
    ) {
      return 'gunung';
    }
    return 'kota';
  },

  /**
   * Real-time terrain & elevation detection using Open-Meteo elevation API + GPS reverse geocoding
   */
  async getRealtimeTerrain(
    lat: number,
    lon: number,
    locationName: string = '',
    category: string = ''
  ): Promise<RealtimeTerrainResult> {
    let elevation = 0;
    try {
      const res = await axios.get(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`,
        { timeout: 3500 }
      );
      if (typeof res.data?.elevation === 'number') {
        elevation = Math.round(res.data.elevation);
      }
    } catch (err) {
      // Fallback if offline
    }

    const text = `${locationName} ${category}`.toLowerCase();

    // 1. Coastal check (names or coastal keywords or sea-level coastal regions)
    const isCoastal =
      text.includes('pantai') ||
      text.includes('pesisir') ||
      text.includes('pelabuhan') ||
      text.includes('tanjung') ||
      text.includes('laut') ||
      text.includes('marina') ||
      text.includes('muara') ||
      text.includes('teluk') ||
      text.includes('dermaga') ||
      text.includes('ancol') ||
      text.includes('kenjeran') ||
      text.includes('pantura') ||
      text.includes('semarang utara') ||
      text.includes('jakarta utara') ||
      text.includes('surabaya utara') ||
      (elevation <= 8 && (text.includes('utara') || text.includes('selat') || text.includes('pulau')));

    if (isCoastal) {
      return {
        landscape: 'pesisir',
        elevation,
        reason: `Wilayah Pesisir (${elevation} mdpl)`,
      };
    }

    // 2. Mountainous / Highland check (elevation >= 450 meters or highland keywords)
    const isHighlandName =
      text.includes('gunung') ||
      text.includes('bukit') ||
      text.includes('lembang') ||
      text.includes('dago') ||
      text.includes('bandung') ||
      text.includes('puncak') ||
      text.includes('batu') ||
      text.includes('dieng') ||
      text.includes('wonosobo') ||
      text.includes('ungaran') ||
      text.includes('lereng') ||
      text.includes('dataran tinggi');

    if (elevation >= 450 || isHighlandName) {
      return {
        landscape: 'gunung',
        elevation,
        reason: `Wilayah Pegunungan (${elevation} mdpl)`,
      };
    }

    // 3. Urban Plains / City
    return {
      landscape: 'kota',
      elevation,
      reason: `Wilayah Perkotaan (${elevation} mdpl)`,
    };
  },

  /**
   * Return the local landscape image asset
   */
  getLandscapeAsset(type: LandscapeType) {
    switch (type) {
      case 'gunung':
        return require('@/assets/indexmap/gunung.png');
      case 'pesisir':
        return require('@/assets/indexmap/pesisir.png');
      case 'kota':
      default:
        return require('@/assets/indexmap/kota.png');
    }
  },

  /**
   * Human-readable label for landscape
   */
  getLandscapeLabel(type: LandscapeType): string {
    switch (type) {
      case 'gunung':
        return 'Pegunungan';
      case 'pesisir':
        return 'Pesisir';
      case 'kota':
      default:
        return 'Perkotaan';
    }
  },

  /**
   * Ionicons name for landscape
   */
  getLandscapeIcon(type: LandscapeType): string {
    switch (type) {
      case 'gunung':
        return 'image-outline';
      case 'pesisir':
        return 'water-outline';
      case 'kota':
      default:
        return 'business-outline';
    }
  },
};

export const {
  classifyTerrainByName,
  getRealtimeTerrain,
  getLandscapeAsset,
  getLandscapeLabel,
  getLandscapeIcon,
} = terrainService;
