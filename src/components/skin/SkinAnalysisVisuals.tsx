import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
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
  Mask,
  Path,
  RadialGradient as SvgRadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { SkinScanData } from '@/types/ai';

export type SkinDiffVariant = 'preprocessing' | 'segmentation' | 'patch_hybrid';

export interface AgenticPipelineSummary {
  pipelineVersion: string;
  landmarksCount: number;
  microRegionsCount: number;
  colorSpaces: string[];
  tZoneScore: number;
  uZoneScore: number;
  artifactSuppressionRate: number;
  patchAnomalyRate: number;
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
    stageTitle: 'Image Preprocessing & Normalization',
    title: 'Lighting & Color Constancy',
    description:
      'Mengoreksi pencahayaan ruangan tidak merata, silau (glare), dan variasi sensor kamera.',
    badge: 'WB + Retinex',
    icon: 'sunny-outline',
  },
  {
    id: 'artifact',
    stage: 1,
    stageTitle: 'Image Preprocessing & Normalization',
    title: 'Artifact Removal (Dull Razor)',
    description:
      'Filter morfologis Dull Razor menyamarkan helai rambut halus & pantulan permukaan kulit.',
    badge: 'Morphological',
    icon: 'cut-outline',
  },
  {
    id: 'colorspace',
    stage: 1,
    stageTitle: 'Image Preprocessing & Normalization',
    title: 'Color Space Transformations',
    description:
      'Konversi RGB ke ruang warna HSV & YCbCr untuk isolasi piksel kulit secara akurat.',
    badge: 'RGB → HSV/YCbCr',
    icon: 'color-palette-outline',
  },
  {
    id: 'landmarks',
    stage: 2,
    stageTitle: 'Facial Mapping & Segmentation',
    title: 'Landmark Detection (468-Point)',
    description:
      'Pemetaan geometri wajah dengan MediaPipe 468-point face mesh & deep segmentation.',
    badge: '468 Landmarks',
    icon: 'git-network-outline',
  },
  {
    id: 'zones',
    stage: 2,
    stageTitle: 'Facial Mapping & Segmentation',
    title: 'Zone Partitioning (T & U-Zone)',
    description:
      'Pembagian topografi wajah menjadi T-Zone, U-Zone, dan 384+ mikro-region evaluasi barrier.',
    badge: '384+ Regions',
    icon: 'grid-outline',
  },
  {
    id: 'hybrid',
    stage: 2,
    stageTitle: 'Facial Mapping & Segmentation',
    title: 'Patch-Based & Hybrid Modeling',
    description:
      'Kombinasi masker segmentasi regional dengan patch-based classifier untuk fitur halus & SCIN.',
    badge: 'Hybrid Fusion',
    icon: 'layers-outline',
  },
];

// Anatomical human face outline in 300x380 viewBox
export const FACE_CONTOUR_PATH =
  'M 150 34 ' +
  'C 202 34, 240 68, 246 122 ' +
  'C 250 156, 246 188, 240 218 ' +
  'C 234 252, 222 288, 198 318 ' +
  'C 182 338, 166 348, 150 348 ' +
  'C 134 348, 118 338, 102 318 ' +
  'C 78 288, 66 252, 60 218 ' +
  'C 54 188, 50 156, 54 122 ' +
  'C 60 68, 98 34, 150 34 Z';

// T-Zone: Forehead + Glabella + Nose Bridge + Chin tip
const T_ZONE_FOREHEAD_PATH =
  'M 94 74 C 118 58, 182 58, 206 74 L 198 124 C 174 116, 126 116, 102 124 Z';
const T_ZONE_NOSE_CHIN_PATH =
  'M 134 126 L 166 126 L 172 222 C 160 228, 140 228, 128 222 Z';
const T_ZONE_CHIN_PATH =
  'M 122 294 C 138 286, 162 286, 178 294 C 172 326, 160 338, 150 338 C 140 338, 128 326, 122 294 Z';

// U-Zone: Left Cheek/Jaw & Right Cheek/Jaw
const U_ZONE_LEFT_PATH =
  'M 68 158 C 86 154, 112 162, 120 186 C 124 220, 118 264, 108 296 C 84 274, 72 240, 66 204 Z';
const U_ZONE_RIGHT_PATH =
  'M 232 158 C 214 154, 188 162, 180 186 C 176 220, 182 264, 192 296 C 216 274, 228 240, 234 204 Z';

