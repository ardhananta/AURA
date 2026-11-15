import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

export interface LiveFaceStatus {
  detected: boolean;
  centered: boolean;
  forward: boolean;
}

export interface LiveFaceTrackerHandle {
  capture: () => void;
}

interface LiveFaceTrackerCameraProps {
  facing: 'front' | 'back';
  flash: 'off' | 'on';
  active: boolean;
  onReadyChange?: (ready: boolean) => void;
  onFaceStatusChange?: (status: LiveFaceStatus) => void;
  onCaptured?: (dataUrl: string) => void;
  onFallbackRequired?: () => void;
}

const TRACKER_HTML = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%; height: 100%; overflow: hidden; background: #020617;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    #stage { position: relative; width: 100vw; height: 100vh; overflow: hidden; }
    video, canvas {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none;
    }
    video { object-fit: cover; }
    video.mirrored { transform: scaleX(-1); }
  </style>
</head>
<body>
  <div id="stage">
    <video id="cam" autoplay playsinline muted></video>
    <canvas id="mesh"></canvas>
  </div>

  <script>
    (function () {
      const video = document.getElementById('cam');
      const canvas = document.getElementById('mesh');
      const ctx = canvas.getContext('2d');
      const analyzeCanvas = document.createElement('canvas');
      const analyzeCtx = analyzeCanvas.getContext('2d', { willReadFrequently: true });
      const AW = 88, AH = 116;
      analyzeCanvas.width = AW;
      analyzeCanvas.height = AH;

      let currentStream = null;
      let currentFacing = 'user';
      let currentFlash = false;
      let mpFaceMesh = null;
      let mpBusy = false;
      let mpLandmarks = null;
      let mpLastTs = 0;

      // Smooth fallback CV tracked face state [0..1] in display coordinates
      let cvState = {
        detected: false,
        cx: 0.5, ey: 0.39, ipd: 0.27,
        fhY: 0.25, noseY: 0.51, mouthY: 0.62, chinY: 0.72, halfW: 0.22, tilt: 0,
        alpha: 0
      };
      let lastStatusSent = 0;

      function postRN(obj) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(obj));
        }
      }

      function applyTorch(on) {
        currentFlash = !!on;
        if (!currentStream) return;
        const track = currentStream.getVideoTracks()[0];
        if (!track || !track.applyConstraints) return;
        try {
          const caps = track.getCapabilities ? track.getCapabilities() : {};
          if (caps && caps.torch) {
            track.applyConstraints({ advanced: [{ torch: currentFlash }] }).catch(function(){});
          }
        } catch (e) {}
      }

      function stopStream() {
        if (currentStream) {
          currentStream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
          currentStream = null;
        }
      }

      async function startCamera(facingMode) {
        currentFacing = facingMode === 'environment' ? 'environment' : 'user';
        video.className = currentFacing === 'user' ? 'mirrored' : '';
        stopStream();
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          postRN({ type: 'camera_error', reason: 'getUserMedia unavailable' });
          return;
        }
        try {
          let stream;
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: { facingMode: { ideal: currentFacing }, width: { ideal: 1280 }, height: { ideal: 960 } }
            });
          } catch (innerErr) {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          }
          currentStream = stream;
          video.srcObject = stream;
          await video.play();
          applyTorch(currentFlash);
          postRN({ type: 'ready' });
        } catch (err) {
          postRN({ type: 'camera_error', reason: String(err && err.message || err) });
        }
      }

      function projectCover(nx, ny, viewW, viewH) {
        const vw = video.videoWidth || 480;
        const vh = video.videoHeight || 640;
        const scale = Math.max(viewW / vw, viewH / vh);
        const sw = vw * scale;
        const sh = vh * scale;
        const ox = (viewW - sw) * 0.5;
        const oy = (viewH - sh) * 0.5;
        return [ox + nx * sw, oy + ny * sh];
      }

      // Fast pure-JS Skin-Core + Eye-Pair tracker (~3ms/frame offline baseline)
      function runFastCvTrack() {
        if (!video.videoWidth || !video.videoHeight) return;
        analyzeCtx.save();
        if (currentFacing === 'user') {
          analyzeCtx.translate(AW, 0);
          analyzeCtx.scale(-1, 1);
        }
        analyzeCtx.drawImage(video, 0, 0, AW, AH);
        analyzeCtx.restore();

        const data = analyzeCtx.getImageData(0, 0, AW, AH).data;
        const n = AW * AH;
        const lum = new Float32Array(n);
        const skin = new Float32Array(n);

        for (let i = 0; i < n; i++) {
          const r = data[i * 4];
          const g = data[i * 4 + 1];
          const b = data[i * 4 + 2];
          const y = 0.299 * r + 0.587 * g + 0.114 * b;
          const cb = 128 - 0.1687 * r - 0.3313 * g + 0.5 * b;
          const cr = 128 + 0.5 * r - 0.4187 * g - 0.0813 * b;
          lum[i] = y;
          const dCr = (cr - 149) / 15;
          const dCb = (cb - 107) / 16;
          const warm = Math.max(0, Math.min(1, (r - b + 8) / 36));
          const lk = Math.max(0, Math.min(1, (y - 22) / 30));
          skin[i] = Math.exp(-0.5 * (dCr * dCr + dCb * dCb)) * (0.45 + 0.55 * warm) * lk;
        }

        // Compute horizontal & vertical center of skin mass first to keep search fast
        let sumW = 0, sumX = 0, sumY = 0;
        for (let y = 8; y < AH - 8; y++) {
          for (let x = 8; x < AW - 8; x++) {
            const sp = skin[y * AW + x];
            if (sp > 0.28) {
              sumW += sp;
              sumX += sp * x;
              sumY += sp * y;
            }
          }
        }

        if (sumW < 45) {
          cvState.detected = false;
          cvState.alpha = Math.max(0, cvState.alpha - 0.08);
          return;
        }

        const meanX = sumX / sumW;
        const meanY = sumY / sumW;

        // Integral images for eye-pair contrast detection around skin centroid
        const W1 = AW + 1;
        const iiLum = new Float32Array(W1 * (AH + 1));
        const iiSkin = new Float32Array(W1 * (AH + 1));
        for (let y = 1; y <= AH; y++) {
          let rowL = 0, rowS = 0;
          const base = (y - 1) * AW;
          const rCur = y * W1;
          const rPrev = (y - 1) * W1;
          for (let x = 1; x <= AW; x++) {
            rowL += lum[base + x - 1];
            rowS += skin[base + x - 1];
            iiLum[rCur + x] = iiLum[rPrev + x] + rowL;
            iiSkin[rCur + x] = iiSkin[rPrev + x] + rowS;
          }
        }
        function bMean(ii, y0, y1, x0, x1) {
          y0 = Math.max(0, Math.min(AH - 1, y0 | 0));
          y1 = Math.max(y0 + 1, Math.min(AH, y1 | 0));
          x0 = Math.max(0, Math.min(AW - 1, x0 | 0));
          x1 = Math.max(x0 + 1, Math.min(AW, x1 | 0));
          const area = (y1 - y0) * (x1 - x0);
          return (ii[y1 * W1 + x1] - ii[y0 * W1 + x1] - ii[y1 * W1 + x0] + ii[y0 * W1 + x0]) / area;
        }

        let bestScore = -1e9, bestCfg = null;
        const eyMin = Math.max(12, (meanY - AH * 0.24) | 0);
        const eyMax = Math.min(AH - 18, (meanY + AH * 0.08) | 0);
        const cxMin = Math.max(14, (meanX - AW * 0.16) | 0);
        const cxMax = Math.min(AW - 14, (meanX + AW * 0.16) | 0);

        const dList = [
          Math.max(5, (AW * 0.10) | 0),
          Math.max(6, (AW * 0.125) | 0),
          Math.max(7, (AW * 0.15) | 0),
          Math.max(8, (AW * 0.18) | 0)
        ];

        for (let di = 0; di < dList.length; di++) {
          const d = dList[di];
          const erY = Math.max(2, (d * 0.28) | 0);
          const erX = Math.max(2, (d * 0.34) | 0);
          for (let ey = eyMin; ey <= eyMax; ey += 2) {
            for (let cx = cxMin; cx <= cxMax; cx += 2) {
              if (cx - d * 1.4 < 1 || cx + d * 1.4 >= AW - 1) continue;
              const skFh = bMean(iiSkin, ey - d * 0.9, ey - d * 0.3, cx - d * 0.7, cx + d * 0.7);
              const skEl = bMean(iiSkin, ey - erY, ey + d * 0.5, cx - d - d * 0.5, cx - d + d * 0.35);
              const skEr = bMean(iiSkin, ey - erY, ey + d * 0.5, cx + d - d * 0.35, cx + d + d * 0.5);
              const skBr = bMean(iiSkin, ey - erY, ey + d * 0.5, cx - d * 0.3, cx + d * 0.3);
              if (skFh < 0.16 || skEl < 0.18 || skEr < 0.18 || skBr < 0.18) continue;

              const lumLe = bMean(iiLum, ey - erY, ey + erY, cx - d - erX, cx - d + erX);
              const lumRe = bMean(iiLum, ey - erY, ey + erY, cx + d - erX, cx + d + erX);
              if (Math.abs(lumLe - lumRe) > 42) continue;

              const lumBr = bMean(iiLum, ey - erY, ey + erY + 1, cx - d * 0.25, cx + d * 0.25);
              const lumCl = bMean(iiLum, ey + d * 0.35, ey + d * 0.95, cx - d - erX, cx - d * 0.3);
              const lumCr = bMean(iiLum, ey + d * 0.35, ey + d * 0.95, cx + d * 0.3, cx + d + erX);
              const lc = Math.min(lumCl - lumLe, lumBr - lumLe);
              const rc = Math.min(lumCr - lumRe, lumBr - lumRe);
              if (lc <= 1.0 || rc <= 1.0) continue;

              const sc = (Math.min(lc, rc) * 1.5 + 0.5 * (lc + rc) * 0.6 - Math.abs(lumLe - lumRe) * 1.1) * (0.4 + 0.6 * skFh);
              if (sc > bestScore) {
                bestScore = sc;
                bestCfg = [cx / AW, ey / AH, (2 * d) / AW];
              }
            }
          }
        }

        let tCx, tEy, tIpd;
        if (bestCfg && bestScore > 2.8) {
          tCx = bestCfg[0]; tEy = bestCfg[1] + bestCfg[2] * 0.03; tIpd = bestCfg[2];
        } else {
          // Adaptive skin centroid estimate
          tCx = meanX / AW;
          tEy = Math.max(0.20, Math.min(0.62, (meanY / AH) - 0.04));
          tIpd = Math.max(0.18, Math.min(0.36, Math.sqrt(sumW / n) * 0.56));
        }

        const smooth = 0.34;
        if (!cvState.detected) {
          cvState.cx = tCx; cvState.ey = tEy; cvState.ipd = tIpd;
        } else {
          cvState.cx += (tCx - cvState.cx) * smooth;
          cvState.ey += (tEy - cvState.ey) * smooth;
          cvState.ipd += (tIpd - cvState.ipd) * smooth;
        }
        cvState.detected = true;
        cvState.alpha = Math.min(1, cvState.alpha + 0.16);
        const effScale = cvState.ipd * (AW / AH) * 0.96;
        cvState.halfW = cvState.ipd * 0.92;
        cvState.fhY = Math.max(0.06, cvState.ey - 0.85 * effScale);
        cvState.noseY = Math.min(0.82, cvState.ey + 0.60 * effScale);
        cvState.mouthY = Math.min(0.89, cvState.ey + 1.18 * effScale);
        cvState.chinY = Math.min(0.95, cvState.ey + 1.78 * effScale);
      }

      function drawCvMesh(viewW, viewH) {
        const a = cvState.alpha;
        if (a <= 0.03) return;
        const cx = cvState.cx, ey = cvState.ey, hw = cvState.halfW;
        const fhTop = cvState.fhY, noseY = cvState.noseY, mouthY = cvState.mouthY, chinY = cvState.chinY;
        const faceH = Math.max(0.18, chinY - fhTop);

        const contourNorm = [
          [cx, fhTop],
          [cx + hw * 0.62, fhTop + faceH * 0.06],
          [cx + hw * 0.96, ey - faceH * 0.05],
          [cx + hw * 1.00, ey + faceH * 0.16],
          [cx + hw * 0.84, mouthY - faceH * 0.02],
          [cx + hw * 0.56, mouthY + faceH * 0.14],
          [cx, chinY],
          [cx - hw * 0.56, mouthY + faceH * 0.14],
          [cx - hw * 0.84, mouthY - faceH * 0.02],
          [cx - hw * 1.00, ey + faceH * 0.16],
          [cx - hw * 0.96, ey - faceH * 0.05],
          [cx - hw * 0.62, fhTop + faceH * 0.06]
        ];
        const pt = function (nx, ny) { return projectCover(nx, ny, viewW, viewH); };
        const cPts = contourNorm.map(function (p) { return pt(p[0], p[1]); });

        const fh = pt(cx, fhTop + faceH * 0.16);
        const le = pt(cx - cvState.ipd * 0.5, ey);
        const re = pt(cx + cvState.ipd * 0.5, ey);
        const glab = pt(cx, ey);
        const nb = pt(cx, (ey + noseY) * 0.5);
        const nt = pt(cx, noseY);
        const lc = pt(cx - hw * 0.62, (ey + mouthY) * 0.48);
        const rc = pt(cx + hw * 0.62, (ey + mouthY) * 0.48);
        const ll = pt(cx - hw * 0.30, mouthY);
        const rl = pt(cx + hw * 0.30, mouthY);
        const mc = pt(cx, mouthY);
        const ch = pt(cx, chinY);

        const edges = [
          [cPts[11], fh], [fh, cPts[1]], [cPts[10], le], [cPts[2], re],
          [fh, le], [fh, re], [fh, glab], [le, glab], [re, glab],
          [glab, nb], [nb, nt], [le, nb], [re, nb],
          [cPts[9], lc], [le, lc], [nb, lc], [nt, lc],
          [cPts[3], rc], [re, rc], [nb, rc], [nt, rc],
          [nt, ll], [nt, rl], [nt, mc], [lc, ll], [rc, rl],
          [cPts[8], ll], [cPts[4], rl], [ll, mc], [rl, mc],
          [ll, cPts[7]], [rl, cPts[5]], [mc, ch], [cPts[7], ch], [cPts[5], ch]
        ];

        ctx.save();
        ctx.globalAlpha = 0.85 * a;
        ctx.beginPath();
        cPts.forEach(function (p, i) { if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); });
        ctx.closePath();
        ctx.fillStyle = 'rgba(30, 108, 239, 0.06)';
        ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.82)';
        ctx.stroke();

        ctx.lineWidth = 0.9;
        ctx.strokeStyle = 'rgba(191, 219, 254, 0.68)';
        ctx.beginPath();
        for (let i = 0; i < edges.length; i++) {
          ctx.moveTo(edges[i][0][0], edges[i][0][1]);
          ctx.lineTo(edges[i][1][0], edges[i][1][1]);
        }
        ctx.stroke();

        const nodes = [fh, le, re, glab, nt, lc, rc, mc, ch];
        for (let i = 0; i < nodes.length; i++) {
          ctx.beginPath();
          ctx.arc(nodes[i][0], nodes[i][1], 3.2, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
          ctx.lineWidth = 1.4;
          ctx.strokeStyle = '#1E6CEF';
          ctx.stroke();
        }
        ctx.restore();
      }

      function drawMediaPipeMesh(lm, viewW, viewH) {
        if (!lm || lm.length < 468) return;
        const mir = currentFacing === 'user';
        const px = function (idx) {
          const p = lm[idx];
          if (!p) return null;
          return projectCover(mir ? (1 - p.x) : p.x, p.y, viewW, viewH);
        };

        ctx.save();
        // Full clinical triangulated face mesh (468 points)
        const tess = window.FACEMESH_TESSELATION;
        if (tess && tess.length) {
          ctx.beginPath();
          ctx.lineWidth = 0.72;
          ctx.strokeStyle = 'rgba(96, 165, 250, 0.56)';
          for (let i = 0; i < tess.length; i++) {
            const pA = px(tess[i][0]);
            const pB = px(tess[i][1]);
            if (!pA || !pB) continue;
            ctx.moveTo(pA[0], pA[1]);
            ctx.lineTo(pB[0], pB[1]);
          }
          ctx.stroke();
        }

        // Clean bright anatomical outer oval + key contours
        const oval = window.FACEMESH_FACE_OVAL;
        if (oval && oval.length) {
          ctx.beginPath();
          ctx.lineWidth = 1.65;
          ctx.strokeStyle = 'rgba(30, 108, 239, 0.88)';
          for (let i = 0; i < oval.length; i++) {
            const pA = px(oval[i][0]);
            const pB = px(oval[i][1]);
            if (!pA || !pB) continue;
            ctx.moveTo(pA[0], pA[1]);
            ctx.lineTo(pB[0], pB[1]);
          }
          ctx.stroke();
        }

        // Key clinical nodes (forehead 10, glabella 168, nose 1, mouth 13, chin 152, cheeks 234/454, eyes 159/386)
        const keyIdx = [10, 168, 1, 13, 152, 234, 454, 159, 386];
        for (let i = 0; i < keyIdx.length; i++) {
          const p = px(keyIdx[i]);
          if (!p) continue;
          ctx.beginPath();
          ctx.arc(p[0], p[1], 3.0, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
          ctx.lineWidth = 1.3;
          ctx.strokeStyle = '#1E6CEF';
          ctx.stroke();
        }
        ctx.restore();
      }

      function computeStatusFromMediaPipe(lm) {
        const mir = currentFacing === 'user';
        const nx = function (i) { return mir ? (1 - lm[i].x) : lm[i].x; };
        const noseX = nx(1);
        const noseY = lm[1].y;
        const leftCheekX = nx(234);
        const rightCheekX = nx(454);
        const topY = lm[10].y;
        const chinY = lm[152].y;
        const faceW = Math.abs(rightCheekX - leftCheekX);
        const faceH = Math.abs(chinY - topY);
        const midX = (leftCheekX + rightCheekX) * 0.5;
        const yawSym = Math.abs(noseX - midX) / Math.max(0.05, faceW);
        const rollDiff = Math.abs(lm[33].y - lm[263].y);

        const centered = Math.abs(noseX - 0.5) < 0.14 && noseY > 0.25 && noseY < 0.72 && faceH > 0.22 && faceH < 0.85;
        const forward = yawSym < 0.16 && rollDiff < 0.08;
        return { detected: true, centered: centered, forward: forward };
      }

      function emitStatus(statusObj) {
        const now = Date.now();
        if (now - lastStatusSent < 260) return;
        lastStatusSent = now;
        postRN(Object.assign({ type: 'face_status' }, statusObj));
      }

      function tick() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cw = canvas.clientWidth || window.innerWidth;
        const ch = canvas.clientHeight || window.innerHeight;
        if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
          canvas.width = Math.round(cw * dpr);
          canvas.height = Math.round(ch * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cw, ch);

        const now = Date.now();
        if (mpFaceMesh && video.readyState >= 2 && !mpBusy && (now - mpLastTs > 38)) {
          mpBusy = true;
          mpLastTs = now;
          mpFaceMesh.send({ image: video }).catch(function () { mpBusy = false; }).finally(function () { mpBusy = false; });
        }

        const hasFreshMp = mpLandmarks && (now - mpLastTs < 450);
        if (hasFreshMp) {
          drawMediaPipeMesh(mpLandmarks, cw, ch);
          emitStatus(computeStatusFromMediaPipe(mpLandmarks));
        } else if (video.readyState >= 2) {
          runFastCvTrack();
          drawCvMesh(cw, ch);
          emitStatus({
            detected: cvState.detected,
            centered: cvState.detected && Math.abs(cvState.cx - 0.5) < 0.16 && cvState.ey > 0.22 && cvState.ey < 0.62,
            forward: cvState.detected && Math.abs(cvState.cx - 0.5) < 0.18
          });
        }
        requestAnimationFrame(tick);
      }

      function tryInitMediaPipe() {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js';
        s.crossOrigin = 'anonymous';
        s.async = true;
        s.onload = function () {
          try {
            if (!window.FaceMesh) return;
            const fm = new window.FaceMesh({
              locateFile: function (file) {
                return 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/' + file;
              }
            });
            fm.setOptions({
              maxNumFaces: 1,
              refineLandmarks: false,
              minDetectionConfidence: 0.5,
              minTrackingConfidence: 0.5
            });
            fm.onResults(function (res) {
              if (res && res.multiFaceLandmarks && res.multiFaceLandmarks.length > 0) {
                mpLandmarks = res.multiFaceLandmarks[0];
              } else {
                mpLandmarks = null;
              }
            });
            mpFaceMesh = fm;
          } catch (e) {}
        };
        document.head.appendChild(s);
      }

      window.__auraSetFacing = function (f) {
        const nextF = f === 'back' ? 'environment' : 'user';
        if (nextF !== currentFacing) startCamera(nextF);
      };
      window.__auraSetFlash = function (fl) {
        applyTorch(fl === 'on');
      };
      function getSourceCropRect() {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const mir = currentFacing === 'user';
        const now = Date.now();
        let x0 = 0, y0 = 0, x1 = 1, y1 = 1;

        if (mpLandmarks && mpLandmarks.length >= 468 && (now - mpLastTs < 650)) {
          let mnX = 1, mxX = 0, mnY = 1, mxY = 0;
          for (let i = 0; i < mpLandmarks.length; i++) {
            const p = mpLandmarks[i];
            if (!p) continue;
            if (p.x < mnX) mnX = p.x;
            if (p.x > mxX) mxX = p.x;
            if (p.y < mnY) mnY = p.y;
            if (p.y > mxY) mxY = p.y;
          }
          if (mxX - mnX > 0.12 && mxY - mnY > 0.14) {
            const px = (mxX - mnX) * 0.08;
            const py = (mxY - mnY) * 0.08;
            x0 = Math.max(0, mnX - px);
            x1 = Math.min(1, mxX + px);
            y0 = Math.max(0, mnY - py);
            y1 = Math.min(1, mxY + py);
          }
        } else if (cvState.detected) {
          const dispX0 = Math.max(0, cvState.cx - cvState.halfW);
          const dispX1 = Math.min(1, cvState.cx + cvState.halfW);
          const rawX0 = mir ? (1 - dispX1) : dispX0;
          const rawX1 = mir ? (1 - dispX0) : dispX1;
          const spanX = Math.max(0.16, rawX1 - rawX0);
          const spanY = Math.max(0.20, cvState.chinY - cvState.fhY);
          const px = spanX * 0.08;
          const py = spanY * 0.08;
          x0 = Math.max(0, rawX0 - px);
          x1 = Math.min(1, rawX1 + px);
          y0 = Math.max(0, cvState.fhY - py);
          y1 = Math.min(1, cvState.chinY + py);
        }

        const sx = Math.round(x0 * vw);
        const sy = Math.round(y0 * vh);
        const sw = Math.max(64, Math.round((x1 - x0) * vw));
        const sh = Math.max(64, Math.round((y1 - y0) * vh));
        return { sx: sx, sy: sy, sw: Math.min(vw - sx, sw), sh: Math.min(vh - sy, sh) };
      }

      window.__auraCapture = function () {
        if (!video.videoWidth || !video.videoHeight) {
          postRN({ type: 'capture_error', reason: 'Video belum siap' });
          return;
        }
        const rect = getSourceCropRect();
        const maxSide = 720;
        const scale = Math.min(1, maxSide / Math.max(rect.sw, rect.sh));
        const outW = Math.round(rect.sw * scale);
        const outH = Math.round(rect.sh * scale);
        const cap = document.createElement('canvas');
        cap.width = outW;
        cap.height = outH;
        const cctx = cap.getContext('2d');
        if (currentFacing === 'user') {
          cctx.translate(outW, 0);
          cctx.scale(-1, 1);
        }
        cctx.drawImage(video, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, outW, outH);
        const dataUrl = cap.toDataURL('image/jpeg', 0.86);
        postRN({ type: 'captured', dataUrl: dataUrl });
      };

      startCamera('user');
      tryInitMediaPipe();
      requestAnimationFrame(tick);
    })();
  </script>
