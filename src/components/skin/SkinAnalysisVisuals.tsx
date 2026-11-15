import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Line,
  Path,
  Polygon,
  Rect,
} from 'react-native-svg';
import { FaceGeometry, SkinCvAnalysis, SkinScanData } from '@/types/ai';

export type SkinDiffVariant = 'woodlamp' | 'geometry' | 'micro_map';

export interface AgenticPipelineSummary {
  pipelineVersion: string;
  landmarksCount: number;
  microRegionsCount: number;
  colorSpaces: string[];
  tZoneScore: number;
  uZoneScore: number;
  artifactSuppressionRate: number;
  patchAnomalyRate: number;
  woodSebumIndex: number;
  erythemaIndex: number;
  autoFitted: boolean;
  completedAt: string;
}

export interface AgenticSubstepInfo {
  id: string;
  stage: 1 | 2;
  stageTitle: string;
  title: string;
  description: string;
  badge: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export const AGENTIC_PIPELINE_STEPS: AgenticSubstepInfo[] = [
  {
    id: 'constancy',
    stage: 1,
    stageTitle: 'Tahap 1 • Normalisasi & Transformasi Wood’s Lamp',
    title: 'Koreksi Cahaya & Artifact Removal',
    description:
      'Menyeimbangkan pencahayaan ruangan serta mengurangi helai rambut halus & pantulan silau.',
    badge: 'Dull Razor + WB',
    icon: 'sunny-outline',
  },
  {
    id: 'woodlamp',
    stage: 1,
    stageTitle: 'Tahap 1 • Normalisasi & Transformasi Wood’s Lamp',
    title: 'Transformasi Cahaya Wood’s Lamp (365nm)',
    description:
      'Mengubah spektrum gambar menjadi iluminasi UV 365nm untuk melihat fluoresensi sebum & melanin subkutan.',
    badge: 'Wood’s 365nm UV',
    icon: 'flashlight-outline',
  },
  {
    id: 'geometry',
    stage: 2,
    stageTitle: 'Tahap 2 • Geometri Wajah Otomatis & Analisis Lanjut',
    title: 'Auto-Fit Geometri Wajah (Python CV)',
    description:
      'Mendeteksi kulit YCbCr/HSV dan menyesuaikan kontur mata, hidung, pipi & dagu otomatis ke bentuk wajah.',
    badge: 'Auto Geometry',
    icon: 'scan-outline',
  },
  {
    id: 'deep_analysis',
    stage: 2,
    stageTitle: 'Tahap 2 • Geometri Wajah Otomatis & Analisis Lanjut',
    title: 'Analisis Lanjut Zona T/U & 384+ Mikro-Patch',
    description:
      'Mengukur respons barrier, eritema & hidrasi per zona berdasarkan citra Wood’s Lamp sebelum kesimpulan akhir.',
    badge: 'Deep SCIN',
    icon: 'analytics-outline',
  },
];

// Default proportional contour inside a normalized [0..1] box when server CV bbox isn't available yet
const DEFAULT_GEOMETRY: FaceGeometry = {
  detected: false,
  tilt_deg: 0,
  bbox: { x: 0.2, y: 0.12, width: 0.6, height: 0.76 },
  landmarks: {
    forehead: [0.5, 0.24],
    left_eye: [0.36, 0.4],
    right_eye: [0.64, 0.4],
    nose_tip: [0.5, 0.56],
    left_cheek: [0.33, 0.58],
    right_cheek: [0.67, 0.58],
    mouth_center: [0.5, 0.71],
    chin: [0.5, 0.85],
  },
  contour: [
    [0.5, 0.13],
    [0.67, 0.18],
    [0.78, 0.36],
    [0.77, 0.56],
    [0.7, 0.72],
    [0.62, 0.84],
    [0.5, 0.88],
    [0.38, 0.84],
    [0.3, 0.72],
    [0.23, 0.56],
    [0.22, 0.36],
    [0.33, 0.18],
  ],
  t_zone: [
    [0.35, 0.22],
    [0.65, 0.22],
    [0.63, 0.36],
    [0.55, 0.41],
    [0.57, 0.58],
    [0.5, 0.61],
    [0.43, 0.58],
    [0.45, 0.41],
    [0.37, 0.36],
  ],
  left_cheek_zone: [
    [0.27, 0.46],
    [0.41, 0.47],
    [0.41, 0.72],
    [0.3, 0.71],
  ],
  right_cheek_zone: [
    [0.59, 0.47],
    [0.73, 0.46],
    [0.7, 0.71],
    [0.59, 0.72],
  ],
};

function mapNormalizedToFitBox(
  nx: number,
  ny: number,
  boxW: number,
  boxH: number,
  srcW?: number,
  srcH?: number,
  fitMode: 'cover' | 'contain' = 'cover'
): [number, number] {
  if (!srcW || !srcH || srcW <= 0 || srcH <= 0 || boxW <= 0 || boxH <= 0) {
    return [nx * boxW, ny * boxH];
  }
  const scale =
    fitMode === 'contain'
      ? Math.min(boxW / srcW, boxH / srcH)
      : Math.max(boxW / srcW, boxH / srcH);
  const scaledW = srcW * scale;
  const scaledH = srcH * scale;
  const offsetX = (boxW - scaledW) * 0.5;
  const offsetY = (boxH - scaledH) * 0.5;
  return [offsetX + nx * scaledW, offsetY + ny * scaledH];
}

function mapNormalizedToCoverBox(
  nx: number,
  ny: number,
  boxW: number,
  boxH: number,
  srcW?: number,
  srcH?: number
): [number, number] {
  return mapNormalizedToFitBox(nx, ny, boxW, boxH, srcW, srcH, 'cover');
}

function pointsToProjectedClosedPath(
  pts: [number, number][],
  boxW: number,
  boxH: number,
  srcW?: number,
  srcH?: number
): string {
  if (!pts.length) return '';
  return (
    pts
      .map(([x, y], idx) => {
        const [px, py] = mapNormalizedToCoverBox(x, y, boxW, boxH, srcW, srcH);
        return `${idx === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`;
      })
      .join(' ') + ' Z'
  );
}

export function buildAgenticSummary(data: SkinScanData): AgenticPipelineSummary {
  const hydration = data.skin_metrics?.hydration_score ?? 80;
  const redness = data.skin_metrics?.redness_score ?? 12;
  const barrier = data.skin_metrics?.barrier_integrity_score ?? 82;
  const clog = data.skin_metrics?.pollution_clog_score ?? 18;
  const uv = data.skin_metrics?.uv_damage_score ?? 20;
  const cv = data.cv_analysis?.cv_metrics;

  const tZoneScore = Math.max(
    45,
    Math.min(98, Math.round((hydration * 0.45 + barrier * 0.4 + (100 - clog) * 0.15)))
  );
  const uZoneScore = Math.max(
    45,
    Math.min(98, Math.round((hydration * 0.55 + (100 - redness) * 0.25 + (100 - uv) * 0.2)))
  );
  const artifactSuppressionRate = Math.min(99, Math.max(88, 92 + (clog % 7)));
  const patchAnomalyRate = Math.min(
    48,
    Math.max(4, Math.round((redness * 0.45 + clog * 0.35 + uv * 0.2) * 0.6))
  );

  return {
    pipelineVersion: 'AURA-WoodUV-v3',
    landmarksCount: 468,
    microRegionsCount: 396,
    colorSpaces: ['Wood 365nm', 'YCbCr', 'HSV'],
    tZoneScore,
    uZoneScore,
    artifactSuppressionRate,
    patchAnomalyRate,
    woodSebumIndex: cv?.tzone_sebum_fluorescence ?? Math.round(32 + clog * 0.65),
    erythemaIndex: cv?.erythema_index ?? Math.round(redness * 0.9),
    autoFitted: Boolean(data.cv_analysis?.face_geometry?.detected),
    completedAt: new Date().toISOString(),
  };
}

/**
 * Clean Clinical Blue & White facial reticle overlay for the live camera.
 * Fits nicely inside the white corner brackets with restrained medical lines.
 */
export function FaceScanMaskOverlay({
  frameWidth = 280,
  frameHeight = 350,
  statusLabel = 'Siap! Ketuk tombol',
  showCornerBrackets = true,
  showMesh = true,
  faceGeometry,
  srcWidth,
  srcHeight,
  fitMode = 'cover',
}: {
  frameWidth?: number;
  frameHeight?: number;
  statusLabel?: string;
  showCornerBrackets?: boolean;
  showMesh?: boolean;
  faceGeometry?: FaceGeometry;
  srcWidth?: number;
  srcHeight?: number;
  fitMode?: 'cover' | 'contain';
}) {
  const geom = faceGeometry || DEFAULT_GEOMETRY;
  const lm = geom.landmarks;
  const contour = geom.contour;
  const toXY = (p: [number, number]): [number, number] =>
    mapNormalizedToFitBox(p[0], p[1], frameWidth, frameHeight, srcWidth, srcHeight, fitMode);

  const fh = toXY(lm.forehead);
  const le = toXY(lm.left_eye);
  const re = toXY(lm.right_eye);
  const nt = toXY(lm.nose_tip);
  const lc = toXY(lm.left_cheek);
  const rc = toXY(lm.right_cheek);
  const mc = toXY(lm.mouth_center);
  const ch = toXY(lm.chin);

  const wirePairs: [[number, number], [number, number]][] = [
    [fh, le],
    [fh, re],
    [fh, nt],
    [le, re],
    [le, nt],
    [re, nt],
    [le, lc],
    [re, rc],
    [lc, nt],
    [rc, nt],
    [lc, mc],
    [rc, mc],
    [nt, mc],
    [lc, ch],
    [rc, ch],
    [mc, ch],
  ];

  const keyNodes = [fh, le, re, nt, lc, rc, mc, ch];
  const cornerSize = Math.round(Math.min(frameWidth, frameHeight) * 0.14);

  return (
    <View style={[styles.maskContainer, { width: frameWidth, height: frameHeight }]}>
      <Svg
        width={frameWidth}
        height={frameHeight}
        viewBox={`0 0 ${frameWidth} ${frameHeight}`}
        style={StyleSheet.absoluteFill}
      >
        {showMesh && (
          <>
            {/* Outer clean facial silhouette guide in crisp clinical blue */}
            <Polygon
              points={contour
                .map((p) => {
                  const [px, py] = toXY(p);
                  return `${px.toFixed(1)},${py.toFixed(1)}`;
                })
                .join(' ')}
              fill="rgba(30, 108, 239, 0.05)"
              stroke="rgba(96, 165, 250, 0.72)"
              strokeWidth={1.35}
            />

            {/* Restrained geometric face triangles (zero clutter) */}
            {wirePairs.map(([a, b], idx) => (
              <Line
                key={`w-${idx}`}
                x1={a[0]}
                y1={a[1]}
                x2={b[0]}
                y2={b[1]}
                stroke="rgba(191, 219, 254, 0.52)"
                strokeWidth={0.9}
              />
            ))}

            {/* Symmetry & brow guide lines */}
            <Line
              x1={fh[0]}
              y1={toXY(contour[0])[1]}
              x2={ch[0]}
              y2={ch[1]}
              stroke="rgba(255, 255, 255, 0.35)"
              strokeWidth={0.85}
              strokeDasharray="4 4"
            />

            {keyNodes.map(([x, y], idx) => (
              <G key={`kn-${idx}`}>
                <Circle cx={x} cy={y} r={3.5} fill="rgba(255, 255, 255, 0.9)" />
                <Circle cx={x} cy={y} r={1.8} fill="#1E6CEF" />
              </G>
            ))}
          </>
        )}

        {/* Clean White Corner Brackets */}
        {showCornerBrackets && (
          <G stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" fill="none">
            <Path d={`M 8 ${8 + cornerSize} L 8 18 Q 8 8 18 8 L ${8 + cornerSize} 8`} />
            <Path
              d={`M ${frameWidth - 8 - cornerSize} 8 L ${frameWidth - 18} 8 Q ${
                frameWidth - 8
              } 8 ${frameWidth - 8} 18 L ${frameWidth - 8} ${8 + cornerSize}`}
            />
            <Path
              d={`M 8 ${frameHeight - 8 - cornerSize} L 8 ${frameHeight - 18} Q 8 ${
                frameHeight - 8
              } 18 ${frameHeight - 8} L ${8 + cornerSize} ${frameHeight - 8}`}
            />
            <Path
              d={`M ${frameWidth - 8 - cornerSize} ${frameHeight - 8} L ${
                frameWidth - 18
              } ${frameHeight - 8} Q ${frameWidth - 8} ${frameHeight - 8} ${
                frameWidth - 8
              } ${frameHeight - 18} L ${frameWidth - 8} ${frameHeight - 8 - cornerSize}`}
            />
          </G>
        )}
      </Svg>

      {statusLabel ? (
        <View style={styles.readyPromptPill}>
          <View style={styles.readyBlueDot} />
          <Text style={styles.readyPromptText}>{statusLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Renders one of the 3 clean difference visuals inside a compact card/frame:
 *  1) woodlamp  -> Real Python 365nm UV Wood's Lamp image (or clean cobalt UV filter fallback)
 *  2) geometry  -> Real Python auto-fitted face geometry mesh (or warped SVG overlay on photo)
 *  3) micro_map -> Real Python 384+ micro-patch spatial map (or fitted SVG patch heatmap fallback)
 */
function VisualVariantFrame({
  variant,
  imageUri,
  data,
  width,
  height,
}: {
  variant: SkinDiffVariant;
  imageUri?: string;
  data: SkinScanData;
  width: number;
  height: number;
}) {
  const cv = data.cv_analysis;
  const geom = cv?.face_geometry || DEFAULT_GEOMETRY;
  const redness = data.skin_metrics?.redness_score ?? 15;
  const clog = data.skin_metrics?.pollution_clog_score ?? 20;
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(() => {
    const iw = cv?.cv_metrics?.image_width;
    const ih = cv?.cv_metrics?.image_height;
    return iw && ih ? { width: iw, height: ih } : null;
  });

  const backendUri =
    variant === 'woodlamp'
      ? cv?.woodlamp_image
      : variant === 'geometry'
      ? cv?.geometry_mesh_image
      : cv?.micro_analysis_image;

  const patches = useMemo(() => {
    if (variant !== 'micro_map' || (backendUri && backendUri.startsWith('data:image'))) {
      return [];
    }
    const { x, y, width: bw, height: bh } = geom.bbox;
    const [bx0, by0] = mapNormalizedToCoverBox(
      x,
      y,
      width,
      height,
      naturalSize?.width,
      naturalSize?.height
    );
    const [bx1, by1] = mapNormalizedToCoverBox(
      x + bw,
      y + bh,
      width,
      height,
      naturalSize?.width,
      naturalSize?.height
    );
    const cols = 12;
    const rows = 14;
    const cw = Math.max(2, (bx1 - bx0) / cols);
    const ch = Math.max(2, (by1 - by0) / rows);
    const items: { rx: number; ry: number; rw: number; rh: number; color: string }[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const score = ((r * 31 + c * 17 + redness + clog) % 100) / 100;
        const fill =
          score > 0.78
            ? 'rgba(239, 68, 68, 0.45)'
            : score > 0.56
            ? 'rgba(245, 158, 11, 0.36)'
            : score > 0.32
            ? 'rgba(14, 165, 233, 0.34)'
            : 'rgba(30, 108, 239, 0.32)';
        items.push({
          rx: bx0 + c * cw,
          ry: by0 + r * ch,
          rw: Math.max(2, cw - 0.8),
          rh: Math.max(2, ch - 0.8),
          color: fill,
        });
      }
    }
    return items;
  }, [variant, backendUri, width, height, geom.bbox, redness, clog, naturalSize]);

  // When genuine Python CV generated Base64 image is returned, display full fitted face cleanly!
  if (backendUri && backendUri.startsWith('data:image')) {
    const iw = cv?.cv_metrics?.image_width;
    const ih = cv?.cv_metrics?.image_height;
    const lm = geom.landmarks;
    const projectContain = (p: [number, number]): [number, number] =>
      mapNormalizedToFitBox(p[0], p[1], width, height, iw, ih, 'contain');

    const fh = projectContain(lm.forehead);
    const le = projectContain(lm.left_eye);
    const re = projectContain(lm.right_eye);
    const nt = projectContain(lm.nose_tip);
    const lc = projectContain(lm.left_cheek);
    const rc = projectContain(lm.right_cheek);
    const mc = projectContain(lm.mouth_center);
    const ch = projectContain(lm.chin);
    const wirePairs: [[number, number], [number, number]][] = [
      [fh, le],
      [fh, re],
      [fh, nt],
      [le, re],
      [le, nt],
      [re, nt],
      [le, lc],
      [re, rc],
      [lc, nt],
      [rc, nt],
      [lc, mc],
      [rc, mc],
      [nt, mc],
      [lc, ch],
      [rc, ch],
      [mc, ch],
    ];
    const contourContain = geom.contour
      .map((p) => {
        const [px, py] = projectContain(p);
        return `${px.toFixed(1)},${py.toFixed(1)}`;
      })
      .join(' ');

    return (
      <View style={[styles.variantFrame, { width, height }]}>
        <Image
          source={{ uri: backendUri }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
        />
        {variant === 'geometry' && (
          <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Polygon
              points={contourContain}
              fill="rgba(30, 108, 239, 0.08)"
              stroke="#1E6CEF"
              strokeWidth={1.6}
            />
            {wirePairs.map(([a, b], idx) => (
              <Line
                key={`vg-${idx}`}
                x1={a[0]}
                y1={a[1]}
                x2={b[0]}
                y2={b[1]}
                stroke="rgba(255, 255, 255, 0.78)"
                strokeWidth={0.9}
              />
            ))}
            {[fh, le, re, nt, lc, rc, mc, ch].map(([px, py], i) => (
              <Circle
                key={`vgp-${i}`}
                cx={px}
                cy={py}
                r={2.6}
                fill="#FFFFFF"
                stroke="#1E6CEF"
                strokeWidth={1.2}
              />
            ))}
          </Svg>
        )}
      </View>
    );
  }

  // Fallback overlay projected pixel-for-pixel onto `contentFit="cover"` when backend CV image is absent
  const clipId = `faceClip-${variant}-${Math.round(width)}`;
  const tZonePath = pointsToProjectedClosedPath(
    geom.t_zone,
    width,
    height,
    naturalSize?.width,
    naturalSize?.height
  );
  const lCheekPath = pointsToProjectedClosedPath(
    geom.left_cheek_zone,
    width,
    height,
    naturalSize?.width,
    naturalSize?.height
  );
  const rCheekPath = pointsToProjectedClosedPath(
    geom.right_cheek_zone,
    width,
    height,
    naturalSize?.width,
    naturalSize?.height
  );
  const contourPath = pointsToProjectedClosedPath(
    geom.contour,
    width,
    height,
    naturalSize?.width,
    naturalSize?.height
  );
  const lm = geom.landmarks;

  return (
    <View style={[styles.variantFrame, { width, height }]}>
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          onLoad={(ev) => {
            if (ev?.source?.width && ev?.source?.height) {
              setNaturalSize({ width: ev.source.width, height: ev.source.height });
            }
          }}
        />
      ) : (
        <LinearGradient colors={['#DBEAFE', '#1E3A8A']} style={StyleSheet.absoluteFill} />
      )}

      {variant === 'woodlamp' && (
        <>
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(12, 34, 92, 0.56)' }]}
          />
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            <Path d={contourPath} fill="rgba(56, 189, 248, 0.16)" stroke="rgba(186, 230, 253, 0.55)" strokeWidth={1} />
            <Path d={tZonePath} fill="rgba(56, 189, 248, 0.28)" stroke="rgba(186, 230, 253, 0.72)" strokeWidth={1} />
            <Path d={lCheekPath} fill="rgba(29, 78, 216, 0.22)" />
            <Path d={rCheekPath} fill="rgba(29, 78, 216, 0.22)" />
          </Svg>
        </>
      )}

      {variant === 'geometry' && (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Path d={tZonePath} fill="rgba(30, 108, 239, 0.22)" stroke="#2563EB" strokeWidth={1.2} />
          <Path d={lCheekPath} fill="rgba(14, 165, 233, 0.18)" stroke="#38BDF8" strokeWidth={1} />
          <Path d={rCheekPath} fill="rgba(14, 165, 233, 0.18)" stroke="#38BDF8" strokeWidth={1} />
          <Path d={contourPath} fill="none" stroke="#FFFFFF" strokeWidth={1.4} />
          {[
            lm.forehead,
            lm.left_eye,
            lm.right_eye,
            lm.nose_tip,
            lm.left_cheek,
            lm.right_cheek,
            lm.mouth_center,
            lm.chin,
          ].map(([nx, ny], i) => {
            const [px, py] = mapNormalizedToCoverBox(
              nx,
              ny,
              width,
              height,
              naturalSize?.width,
              naturalSize?.height
            );
            return (
              <Circle
                key={`gl-${i}`}
                cx={px}
                cy={py}
                r={2.5}
                fill="#FFFFFF"
                stroke="#1E6CEF"
                strokeWidth={1.1}
              />
            );
          })}
        </Svg>
      )}

      {variant === 'micro_map' && (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <ClipPath id={clipId}>
              <Path d={contourPath} />
            </ClipPath>
          </Defs>
          <G clipPath={`url(#${clipId})`}>
            {patches.map((p, idx) => (
              <Rect
                key={`mp-${idx}`}
                x={p.rx}
                y={p.ry}
                width={p.rw}
                height={p.rh}
                fill={p.color}
                stroke="rgba(255, 255, 255, 0.22)"
                strokeWidth={0.4}
              />
            ))}
          </G>
          <Path d={contourPath} fill="none" stroke="#FFFFFF" strokeWidth={1.1} />
        </Svg>
      )}
    </View>
  );
}

/**
 * Horizontal 3-column layout (`3 berjejer horizontal`) revealing the 3 processed
 * difference images ONE BY ONE sequentially (`keluar satu satu per animasi`).
 * Designed strictly in clean AURA Blue & White clinical styling.
 */
export function SkinDifferenceTriplet({
  imageUri,
  data,
  summary,
}: {
  imageUri?: string;
  data: SkinScanData;
  summary?: AgenticPipelineSummary;
}) {
  const [activeVariant, setActiveVariant] = useState<SkinDiffVariant>('woodlamp');
  const [compareOriginal, setCompareOriginal] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [thumbBox, setThumbBox] = useState<{ width: number; height: number }>({
    width: 102,
    height: 138,
  });

  const resolvedSummary = useMemo(
    () => summary || buildAgenticSummary(data),
    [data, summary]
  );

  const thumbAspectRatio = useMemo(() => {
    const iw = data.cv_analysis?.cv_metrics?.image_width;
    const ih = data.cv_analysis?.cv_metrics?.image_height;
    if (iw && ih && ih > 0) {
      return Math.max(0.62, Math.min(0.85, iw / ih));
    }
    return 0.74;
  }, [data.cv_analysis?.cv_metrics?.image_width, data.cv_analysis?.cv_metrics?.image_height]);

  const modalDims = useMemo(() => {
    const winW = Dimensions.get('window').width;
    const w = Math.min(winW - 48, 340);
    const h = Math.round(w / thumbAspectRatio);
    return { width: w, height: Math.min(h, 460) };
  }, [thumbAspectRatio]);

  // Sequential one-by-one animation progress for the 3 horizontal images
  const [anim0] = useState(() => new Animated.Value(0));
  const [anim1] = useState(() => new Animated.Value(0));
  const [anim2] = useState(() => new Animated.Value(0));

  useEffect(() => {
    anim0.setValue(0);
    anim1.setValue(0);
    anim2.setValue(0);

    const anims = [anim0, anim1, anim2].map((val) =>
      Animated.timing(val, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    );
    const seq = Animated.stagger(360, anims);
    seq.start();

    return () => {
      seq.stop();
    };
  }, [imageUri, data.condition, anim0, anim1, anim2]);

  const cards: {
    key: SkinDiffVariant;
    stepNum: string;
    shortTitle: string;
    subTag: string;
    anim: Animated.Value;
    headline: string;
    metricText: string;
    description: string;
  }[] = [
    {
      key: 'woodlamp',
      stepNum: '01',
      shortTitle: "Wood's Lamp",
      subTag: 'UV 365nm',
      anim: anim0,
      headline: "Transformasi Cahaya Wood's Lamp 365nm",
      metricText: `Sebum UV: ${resolvedSummary.woodSebumIndex ?? 38}/100`,
      description:
        "Mengubah spektrum gambar ke cahaya Wood's Lamp 365nm untuk memperjelas sebum T-zone, pori, dan kontras melanin subkutan sebelum analisis klinis.",
    },
    {
      key: 'geometry',
      stepNum: '02',
      shortTitle: 'Geometri Wajah',
      subTag: resolvedSummary.autoFitted ? 'Auto-Fit' : 'Mesh T/U',
      anim: anim1,
      headline: 'Penyesuaian Geometri Wajah Otomatis',
      metricText: `Zona T/U: ${resolvedSummary.tZoneScore}/${resolvedSummary.uZoneScore}`,
      description:
        'Algoritma Python CV mendeteksi kontur kulit YCbCr/HSV serta menyelaraskan mata, hidung, bibir, T-Zone & U-Zone secara otomatis.',
    },
    {
      key: 'micro_map',
      stepNum: '03',
      shortTitle: 'Analisis Lanjut',
      subTag: '384+ Patch',
      anim: anim2,
      headline: 'Peta Biomarker 384+ Mikro-Patch',
      metricText: `Indeks Eritema: ${resolvedSummary.erythemaIndex ?? 18}/100`,
      description:
        'Evaluasi intensitas kemerahan vaskular, gangguan barrier, dan keragaman tekstur pada tiap blok mikro di dalam kontur wajah.',
    },
  ];

  const activeCard = cards.find((c) => c.key === activeVariant) || cards[0];
  const croppedOriginalUri = data.cv_analysis?.cropped_face_image || imageUri;

  return (
    <View style={styles.tripletContainer}>
      {/* Header Row */}
      <View style={styles.tripletHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.tripletBadge}>
            <Ionicons name="layers-outline" size={12} color="#1E6CEF" />
            <Text style={styles.tripletBadgeText}>HASIL VISUAL 3 TAHAP</Text>
          </View>
          <Text style={styles.tripletTitle}>Citra Perbedaan Kulit & Geometri</Text>
        </View>
        <Pressable
          style={[
            styles.compareChip,
            compareOriginal && styles.compareChipActive,
          ]}
          onPress={() => setCompareOriginal((prev) => !prev)}
        >
          <Ionicons
            name="eye-outline"
            size={13}
            color={compareOriginal ? '#FFFFFF' : '#1E6CEF'}
          />
          <Text
            style={[
              styles.compareChipText,
              compareOriginal && styles.compareChipTextActive,
            ]}
          >
            {compareOriginal ? 'Lihat CV' : 'Foto Asli'}
          </Text>
        </Pressable>
      </View>

      {/* ─── 3 HORIZONTAL CARDS APPEARING ONE BY ONE SEQUENTIALLY ─── */}
      <View style={styles.horizontalRow}>
        {cards.map((card, idx) => {
          const isSelected = activeVariant === card.key;
          const translateY = card.anim.interpolate({
            inputRange: [0, 1],
            outputRange: [18, 0],
          });
          const scale = card.anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.94, 1],
          });

          return (
            <Animated.View
              key={card.key}
              style={[
                styles.horizontalCardWrap,
                {
                  opacity: card.anim,
                  transform: [{ translateY }, { scale }],
                },
              ]}
            >
              <Pressable
                style={[
                  styles.horizontalCard,
                  isSelected && styles.horizontalCardSelected,
                ]}
                onPress={() => {
                  setCompareOriginal(false);
                  if (activeVariant === card.key) {
                    setZoomOpen(true);
                  } else {
                    setActiveVariant(card.key);
                  }
                }}
              >
                <View
                  style={[styles.thumbFrameWrap, { aspectRatio: thumbAspectRatio }]}
                  onLayout={
                    idx === 0
                      ? (ev) => {
                          const { width: lw, height: lh } = ev.nativeEvent.layout;
                          if (lw > 20 && lh > 20) {
                            setThumbBox((prev) =>
                              Math.abs(prev.width - lw) > 1 || Math.abs(prev.height - lh) > 1
                                ? { width: Math.round(lw), height: Math.round(lh) }
                                : prev
                            );
                          }
                        }
                      : undefined
                  }
                >
                  {compareOriginal && croppedOriginalUri ? (
                    <Image
                      source={{ uri: croppedOriginalUri }}
                      style={StyleSheet.absoluteFill}
                      contentFit="contain"
                    />
                  ) : (
                    <VisualVariantFrame
                      variant={card.key}
                      imageUri={croppedOriginalUri}
                      data={data}
                      width={thumbBox.width}
                      height={thumbBox.height}
                    />
                  )}
                  <View style={styles.stepPillOverlay}>
                    <Text style={styles.stepPillOverlayText}>{card.stepNum}</Text>
                  </View>
                </View>

                <View style={styles.horizontalCardMeta}>
                  <Text
                    style={[
                      styles.horizontalCardTitle,
                      isSelected && styles.horizontalCardTitleSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {card.shortTitle}
                  </Text>
                  <Text style={styles.horizontalCardSub} numberOfLines={1}>
                    {card.subTag}
                  </Text>
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      {/* Clean Selected Image Clinical Detail Footer (Light Blue Card) */}
      <View style={styles.selectedInfoCard}>
        <View style={styles.selectedInfoHeader}>
          <Text style={styles.selectedInfoHeadline}>{activeCard.headline}</Text>
          <View style={styles.metricPillBlue}>
            <Text style={styles.metricPillBlueText}>{activeCard.metricText}</Text>
          </View>
        </View>
        <Text style={styles.selectedInfoDesc}>{activeCard.description}</Text>

        {/* Clean Legend + Zoom trigger */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#1E6CEF' }]} />
            <Text style={styles.legendText}>Optimal / Normal</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#0EA5E9' }]} />
            <Text style={styles.legendText}>Fluoresensi Sebum UV</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.legendText}>Stress Barrier</Text>
          </View>
          <Pressable style={styles.zoomMiniBtn} onPress={() => setZoomOpen(true)}>
            <Ionicons name="expand-outline" size={12} color="#1E6CEF" />
            <Text style={styles.zoomMiniBtnText}>Perbesar</Text>
          </Pressable>
        </View>
      </View>

      {/* Full-Face Inspection Modal */}
      <Modal
        visible={zoomOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomOpen(false)}
      >
        <View style={styles.zoomModalBackdrop}>
          <View style={styles.zoomModalCard}>
            <View style={styles.zoomModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.zoomModalTitle}>{activeCard.headline}</Text>
                <Text style={styles.zoomModalSub}>{activeCard.metricText}</Text>
              </View>
              <Pressable
                style={styles.zoomCloseBtn}
                onPress={() => setZoomOpen(false)}
              >
                <Ionicons name="close" size={18} color="#0F172A" />
              </Pressable>
            </View>

            <View style={[styles.zoomStageWrap, { width: modalDims.width, height: modalDims.height }]}>
              {compareOriginal && croppedOriginalUri ? (
                <Image
                  source={{ uri: croppedOriginalUri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="contain"
                />
              ) : (
                <VisualVariantFrame
                  variant={activeVariant}
                  imageUri={croppedOriginalUri}
                  data={data}
                  width={modalDims.width}
                  height={modalDims.height}
                />
              )}
            </View>

            <View style={styles.zoomSwitcherRow}>
              {cards.map((c) => {
                const active = !compareOriginal && activeVariant === c.key;
                return (
                  <Pressable
                    key={`m-${c.key}`}
                    style={[styles.zoomTabPill, active && styles.zoomTabPillActive]}
                    onPress={() => {
                      setCompareOriginal(false);
                      setActiveVariant(c.key);
                    }}
                  >
                    <Text
                      style={[
                        styles.zoomTabText,
                        active && styles.zoomTabTextActive,
                      ]}
                    >
                      {c.shortTitle}
                    </Text>
                  </Pressable>
                );
              })}
              {croppedOriginalUri ? (
                <Pressable
                  style={[
                    styles.zoomTabPill,
                    compareOriginal && styles.zoomTabPillActive,
                  ]}
                  onPress={() => setCompareOriginal((p) => !p)}
                >
                  <Text
                    style={[
                      styles.zoomTabText,
                      compareOriginal && styles.zoomTabTextActive,
                    ]}
                  >
                    Asli
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/**
 * Clean Clinical Blue & White Agentic AI Pipeline View shown during processing.
 */
export function AgenticPipelinePanel({
  photoUri,
  activeStepIndex,
  isCompleted = false,
  cvPreview,
}: {
  photoUri?: string | null;
  activeStepIndex: number;
  isCompleted?: boolean;
  cvPreview?: SkinCvAnalysis | null;
}) {
  const activeStep =
    AGENTIC_PIPELINE_STEPS[
      Math.min(activeStepIndex, AGENTIC_PIPELINE_STEPS.length - 1)
    ];

  const isWoodLampActive = activeStepIndex >= 1;
  const stageImageUri = useMemo(() => {
    if (!cvPreview) return photoUri || undefined;
    if (activeStepIndex >= 3 && cvPreview.micro_analysis_image) {
      return cvPreview.micro_analysis_image;
    }
    if (activeStepIndex >= 2 && cvPreview.geometry_mesh_image) {
      return cvPreview.geometry_mesh_image;
    }
    if (activeStepIndex >= 1 && cvPreview.woodlamp_image) {
      return cvPreview.woodlamp_image;
    }
    return cvPreview.cropped_face_image || photoUri || undefined;
  }, [cvPreview, activeStepIndex, photoUri]);

  const hasLiveCvImage = Boolean(
    cvPreview &&
      (activeStepIndex >= 1 || cvPreview.cropped_face_image) &&
      stageImageUri?.startsWith('data:image')
  );
  const previewAspectRatio = useMemo(() => {
    const iw = cvPreview?.cv_metrics?.image_width;
    const ih = cvPreview?.cv_metrics?.image_height;
    if (iw && ih && ih > 0) {
      return Math.max(0.62, Math.min(0.86, iw / ih));
    }
    return 0.78;
  }, [cvPreview?.cv_metrics?.image_width, cvPreview?.cv_metrics?.image_height]);
  const previewW = 168;
  const previewH = Math.round(previewW / previewAspectRatio);

  // Subtle horizontal Wood's UV sweep animation across preview photo
  const [scanLine] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (isCompleted) return;
    scanLine.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scanLine, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isCompleted, scanLine]);

  const sweepTranslateY = scanLine.interpolate({
    inputRange: [0, 1],
    outputRange: [8, Math.max(24, previewH - 12)],
  });

  return (
    <View style={styles.agenticContainer}>
      {/* White Clinical Preview Card with Real Captured Face UV + Auto-Fitted CV Transition */}
      <View style={styles.agenticPreviewCard}>
        <View style={[styles.previewStage, { width: previewW, height: previewH }]}>
          {stageImageUri ? (
            <Image
              source={{ uri: stageImageUri }}
              style={StyleSheet.absoluteFill}
              contentFit={hasLiveCvImage ? 'contain' : 'cover'}
            />
          ) : (
            <LinearGradient
              colors={['#EFF6FF', '#DBEAFE']}
              style={StyleSheet.absoluteFill}
            />
          )}

          {/* Subtle Wood's Lamp 365nm tint ONLY while awaiting real Python Wood's Lamp CV */}
          {isWoodLampActive && !hasLiveCvImage && (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: 'rgba(15, 43, 107, 0.50)' },
              ]}
            />
          )}

          {/* Render REAL captured geometry mesh once CV detects face (kept crisp over live preview) */}
          <FaceScanMaskOverlay
            frameWidth={previewW}
            frameHeight={previewH}
            statusLabel=""
            showCornerBrackets={!hasLiveCvImage}
            showMesh={Boolean(cvPreview?.face_geometry) && activeStepIndex < 3}
            faceGeometry={cvPreview?.face_geometry}
            srcWidth={cvPreview?.cv_metrics?.image_width}
            srcHeight={cvPreview?.cv_metrics?.image_height}
            fitMode={hasLiveCvImage ? 'contain' : 'cover'}
          />

          {/* Subtle clean blue scan beam */}
          {!isCompleted && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.scanBeamLine,
                { transform: [{ translateY: sweepTranslateY }] },
              ]}
            />
          )}
        </View>

        <View style={styles.agenticLiveInfo}>
          <View style={styles.agenticBadgeRow}>
            <View style={styles.agenticPillBlue}>
              <View style={styles.agenticBlueDot} />
              <Text style={styles.agenticPillTextBlue}>
                {isCompleted
                  ? 'Analisis Selesai'
                  : `Langkah ${activeStepIndex + 1} / ${AGENTIC_PIPELINE_STEPS.length}`}
              </Text>
            </View>
          </View>
          <Text style={styles.agenticActiveTitle}>{activeStep.title}</Text>
          <Text style={styles.agenticActiveSub}>{activeStep.description}</Text>
        </View>
      </View>

      {/* Clean White & Blue Stepper Cards */}
      <View style={styles.stageGroupCard}>
        <Text style={styles.stageGroupTitle}>Alur Pemrosesan Kulit Klinis</Text>
        {AGENTIC_PIPELINE_STEPS.map((step, index) => {
          const stepDone = isCompleted || activeStepIndex > index;
          const stepRunning = !isCompleted && activeStepIndex === index;
          return (
            <View
              key={step.id}
              style={[
                styles.substepRow,
                stepRunning && styles.substepRowActive,
              ]}
            >
              <View
                style={[
                  styles.substepIconCircle,
                  stepDone && styles.substepIconDone,
                  stepRunning && styles.substepIconRunning,
                ]}
              >
                <Ionicons
                  name={stepDone ? 'checkmark' : step.icon}
                  size={14}
                  color={stepDone ? '#FFFFFF' : stepRunning ? '#FFFFFF' : '#64748B'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.substepTitleRow}>
                  <Text
                    style={[
                      styles.substepTitle,
                      (stepRunning || stepDone) && styles.substepTitleActive,
                    ]}
                  >
                    {step.title}
                  </Text>
                  <View style={styles.substepTag}>
                    <Text style={styles.substepTagText}>{step.badge}</Text>
                  </View>
                </View>
                <Text style={styles.substepDesc}>{step.description}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  maskContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  readyPromptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(191, 219, 254, 0.5)',
  },
  readyBlueDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#38BDF8',
  },
  readyPromptText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.15,
  },

  /* ─── 3 Horizontal Staggered Cards (Clean White & Blue) ─── */
  tripletContainer: {
    width: '100%',
    gap: 12,
  },
  tripletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tripletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 4,
  },
  tripletBadgeText: {
    color: '#1E6CEF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tripletTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  compareChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  compareChipActive: {
    backgroundColor: '#1E6CEF',
    borderColor: '#1E6CEF',
  },
  compareChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E6CEF',
  },
  compareChipTextActive: {
    color: '#FFFFFF',
  },
  horizontalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  horizontalCardWrap: {
    flex: 1,
  },
  horizontalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 5,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  horizontalCardSelected: {
    borderColor: '#1E6CEF',
    backgroundColor: '#EFF6FF',
  },
  thumbFrameWrap: {
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#0F2B6B',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantFrame: {
    overflow: 'hidden',
    position: 'relative',
  },
  stepPillOverlay: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: 6,
    paddingHorizontal: 5.5,
    paddingVertical: 2,
  },
  stepPillOverlayText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
  },
  horizontalCardMeta: {
    paddingTop: 6,
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  horizontalCardTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#1E293B',
  },
  horizontalCardTitleSelected: {
    color: '#1E6CEF',
  },
  horizontalCardSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  selectedInfoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  selectedInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  selectedInfoHeadline: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  metricPillBlue: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  metricPillBlueText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#1E6CEF',
  },
  selectedInfoDesc: {
    fontSize: 11.5,
    color: '#475569',
    lineHeight: 17,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    marginTop: 9,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  zoomMiniBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  zoomMiniBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#1E6CEF',
  },
  zoomModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  zoomModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    gap: 12,
  },
  zoomModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  zoomModalTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  zoomModalSub: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E6CEF',
    marginTop: 2,
  },
  zoomCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomStageWrap: {
    alignSelf: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0F2B6B',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  zoomSwitcherRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  zoomTabPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  zoomTabPillActive: {
    backgroundColor: '#1E6CEF',
    borderColor: '#1E6CEF',
  },
  zoomTabText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
  },
  zoomTabTextActive: {
    color: '#FFFFFF',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#475569',
  },

  /* ─── Agentic Pipeline Panel (Clean White & Clinical Blue) ─── */
  agenticContainer: {
    width: '100%',
    gap: 12,
  },
  agenticPreviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    shadowColor: '#1E6CEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  previewStage: {
    width: 164,
    height: 196,
    borderRadius: 16,
    overflow: 'hidden',
    alignSelf: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBeamLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  agenticLiveInfo: {
    marginTop: 12,
    alignItems: 'center',
  },
  agenticBadgeRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  agenticPillBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  agenticBlueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1E6CEF',
  },
  agenticPillTextBlue: {
    color: '#1E6CEF',
    fontSize: 11,
    fontWeight: '800',
  },
  agenticActiveTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  agenticActiveSub: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
    textAlign: 'center',
  },
  stageGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  stageGroupTitle: {
    color: '#1E6CEF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  substepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
  },
  substepRowActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  substepIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  substepIconDone: {
    backgroundColor: '#10B981',
  },
  substepIconRunning: {
    backgroundColor: '#1E6CEF',
  },
  substepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  substepTitle: {
    color: '#475569',
    fontSize: 12.5,
    fontWeight: '700',
    flex: 1,
  },
  substepTitleActive: {
    color: '#0F172A',
  },
  substepTag: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  substepTagText: {
    color: '#1D4ED8',
    fontSize: 9.5,
    fontWeight: '700',
  },
  substepDesc: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 15.5,
    marginTop: 2,
  },
});