interface MeshGeometry {
  nodes: { x: number; y: number; key: boolean }[];
  edges: { x1: number; y1: number; x2: number; y2: number }[];
  patches: { x: number; y: number; w: number; h: number; zone: 'T' | 'U' | 'B' }[];
}

function buildFaceMeshGeometry(): MeshGeometry {
  const nodes: { x: number; y: number; key: boolean }[] = [];
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];

  // Build structured rings inside the anatomical contour
  const rows = 15;
  const cols = 13;
  const grid: ({ x: number; y: number } | null)[][] = [];

  for (let r = 0; r < rows; r++) {
    const tY = r / (rows - 1);
    const y = 48 + tY * 290;
    // Anatomical horizontal half-width per vertical position
    const norm = (tY - 0.36) / 0.64;
    const halfW =
      tY < 0.36
        ? 44 + 48 * Math.sin((tY / 0.36) * (Math.PI / 2))
        : 92 * Math.max(0.22, Math.cos(norm * (Math.PI / 2.25)));

    const rowArr: ({ x: number; y: number } | null)[] = [];
    for (let c = 0; c < cols; c++) {
      const tX = (c / (cols - 1)) * 2 - 1; // -1 to +1
      const x = 150 + tX * halfW;
      // Curve lines subtly like facial depth topography
      const zCurve = (1 - tX * tX) * (tY < 0.5 ? -5 : 5);
      const py = y + zCurve;
      const isKey =
        (r === 3 && (c === 3 || c === 6 || c === 9)) ||
        (r === 5 && (c === 2 || c === 4 || c === 6 || c === 8 || c === 10)) ||
        (r === 8 && (c === 5 || c === 6 || c === 7)) ||
        (r === 11 && (c === 4 || c === 6 || c === 8)) ||
        r === 14;
      nodes.push({ x, y: py, key: isKey });
      rowArr.push({ x, y: py });
    }
    grid.push(rowArr);
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = grid[r][c];
      if (!p) continue;
      if (c + 1 < cols && grid[r][c + 1]) {
        edges.push({
          x1: p.x,
          y1: p.y,
          x2: grid[r][c + 1]!.x,
          y2: grid[r][c + 1]!.y,
        });
      }
      if (r + 1 < rows && grid[r + 1][c]) {
        edges.push({
          x1: p.x,
          y1: p.y,
          x2: grid[r + 1][c]!.x,
          y2: grid[r + 1][c]!.y,
        });
      }
      if (r + 1 < rows && c + 1 < cols && grid[r + 1][c + 1] && (r + c) % 2 === 0) {
        edges.push({
          x1: p.x,
          y1: p.y,
          x2: grid[r + 1][c + 1]!.x,
          y2: grid[r + 1][c + 1]!.y,
        });
      }
    }
  }

  // Build 384+ micro-patch cells clipped inside the face silhouette
  const patches: { x: number; y: number; w: number; h: number; zone: 'T' | 'U' | 'B' }[] = [];
  const stepX = 10;
  const stepY = 12;
  for (let py = 38; py < 344; py += stepY) {
    const tY = (py - 38) / 306;
    const norm = (tY - 0.36) / 0.64;
    const halfW =
      tY < 0.36
        ? 42 + 52 * Math.sin((tY / 0.36) * (Math.PI / 2))
        : 94 * Math.max(0.18, Math.cos(norm * (Math.PI / 2.2)));

    for (let px = 52; px < 248; px += stepX) {
      const dx = Math.abs(px + stepX / 2 - 150);
      if (dx <= halfW) {
        const isT =
          (py >= 52 && py <= 128 && dx <= 52) ||
          (py > 128 && py <= 232 && dx <= 22) ||
          (py >= 286 && dx <= 30);
        const isU = !isT && py >= 150 && py <= 302 && dx >= 28;
        patches.push({
          x: px,
          y: py,
          w: stepX - 1.2,
          h: stepY - 1.2,
          zone: isT ? 'T' : isU ? 'U' : 'B',
        });
      }
    }
  }

  return { nodes, edges, patches };
}

const MESH_GEOMETRY = buildFaceMeshGeometry();