</body>
</html>`;

export const LiveFaceTrackerCamera = forwardRef<
  LiveFaceTrackerHandle,
  LiveFaceTrackerCameraProps
>(function LiveFaceTrackerCamera(
  {
    facing,
    flash,
    active,
    onReadyChange,
    onFaceStatusChange,
    onCaptured,
    onFallbackRequired,
  },
  ref
) {
  const webViewRef = useRef<WebView>(null);
  const readyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isReadyRef = useRef(false);

  const capture = useCallback(() => {
    webViewRef.current?.injectJavaScript('window.__auraCapture && window.__auraCapture(); true;');
  }, []);

  useImperativeHandle(ref, () => ({ capture }), [capture]);

  useEffect(() => {
    if (!active) return;
    isReadyRef.current = false;
    readyTimeoutRef.current = setTimeout(() => {
      if (!isReadyRef.current) {
        onFallbackRequired?.();
      }
    }, 4500);
    return () => {
      if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
    };
  }, [active, onFallbackRequired]);

  useEffect(() => {
    if (!active || !isReadyRef.current) return;
    webViewRef.current?.injectJavaScript(
      `window.__auraSetFacing && window.__auraSetFacing(${JSON.stringify(facing)}); true;`
    );
  }, [facing, active]);

  useEffect(() => {
    if (!active || !isReadyRef.current) return;
    webViewRef.current?.injectJavaScript(
      `window.__auraSetFlash && window.__auraSetFlash(${JSON.stringify(flash)}); true;`
    );
  }, [flash, active]);

  const source = useMemo(() => ({ html: TRACKER_HTML, baseUrl: 'https://aura.app/' }), []);

  const handleMessage = (ev: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(ev.nativeEvent.data);
      if (msg.type === 'ready') {
        isReadyRef.current = true;
        if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
        onReadyChange?.(true);
        webViewRef.current?.injectJavaScript(
          `window.__auraSetFacing && window.__auraSetFacing(${JSON.stringify(facing)}); true;`
        );
      } else if (msg.type === 'face_status') {
        onFaceStatusChange?.({
          detected: Boolean(msg.detected),
          centered: Boolean(msg.centered),
          forward: Boolean(msg.forward),
        });
      } else if (msg.type === 'captured' && msg.dataUrl) {
        onCaptured?.(msg.dataUrl);
      } else if (msg.type === 'camera_error') {
        if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
        onFallbackRequired?.();
      } else if (msg.type === 'capture_error') {
        onFallbackRequired?.();
      }
    } catch {
      // Ignore malformed messages
    }
  };

  if (Platform.OS === 'web' || !active) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <WebView
        ref={webViewRef}
        source={source}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="compatibility"
        scrollEnabled={false}
        bounces={false}
        style={styles.webview}
        onMessage={handleMessage}
        onError={() => onFallbackRequired?.()}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: '#020617',
  },
});