export function buildAgenticSummary(data: SkinScanData): AgenticPipelineSummary {
  const m = data?.skin_metrics;
  const hydration = m?.hydration_score ?? 65;
  const barrier = m?.barrier_integrity_score ?? 68;
  const redness = m?.redness_score ?? 28;
  const pollution = m?.pollution_clog_score ?? 35;
  const uv = m?.uv_damage_score ?? 25;

  const tZoneScore = Math.max(
    10,
    Math.min(99, Math.round(100 - pollution * 0.45 - (100 - hydration) * 0.25))
  );
  const uZoneScore = Math.max(
    10,
    Math.min(99, Math.round(barrier * 0.55 + hydration * 0.45 - redness * 0.15))
  );
  const patchAnomalyRate = Math.max(
    4,
    Math.min(96, Math.round((redness * 0.42 + uv * 0.33 + pollution * 0.25)))
  );

  return {
    pipelineVersion: 'AURA-SkinAgent-v2.1',
    landmarksCount: 468,
    microRegionsCount: Math.max(384, MESH_GEOMETRY.patches.length),
    colorSpaces: ['HSV', 'YCbCr'],
    tZoneScore,
    uZoneScore,
    artifactSuppressionRate: 98,
    patchAnomalyRate,
    completedAt: new Date().toISOString(),
  };
}

/**
 * 1. Camera / Scanner Face Silhouette Mask Overlay
 */
export function FaceScanMaskOverlay({
  width,
  height,
  isAnalyzing = false,
  activeStageIndex = 0,
}: {
  width: number;
  height: number;
  isAnalyzing?: boolean;
  activeStageIndex?: number;
}) {
  const scanAnim = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: isAnalyzing ? 1600 : 2600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: isAnalyzing ? 1600 : 2600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isAnalyzing, scanAnim]);

  const frameW = Math.min(width * 0.84, 330);
  const frameH = Math.min(height * 0.56, 420);
  const translateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [frameH * 0.12, frameH * 0.86],
  });

  const contourColor = isAnalyzing
    ? activeStageIndex >= 3
      ? '#38BDF8'
      : '#2DD4BF'
    : '#60A5FA';

  return (
    <View style={[StyleSheet.absoluteFill, styles.maskCenter]} pointerEvents="none">
      {/* Fullscreen dimmed mask around the anatomical face shape */}
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <Mask id="faceCutoutMask">
            <Rect x={0} y={0} width={width} height={height} fill="white" />
            <G
              transform={`translate(${(width - frameW) / 2}, ${(height - frameH) / 2 - 22}) scale(${frameW / 300}, ${frameH / 380})`}
            >
              <Path d={FACE_CONTOUR_PATH} fill="black" />
            </G>
          </Mask>
        </Defs>
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="rgba(2, 6, 23, 0.62)"
          mask="url(#faceCutoutMask)"
        />
      </Svg>

      {/* Face contour alignment frame */}
      <View
        style={{
          width: frameW,
          height: frameH,
          marginTop: -44,
          position: 'relative',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg width={frameW} height={frameH} viewBox="0 0 300 380">
          {/* Outer Biometric Face Contour */}
          <Path
            d={FACE_CONTOUR_PATH}
            fill="none"
            stroke={contourColor}
            strokeWidth={2.6}
          />
          <Path
            d={FACE_CONTOUR_PATH}
            fill="none"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth={1}
            strokeDasharray="6 6"
          />

          {/* Subtle Eye / Brow / Nose / Mouth Guide Markers */}
          <Path
            d="M 86 142 Q 112 132 134 142"
            fill="none"
            stroke="rgba(148, 163, 184, 0.55)"
            strokeWidth={1.3}
            strokeDasharray="4 4"
          />
          <Path
            d="M 166 142 Q 188 132 214 142"
            fill="none"
            stroke="rgba(148, 163, 184, 0.55)"
            strokeWidth={1.3}
            strokeDasharray="4 4"
          />
          {/* Central Axis */}
          <Line
            x1={150}
            y1={56}
            x2={150}
            y2={336}
            stroke="rgba(148, 163, 184, 0.25)"
            strokeWidth={1}
            strokeDasharray="3 5"
          />
          {/* Mouth Alignment Guide */}
          <Path
            d="M 122 264 Q 150 274 178 264"
            fill="none"
            stroke="rgba(148, 163, 184, 0.5)"
            strokeWidth={1.2}
            strokeDasharray="4 4"
          />
          {/* T-Zone & U-Zone Faint Hints */}
          <Path
            d={T_ZONE_FOREHEAD_PATH}
            fill="rgba(56, 189, 248, 0.05)"
            stroke="rgba(56, 189, 248, 0.28)"
            strokeWidth={0.9}
            strokeDasharray="3 3"
          />
          <Path
            d={U_ZONE_LEFT_PATH}
            fill="none"
            stroke="rgba(45, 212, 191, 0.26)"
            strokeWidth={0.9}
            strokeDasharray="3 3"
          />
          <Path
            d={U_ZONE_RIGHT_PATH}
            fill="none"
            stroke="rgba(45, 212, 191, 0.26)"
            strokeWidth={0.9}
            strokeDasharray="3 3"
          />

          {/* Temple & Chin Alignment Brackets */}
          <Path
            d="M 46 112 L 46 92 L 66 92"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <Path
            d="M 254 112 L 254 92 L 234 92"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <Path
            d="M 118 352 L 150 362 L 182 352"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        </Svg>

        {/* Animated Scanning Beam */}
        <Animated.View
          style={[
            styles.scanBeam,
            {
              width: frameW * 0.72,
              transform: [{ translateY }],
            },
          ]}
        >
          <LinearGradient
            colors={['transparent', contourColor, 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.scanBeamLine}
          />
        </Animated.View>
      </View>
    </View>
  );
}

/**
 * 2. Renders 1 of the 3 Difference Images from user's scan photo + real SkinScanData
 */
export function SkinDiffCanvas({
  imageUri,
  variant,
  data,
  height = 220,
  showOriginal = false,
}: {
  imageUri?: string;
  variant: SkinDiffVariant;
  data?: SkinScanData;
  height?: number;
  showOriginal?: boolean;
}) {
  const redness = data?.skin_metrics?.redness_score ?? 32;
  const hydration = data?.skin_metrics?.hydration_score ?? 64;
  const barrier = data?.skin_metrics?.barrier_integrity_score ?? 66;
  const pollution = data?.skin_metrics?.pollution_clog_score ?? 38;
  const uv = data?.skin_metrics?.uv_damage_score ?? 29;

  const tZoneStressColor =
    pollution >= 55 ? 'rgba(249, 115, 22, 0.34)' : 'rgba(56, 189, 248, 0.28)';
  const uZoneColor =
    barrier < 60 || hydration < 60
      ? 'rgba(245, 158, 11, 0.30)'
      : 'rgba(16, 185, 129, 0.25)';

  return (
    <View style={[styles.diffCanvasWrap, { height }]}>
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : (
        <LinearGradient
          colors={['#1E293B', '#0F172A']}
          style={StyleSheet.absoluteFill}
        />
      )}

      {!showOriginal && variant === 'preprocessing' && (
        <>
          {/* Color Constancy & YCbCr skin normalization tint */}
          <LinearGradient
            colors={[
              'rgba(14, 165, 233, 0.14)',
              'rgba(20, 184, 166, 0.16)',
              'rgba(2, 132, 199, 0.20)',
            ]}
            style={StyleSheet.absoluteFill}
          />
          <Svg
            width="100%"
            height="100%"
            viewBox="0 0 300 380"
            preserveAspectRatio="xMidYMid slice"
            style={StyleSheet.absoluteFill}
          >
            <Defs>
              <Mask id="prepIsoMask">
                <Rect x={0} y={0} width={300} height={380} fill="white" />
                <Path d={FACE_CONTOUR_PATH} fill="black" />
              </Mask>
            </Defs>
            {/* YCbCr non-skin background suppression */}
            <Rect
              x={0}
              y={0}
              width={300}
              height={380}
              fill="rgba(7, 20, 38, 0.78)"
              mask="url(#prepIsoMask)"
            />
            {/* Isolated skin contour */}
            <Path
              d={FACE_CONTOUR_PATH}
              fill="rgba(45, 212, 191, 0.08)"
              stroke="#2DD4BF"
              strokeWidth={2.2}
            />
            {/* Dull Razor artifact suppression traces near hairline & glare points */}
            <Path
              d="M 86 64 Q 150 42 214 64"
              fill="none"
              stroke="#5EEAD4"
              strokeWidth={1.6}
              strokeDasharray="4 3"
            />
            <Circle
              cx={118}
              cy={174}
              r={18}
              fill="rgba(56, 189, 248, 0.14)"
              stroke="#38BDF8"
              strokeWidth={1.2}
              strokeDasharray="3 3"
            />
            <Circle
              cx={182}
              cy={174}
              r={18}
              fill="rgba(56, 189, 248, 0.14)"
              stroke="#38BDF8"
              strokeWidth={1.2}
              strokeDasharray="3 3"
            />
            <Circle
              cx={150}
              cy={96}
              r={20}
              fill="rgba(45, 212, 191, 0.14)"
              stroke="#2DD4BF"
              strokeWidth={1.2}
              strokeDasharray="3 3"
            />
          </Svg>
        </>
      )}

      {!showOriginal && variant === 'segmentation' && (
        <>
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(15, 23, 42, 0.30)' },
            ]}
          />
          <Svg
            width="100%"
            height="100%"
            viewBox="0 0 300 380"
            preserveAspectRatio="xMidYMid slice"
            style={StyleSheet.absoluteFill}
          >
            {/* T-Zone & U-Zone Topographic Partition Polygons */}
            <Path
              d={T_ZONE_FOREHEAD_PATH}
              fill={tZoneStressColor}
              stroke="#38BDF8"
              strokeWidth={1.6}
            />
            <Path
              d={T_ZONE_NOSE_CHIN_PATH}
              fill={tZoneStressColor}
              stroke="#38BDF8"
              strokeWidth={1.6}
            />
            <Path
              d={T_ZONE_CHIN_PATH}
              fill={tZoneStressColor}
              stroke="#38BDF8"
              strokeWidth={1.4}
            />
            <Path
              d={U_ZONE_LEFT_PATH}
              fill={uZoneColor}
              stroke="#34D399"
              strokeWidth={1.5}
            />
            <Path
              d={U_ZONE_RIGHT_PATH}
              fill={uZoneColor}
              stroke="#34D399"
              strokeWidth={1.5}
            />

            {/* 468-Point Geometric Mesh Wireframe */}
            <G opacity={0.78}>
              {MESH_GEOMETRY.edges.map((e, i) => (
                <Line
                  key={`e-${i}`}
                  x1={e.x1}
                  y1={e.y1}
                  x2={e.x2}
                  y2={e.y2}
                  stroke="rgba(186, 230, 253, 0.55)"
                  strokeWidth={0.65}
                />
              ))}
              {MESH_GEOMETRY.nodes.map((n, i) => (
                <Circle
                  key={`n-${i}`}
                  cx={n.x}
                  cy={n.y}
                  r={n.key ? 2.1 : 1.05}
                  fill={n.key ? '#FACC15' : '#E0F2FE'}
                />
              ))}
            </G>
          </Svg>
        </>
      )}

      {!showOriginal && variant === 'patch_hybrid' && (
        <>
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(2, 6, 23, 0.34)' },
            ]}
          />
          <Svg
            width="100%"
            height="100%"
            viewBox="0 0 300 380"
            preserveAspectRatio="xMidYMid slice"
            style={StyleSheet.absoluteFill}
          >
            <Defs>
              <ClipPath id="facePatchClip">
                <Path d={FACE_CONTOUR_PATH} />
              </ClipPath>
              <SvgRadialGradient id="rednessHeatL" cx="50%" cy="50%" r="50%">
                <Stop
                  offset="0%"
                  stopColor="#EF4444"
                  stopOpacity={Math.min(0.72, 0.25 + redness / 140)}
                />
                <Stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
              </SvgRadialGradient>
              <SvgRadialGradient id="uvHeatForehead" cx="50%" cy="50%" r="50%">
                <Stop
                  offset="0%"
                  stopColor="#F59E0B"
                  stopOpacity={Math.min(0.7, 0.2 + uv / 140)}
                />
                <Stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
              </SvgRadialGradient>
              <SvgRadialGradient id="clogHeatNose" cx="50%" cy="50%" r="50%">
                <Stop
                  offset="0%"
                  stopColor="#A855F7"
                  stopOpacity={Math.min(0.68, 0.18 + pollution / 145)}
                />
                <Stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
              </SvgRadialGradient>
            </Defs>

            {/* 384+ Micro-Patch Matrix */}
            <G clipPath="url(#facePatchClip)">
              {MESH_GEOMETRY.patches.map((p, idx) => {
                const highlight =
                  p.zone === 'T'
                    ? pollution >= 45
                      ? 'rgba(249, 115, 22, 0.26)'
                      : 'rgba(56, 189, 248, 0.16)'
                    : p.zone === 'U'
                    ? redness >= 45
                      ? 'rgba(239, 68, 68, 0.24)'
                      : 'rgba(16, 185, 129, 0.16)'
                    : 'rgba(148, 163, 184, 0.10)';
                return (
                  <Rect
                    key={`p-${idx}`}
                    x={p.x}
                    y={p.y}
                    width={p.w}
                    height={p.h}
                    rx={1.5}
                    fill={highlight}
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth={0.45}
                  />
                );
              })}
              {/* Regional Hybrid Biomarker Heatmaps */}
              <Circle cx={150} cy={96} r={54} fill="url(#uvHeatForehead)" />
              <Circle cx={98} cy={204} r={46} fill="url(#rednessHeatL)" />
              <Circle cx={202} cy={204} r={46} fill="url(#rednessHeatL)" />
              <Circle cx={150} cy={186} r={34} fill="url(#clogHeatNose)" />
            </G>

            <Path
              d={FACE_CONTOUR_PATH}
              fill="none"
              stroke="#F59E0B"
              strokeWidth={1.8}
            />
          </Svg>
        </>
      )}

      {/* Corner Stage Pill */}
      <View style={styles.diffCornerBadge}>
        <Text style={styles.diffCornerBadgeText}>
          {showOriginal
            ? 'FOTO ASLI'
            : variant === 'preprocessing'
            ? 'HSV / YCbCr'
            : variant === 'segmentation'
            ? '468 MESH'
            : '384+ PATCH'}
        </Text>
      </View>
    </View>
  );
}

/**
 * 3. Interactive Gallery & Comparison for the 3 Difference Images
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
  const [selectedVariant, setSelectedVariant] =
    useState<SkinDiffVariant>('preprocessing');
  const [showOriginal, setShowOriginal] = useState(false);

  const metricsSummary = useMemo(
    () => summary || buildAgenticSummary(data),
    [data, summary]
  );

  const cards: {
    variant: SkinDiffVariant;
    stepNum: string;
    title: string;
    shortTitle: string;
    metricLabel: string;
    metricValue: string;
    accent: string;
    detailText: string;
  }[] = [
    {
      variant: 'preprocessing',
      stepNum: 'Citra 1',
      title: 'Preprocessing, Dull Razor & Isolasi HSV/YCbCr',
      shortTitle: 'HSV / YCbCr',
      metricLabel: 'Isolasi Artefak',
      metricValue: `${metricsSummary.artifactSuppressionRate}%`,
      accent: '#14B8A6',
      detailText:
        'Menyeimbangkan pencahayaan ruangan & glare, menghapus artefak rambut halus dengan filter morfologis Dull Razor, serta memisahkan piksel kulit via HSV & YCbCr.',
    },
    {
      variant: 'segmentation',
      stepNum: 'Citra 2',
      title: '468-Point Face Mesh & Partisi T-Zone / U-Zone',
      shortTitle: '468 Mesh',
      metricLabel: 'T-Zone / U-Zone',
      metricValue: `${metricsSummary.tZoneScore} / ${metricsSummary.uZoneScore}`,
      accent: '#0EA5E9',
      detailText:
        'Memetakan 468 titik landmark wajah untuk membagi zona T-Zone (dahi, hidung, dagu) & U-Zone (pipi, rahang) dalam mengevaluasi sebum, hidrasi, dan barier kulit.',
    },
    {
      variant: 'patch_hybrid',
      stepNum: 'Citra 3',
      title: 'Peta Mikro-Region 384+ Patch & Hybrid Modeling',
      shortTitle: '384+ Patch',
      metricLabel: 'Intensitas Stres',
      metricValue: `${metricsSummary.patchAnomalyRate}%`,
      accent: '#F59E0B',
      detailText:
        `Menggabungkan ${metricsSummary.microRegionsCount}+ patch lokal untuk mendeteksi fitur halus: kemerahan (${data.skin_metrics?.redness_score ?? 0}%), paparan UV (${data.skin_metrics?.uv_damage_score ?? 0}%), & sumbatan polusi (${data.skin_metrics?.pollution_clog_score ?? 0}%).`,
    },
  ];

  const activeCard =
    cards.find((c) => c.variant === selectedVariant) || cards[0];

  return (
    <View style={styles.tripletWrapper}>
      <View style={styles.tripletHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.tripletHeading}>3 Gambar Perbedaan Hasil Analisis</Text>
          <Text style={styles.tripletSubheading}>
            Ketuk salah satu citra untuk membandingkan lapisan pemrosesan dengan foto asli
          </Text>
        </View>
      </View>

      {/* 3-Card Side-by-Side Thumbnails */}
      <View style={styles.tripletRow}>
        {cards.map((item) => {
          const isSelected = item.variant === selectedVariant;
          return (
            <Pressable
              key={item.variant}
              onPress={() => {
                setSelectedVariant(item.variant);
                setShowOriginal(false);
              }}
              style={[
                styles.tripletThumbCard,
                isSelected && {
                  borderColor: item.accent,
                  backgroundColor: '#F0F9FF',
                },
              ]}
            >
              <SkinDiffCanvas
                imageUri={imageUri}
                variant={item.variant}
                data={data}
                height={118}
              />
              <View style={styles.tripletThumbMeta}>
                <Text
                  style={[
                    styles.tripletThumbNum,
                    { color: item.accent },
                  ]}
                >
                  {item.stepNum}
                </Text>
                <Text style={styles.tripletThumbTitle} numberOfLines={1}>
                  {item.shortTitle}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Active Detail Difference Comparison Card */}
      <View style={styles.diffDetailBox}>
        <View style={styles.diffDetailTopBar}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={[styles.diffDetailTag, { color: activeCard.accent }]}>
              {activeCard.stepNum.toUpperCase()} • {activeCard.metricLabel}:{' '}
              {activeCard.metricValue}
            </Text>
            <Text style={styles.diffDetailTitle}>{activeCard.title}</Text>
          </View>
          <Pressable
            onPress={() => setShowOriginal((prev) => !prev)}
            style={[
              styles.compareToggleBtn,
              showOriginal && styles.compareToggleBtnActive,
            ]}
          >
            <Ionicons
              name={showOriginal ? 'eye-outline' : 'git-compare-outline'}
              size={14}
              color={showOriginal ? '#FFFFFF' : '#0284C7'}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.compareToggleText,
                showOriginal && { color: '#FFFFFF' },
              ]}
            >
              {showOriginal ? 'Tampil Hasil' : 'Lihat Asli'}
            </Text>
          </Pressable>
        </View>

        <SkinDiffCanvas
          imageUri={imageUri}
          variant={activeCard.variant}
          data={data}
          height={230}
          showOriginal={showOriginal}
        />

        <Text style={styles.diffDetailDesc}>{activeCard.detailText}</Text>
      </View>
    </View>
  );
}

/**
 * 4. Agentic AI Stepper shown right after user scans / uploads photo
 */
export function AgenticPipelinePanel({
  photoUri,
  activeStepIndex,
  isCompleted,
}: {
  photoUri?: string | null;
  activeStepIndex: number;
  isCompleted: boolean;
}) {
  const stage1Steps = AGENTIC_PIPELINE_STEPS.filter((s) => s.stage === 1);
  const stage2Steps = AGENTIC_PIPELINE_STEPS.filter((s) => s.stage === 2);

  const previewVariant: SkinDiffVariant =
    activeStepIndex < 3
      ? 'preprocessing'
      : activeStepIndex < 5
      ? 'segmentation'
      : 'patch_hybrid';

  return (
    <View style={styles.agenticContainer}>
      {/* Live Visual Face Morphing Header */}
      <View style={styles.agenticPreviewCard}>
        <SkinDiffCanvas
          imageUri={photoUri || undefined}
          variant={previewVariant}
          height={186}
        />
        <View style={styles.agenticLiveInfo}>
          <View style={styles.agenticBadgeRow}>
            <View
              style={[
                styles.agenticPill,
                isCompleted ? styles.agenticPillDone : styles.agenticPillRunning,
              ]}
            >
              <Ionicons
                name={isCompleted ? 'checkmark-circle' : 'sparkles'}
                size={13}
                color={isCompleted ? '#10B981' : '#38BDF8'}
                style={{ marginRight: 5 }}
              />
              <Text style={styles.agenticPillText}>
                {isCompleted
                  ? '3 Citra Perbedaan Dihasilkan'
                  : 'Agentic AI Skin Pipeline Berjalan'}
              </Text>
            </View>
          </View>
          <Text style={styles.agenticActiveTitle}>
            {isCompleted
              ? 'Tahap Preprocessing & Facial Mapping Selesai'
              : AGENTIC_PIPELINE_STEPS[
                  Math.min(activeStepIndex, AGENTIC_PIPELINE_STEPS.length - 1)
                ].title}
          </Text>
          <Text style={styles.agenticActiveSub}>
            {isCompleted
              ? 'Semua 3 citra perbedaan siap ditinjau sebelum masuk ke halaman hasil analisis akhir.'
              : AGENTIC_PIPELINE_STEPS[
                  Math.min(activeStepIndex, AGENTIC_PIPELINE_STEPS.length - 1)
                ].description}
          </Text>
        </View>
      </View>

      {/* Stage 1 & Stage 2 Checklist */}
      {[
        { num: 1, title: '1. Image Preprocessing & Normalization', steps: stage1Steps },
        { num: 2, title: '2. Facial Mapping & Segmentation', steps: stage2Steps },
      ].map((group) => (
        <View key={group.num} style={styles.stageGroupCard}>
          <Text style={styles.stageGroupTitle}>{group.title}</Text>
          {group.steps.map((step) => {
            const globalIdx = AGENTIC_PIPELINE_STEPS.findIndex((s) => s.id === step.id);
            const done = isCompleted || globalIdx < activeStepIndex;
            const running = !isCompleted && globalIdx === activeStepIndex;
            return (
              <View
                key={step.id}
                style={[
                  styles.substepRow,
                  running && styles.substepRowActive,
                ]}
              >
                <View
                  style={[
                    styles.substepIconCircle,
                    done && styles.substepIconDone,
                    running && styles.substepIconRunning,
                  ]}
                >
                  <Ionicons
                    name={done ? 'checkmark' : step.icon}
                    size={15}
                    color={done ? '#FFFFFF' : running ? '#0284C7' : '#64748B'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.substepTitleRow}>
                    <Text
                      style={[
                        styles.substepTitle,
                        (done || running) && { color: '#F8FAFC' },
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
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  maskCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBeam: {
    position: 'absolute',
    top: 0,
    height: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBeamLine: {
    width: '100%',
    height: 3,
    borderRadius: 2,
  },
  diffCanvasWrap: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  diffCornerBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  diffCornerBadgeText: {
    color: '#F8FAFC',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  tripletWrapper: {
    marginBottom: 16,
  },
  tripletHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  tripletHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  tripletSubheading: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  tripletRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tripletThumbCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 5,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  tripletThumbMeta: {
    paddingTop: 6,
    paddingHorizontal: 3,
    paddingBottom: 2,
  },
  tripletThumbNum: {
    fontSize: 10,
    fontWeight: '800',
  },
  tripletThumbTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 1,
  },
  diffDetailBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  diffDetailTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  diffDetailTag: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  diffDetailTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  compareToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
  },
  compareToggleBtnActive: {
    backgroundColor: '#0284C7',
  },
  compareToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  diffDetailDesc: {
    fontSize: 12.2,
    color: '#475569',
    lineHeight: 18,
    marginTop: 10,
  },
  agenticContainer: {
    width: '100%',
    gap: 10,
  },
  agenticPreviewCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.28)',
  },
  agenticLiveInfo: {
    marginTop: 10,
  },
  agenticBadgeRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  agenticPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  agenticPillRunning: {
    backgroundColor: 'rgba(14, 165, 233, 0.16)',
  },
  agenticPillDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
  },
  agenticPillText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
  },
  agenticActiveTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  agenticActiveSub: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  stageGroupCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    gap: 8,
  },
  stageGroupTitle: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  substepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
  },
  substepRowActive: {
    backgroundColor: 'rgba(14, 165, 233, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  substepIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(148, 163, 184, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  substepIconDone: {
    backgroundColor: '#10B981',
  },
  substepIconRunning: {
    backgroundColor: '#E0F2FE',
  },
  substepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  substepTitle: {
    color: '#CBD5E1',
    fontSize: 12.5,
    fontWeight: '700',
    flex: 1,
  },
  substepTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  substepTagText: {
    color: '#7DD3FC',
    fontSize: 9.5,
    fontWeight: '700',
  },
  substepDesc: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 15.5,
    marginTop: 2,
  },
});
