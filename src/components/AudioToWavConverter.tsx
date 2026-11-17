import React, { useRef, useImperativeHandle, forwardRef, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';

export interface WavConversionResult {
  uri: string;
  peakAmp: number;
  rms: number;
  duration: number;
  sampleRate: number;
  isSilent: boolean;
}

export interface AudioToWavConverterRef {
  /**
   * Memulai perekaman PCM mentah langsung dari mikrofon WebView (bebas bug muxer/decode M4A).
   */
  startDirectPcmRecording: (
    onLevel?: (levelPct: number, peak: number) => void
  ) => Promise<boolean>;
  /**
   * Menghentikan perekaman PCM langsung, melakukan resampling ke targetSampleRate (16kHz),
   * dan mengembalikan file WAV 16-bit mono beserta metrik amplitudo.
   */
  stopDirectPcmRecording: (
    targetSampleRate?: number
  ) => Promise<WavConversionResult>;
  /**
   * Mengonversi audio file URI (misalnya .m4a / .aac / .3gp) menjadi file .wav PCM 16-bit mono.
   */
  convertToWav: (
    inputUri: string,
    targetSampleRate?: number
  ) => Promise<WavConversionResult>;
}

const CONVERTER_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
<script>
  function postBack(data) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify(data));
    }
  }

  function base64ToArrayBuffer(base64) {
    var binaryString = window.atob(base64);
    var len = binaryString.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function arrayBufferToBase64(buffer) {
    var binary = '';
    var bytes = new Uint8Array(buffer);
    var len = bytes.byteLength;
    var chunkSize = 8192;
    for (var i = 0; i < len; i += chunkSize) {
      var chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
      binary += String.fromCharCode.apply(null, chunk);
    }
    return window.btoa(binary);
  }

  function encodeWAV(samples, sampleRate) {
    var buffer = new ArrayBuffer(44 + samples.length * 2);
    var view = new DataView(buffer);

    function writeString(v, offset, str) {
      for (var i = 0; i < str.length; i++) {
        v.setUint8(offset + i, str.charCodeAt(i));
      }
    }

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    var offset = 44;
    for (var i = 0; i < samples.length; i++, offset += 2) {
      var s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return buffer;
  }

  function extractMonoSamples(decodedBuffer) {
    var numChannels = decodedBuffer.numberOfChannels || 1;
    var length = decodedBuffer.length || 0;
    if (length === 0) {
      return { mono: new Float32Array(0), peak: 0, rms: 0 };
    }

    var channels = [];
    var chPeaks = [];
    var activeCount = 0;
    for (var c = 0; c < numChannels; c++) {
      var data = decodedBuffer.getChannelData(c);
      var chPeak = 0;
      for (var i = 0; i < data.length; i++) {
        var a = Math.abs(data[i]);
        if (a > chPeak) chPeak = a;
      }
      channels.push(data);
      chPeaks.push(chPeak);
      if (chPeak > 1e-6) activeCount++;
    }

    var mono = new Float32Array(length);
    var peak = 0;
    var sumSq = 0;
    var invCount = activeCount > 0 ? (1.0 / activeCount) : (1.0 / numChannels);

    for (var i = 0; i < length; i++) {
      var acc = 0;
      for (var c = 0; c < numChannels; c++) {
        if (activeCount === 0 || chPeaks[c] > 1e-6) {
          acc += channels[c][i];
        }
      }
      var val = acc * invCount;
      mono[i] = val;
      var av = Math.abs(val);
      if (av > peak) peak = av;
      sumSq += val * val;
    }

    return {
      mono: mono,
      peak: peak,
      rms: Math.sqrt(sumSq / length),
    };
  }

  function resampleMonoDirect(mono, srcRate, dstRate) {
    if (!mono || mono.length === 0 || srcRate === dstRate || srcRate <= 0) {
      return mono;
    }

    var ratio = srcRate / dstRate;
    var outLen = Math.max(1, Math.floor(mono.length / ratio));
    var out = new Float32Array(outLen);

    if (ratio > 1.2) {
      for (var i = 0; i < outLen; i++) {
        var start = Math.floor(i * ratio);
        var end = Math.min(mono.length, Math.ceil((i + 1) * ratio));
        if (end <= start) end = Math.min(mono.length, start + 1);
        var sum = 0;
        for (var j = start; j < end; j++) {
          sum += mono[j];
        }
        out[i] = sum / Math.max(1, end - start);
      }
    } else {
      for (var i = 0; i < outLen; i++) {
        var srcIdx = i * ratio;
        var idx0 = Math.floor(srcIdx);
        var idx1 = Math.min(mono.length - 1, idx0 + 1);
        var frac = srcIdx - idx0;
        out[i] = mono[idx0] * (1 - frac) + mono[idx1] * frac;
      }
    }

    return out;
  }

  function finalizeMonoToWavBase64(monoSamples, peakAmp, srcRate, targetSampleRate) {
    // Remove DC offset before bandpass/FFT
    var mean = 0;
    for (var m = 0; m < monoSamples.length; m++) {
      mean += monoSamples[m];
    }
    mean = monoSamples.length > 0 ? (mean / monoSamples.length) : 0;

    var centered = new Float32Array(monoSamples.length);
    var centeredPeak = 0;
    for (var m = 0; m < monoSamples.length; m++) {
      var v = monoSamples[m] - mean;
      centered[m] = v;
      var av = Math.abs(v);
      if (av > centeredPeak) centeredPeak = av;
    }

    var resampled = resampleMonoDirect(centered, srcRate, targetSampleRate);
    var finalSamples = resampled;
    if (centeredPeak > 0.0002 && centeredPeak < 0.35) {
      var gain = Math.min(12.0, 0.72 / centeredPeak);
      finalSamples = new Float32Array(resampled.length);
      for (var k = 0; k < resampled.length; k++) {
        finalSamples[k] = Math.max(-0.98, Math.min(0.98, resampled[k] * gain));
      }
    }

    var wavBuffer = encodeWAV(finalSamples, targetSampleRate);
    return {
      wavBase64: arrayBufferToBase64(wavBuffer),
      effectivePeak: centeredPeak > 0 ? centeredPeak : peakAmp,
    };
  }

  // ── Direct WebView PCM Live Mic Recording State ──
  var liveState = null;

  function cleanupLiveRecorder() {
    if (!liveState) return;
    try { if (liveState.processor) liveState.processor.disconnect(); } catch (e) {}
    try { if (liveState.source) liveState.source.disconnect(); } catch (e) {}
    try { if (liveState.zeroGain) liveState.zeroGain.disconnect(); } catch (e) {}
    try {
      if (liveState.stream) {
        var tracks = liveState.stream.getTracks();
        for (var i = 0; i < tracks.length; i++) tracks[i].stop();
      }
    } catch (e) {}
    try {
      if (liveState.audioCtx && typeof liveState.audioCtx.close === 'function') {
        liveState.audioCtx.close();
      }
    } catch (e) {}
    liveState = null;
  }

  window.__startDirectPcmRecording = async function(reqId) {
    cleanupLiveRecorder();
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia tidak tersedia');
      }

      var stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
          video: false,
        });
      } catch (e1) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }

      var AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) {
        throw new Error('Web Audio API tidak tersedia');
      }

      var audioCtx = new AudioCtxClass();
      if (audioCtx.state === 'suspended') {
        try { await audioCtx.resume(); } catch (e) {}
      }

      var source = audioCtx.createMediaStreamSource(stream);
      var processor = audioCtx.createScriptProcessor(2048, 1, 1);
      var zeroGain = audioCtx.createGain();
      zeroGain.gain.value = 0.0;

      var chunks = [];
      var totalSamples = 0;
      var maxPeak = 0;
      var lastMeterSent = 0;

      liveState = {
        stream: stream,
        audioCtx: audioCtx,
        source: source,
        processor: processor,
        zeroGain: zeroGain,
        chunks: chunks,
        sampleRate: audioCtx.sampleRate || 44100,
        getTotalSamples: function() { return totalSamples; },
        getMaxPeak: function() { return maxPeak; },
      };

      processor.onaudioprocess = function(ev) {
        if (!liveState) return;
        var input = ev.inputBuffer.getChannelData(0);
        var copy = new Float32Array(input.length);
        var blockPeak = 0;
        var blockSumSq = 0;
        for (var i = 0; i < input.length; i++) {
          var s = input[i];
          copy[i] = s;
          var a = Math.abs(s);
          if (a > blockPeak) blockPeak = a;
          blockSumSq += s * s;
        }
        chunks.push(copy);
        totalSamples += copy.length;
        if (blockPeak > maxPeak) maxPeak = blockPeak;

        var now = Date.now();
        if (now - lastMeterSent >= 90) {
          lastMeterSent = now;
          var blockRms = Math.sqrt(blockSumSq / Math.max(1, copy.length));
          var db = blockPeak > 1e-6 ? 20 * Math.log10(blockPeak) : -120;
          var levelPct = Math.max(0, Math.min(100, Math.round(((db + 55) / 50) * 100)));
          postBack({
            type: 'PCM_LEVEL',
            levelPct: levelPct,
            peak: blockPeak,
            rms: blockRms,
          });
        }
      };

      source.connect(processor);
      processor.connect(zeroGain);
      zeroGain.connect(audioCtx.destination);

      // Verify PCM callback actually fires within 650ms before committing
      var deadline = Date.now() + 650;
      while (Date.now() < deadline) {
        if (chunks.length >= 1) {
          postBack({ id: reqId, type: 'PCM_STARTED', success: true, sampleRate: audioCtx.sampleRate });
          return;
        }
        await new Promise(function(r) { setTimeout(r, 40); });
      }

      if (chunks.length >= 1) {
        postBack({ id: reqId, type: 'PCM_STARTED', success: true, sampleRate: audioCtx.sampleRate });
      } else {
        cleanupLiveRecorder();
        postBack({ id: reqId, type: 'PCM_STARTED', success: false, error: 'Stream PCM tidak aktif' });
      }
    } catch (err) {
      cleanupLiveRecorder();
      postBack({
        id: reqId,
        type: 'PCM_STARTED',
        success: false,
        error: err ? (err.message || String(err)) : 'Gagal membuka mic WebView',
      });
    }
  };

  window.__stopDirectPcmRecording = function(reqId, targetSampleRate) {
    try {
      if (!liveState) {
        postBack({ id: reqId, type: 'PCM_STOPPED', success: false, error: 'Tidak ada sesi rekaman PCM aktif' });
        return;
      }

      var state = liveState;
      var srcRate = state.sampleRate || 44100;
      var chunks = state.chunks;
      var totalLen = state.getTotalSamples();

      cleanupLiveRecorder();

      var merged = new Float32Array(totalLen);
      var offset = 0;
      var peak = 0;
      var sumSq = 0;
      for (var i = 0; i < chunks.length; i++) {
        var ch = chunks[i];
        merged.set(ch, offset);
        for (var j = 0; j < ch.length; j++) {
          var v = ch[j];
          var av = Math.abs(v);
          if (av > peak) peak = av;
          sumSq += v * v;
        }
        offset += ch.length;
      }

      var rms = totalLen > 0 ? Math.sqrt(sumSq / totalLen) : 0;
      var dur = totalLen / Math.max(1, srcRate);
      var outRate = targetSampleRate || 16000;
      var encoded = finalizeMonoToWavBase64(merged, peak, srcRate, outRate);

      postBack({
        id: reqId,
        type: 'PCM_STOPPED',
        success: true,
        wavBase64: encoded.wavBase64,
        peakAmp: encoded.effectivePeak,
        rms: rms,
        sampleRate: outRate,
        duration: dur,
      });
    } catch (err) {
      cleanupLiveRecorder();
      postBack({
        id: reqId,
        type: 'PCM_STOPPED',
        success: false,
        error: err ? (err.message || String(err)) : 'Gagal menyimpan rekaman PCM',
      });
    }
  };

  function decodeAudioBuffer(audioCtx, arrayBuffer) {
    return new Promise(function(resolve, reject) {
      try {
        var res = audioCtx.decodeAudioData(arrayBuffer, function(decoded) {
          resolve(decoded);
        }, function(err) {
          reject(err || new Error('Gagal mendekode stream audio.'));
        });
        if (res && typeof res.then === 'function') {
          res.then(resolve).catch(reject);
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  function readWavPcmStats(arrayBuffer) {
    try {
      var view = new DataView(arrayBuffer);
      var channels = view.getUint16(22, true) || 1;
      var sampleRate = view.getUint32(24, true) || 16000;
      var bits = view.getUint16(34, true) || 16;
      if (bits !== 16) {
        return { peak: 0.5, rms: 0.1, sampleRate: sampleRate, duration: 1.0 };
      }
      var count = Math.floor((arrayBuffer.byteLength - 44) / 2);
      var peak = 0;
      var sumSq = 0;
      for (var i = 0; i < count; i++) {
        var s = view.getInt16(44 + i * 2, true) / 32768.0;
        var a = Math.abs(s);
        if (a > peak) peak = a;
        sumSq += s * s;
      }
      var duration = count / Math.max(1, sampleRate * channels);
      return {
        peak: peak,
        rms: count > 0 ? Math.sqrt(sumSq / count) : 0,
        sampleRate: sampleRate,
        duration: duration,
      };
    } catch (e) {
      return { peak: 0.5, rms: 0.1, sampleRate: 16000, duration: 1.0 };
    }
  }

  window.__convertToWavRequest = async function(reqId, base64, targetSampleRate) {
    var outRate = targetSampleRate || 16000;
    var audioCtx = null;
    try {
      var arrayBuffer = base64ToArrayBuffer(base64);

      if (arrayBuffer.byteLength >= 44) {
        var headerBytes = new Uint8Array(arrayBuffer.slice(0, 4));
        var riffStr = String.fromCharCode.apply(null, headerBytes);
        var typeBytes = new Uint8Array(arrayBuffer.slice(8, 12));
        var waveStr = String.fromCharCode.apply(null, typeBytes);
        if (riffStr === 'RIFF' && waveStr === 'WAVE') {
          var stats = readWavPcmStats(arrayBuffer);
          postBack({
            id: reqId,
            type: 'CONVERT_DONE',
            success: true,
            wavBase64: base64,
            peakAmp: stats.peak,
            rms: stats.rms,
            sampleRate: stats.sampleRate,
            duration: stats.duration,
          });
          return;
        }
      }

      var AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) {
        throw new Error('Web Audio API tidak didukung pada perangkat ini.');
      }

      audioCtx = new AudioCtxClass();
      if (audioCtx.state === 'suspended') {
        try { await audioCtx.resume(); } catch (e) {}
      }

      var decodedBuffer = await decodeAudioBuffer(audioCtx, arrayBuffer);
      var extracted = extractMonoSamples(decodedBuffer);
      var encoded = finalizeMonoToWavBase64(
        extracted.mono,
        extracted.peak,
        decodedBuffer.sampleRate,
        outRate
      );

      postBack({
        id: reqId,
        type: 'CONVERT_DONE',
        success: true,
        wavBase64: encoded.wavBase64,
        peakAmp: encoded.effectivePeak,
        rms: extracted.rms,
        sampleRate: outRate,
        duration: decodedBuffer.duration,
      });
    } catch (err) {
      postBack({
        id: reqId,
        type: 'CONVERT_DONE',
        success: false,
        error: err ? (err.message || String(err)) : 'Terjadi kesalahan saat konversi audio.',
      });
    } finally {
      if (audioCtx && typeof audioCtx.close === 'function') {
        try { audioCtx.close(); } catch (e) {}
      }
    }
  };

  function handleMessage(event) {
    var msg;
    try {
      msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    } catch (e) {
      return;
    }
    if (!msg) return;
    if (msg.type === 'CONVERT_TO_WAV') {
      window.__convertToWavRequest(msg.id, msg.base64, msg.targetSampleRate);
    } else if (msg.type === 'START_PCM_RECORD') {
      window.__startDirectPcmRecording(msg.id);
    } else if (msg.type === 'STOP_PCM_RECORD') {
      window.__stopDirectPcmRecording(msg.id, msg.targetSampleRate);
    }
  }

  window.addEventListener('message', handleMessage);
  document.addEventListener('message', handleMessage);

  window.onload = function() {
    postBack({ type: 'READY' });
  };
</script>
</body>
</html>
`;

export const AudioToWavConverter = forwardRef<AudioToWavConverterRef, object>((_, ref) => {
  const webViewRef = useRef<WebView>(null);
  const levelCbRef = useRef<((levelPct: number, peak: number) => void) | undefined>(undefined);
  const pendingBoolRequests = useRef<
    Map<
      string,
      {
        resolve: (ok: boolean) => void;
        timeoutId: ReturnType<typeof setTimeout>;
      }
    >
  >(new Map());
  const pendingWavRequests = useRef<
    Map<
      string,
      {
        resolve: (val: WavConversionResult) => void;
        reject: (err: any) => void;
        timeoutId: ReturnType<typeof setTimeout>;
      }
    >
  >(new Map());

  const source = useMemo(
    () => ({ html: CONVERTER_HTML, baseUrl: 'https://aura.app/' }),
    []
  );

  useImperativeHandle(ref, () => ({
    startDirectPcmRecording: (onLevel) => {
      levelCbRef.current = onLevel;
      const id = 'pcm_start_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      return new Promise<boolean>((resolve) => {
        const timeoutId = setTimeout(() => {
          if (pendingBoolRequests.current.has(id)) {
            pendingBoolRequests.current.delete(id);
            resolve(false);
          }
        }, 2500);
        pendingBoolRequests.current.set(id, { resolve, timeoutId });
        webViewRef.current?.postMessage(
          JSON.stringify({ type: 'START_PCM_RECORD', id })
        );
      });
    },

    stopDirectPcmRecording: (targetSampleRate: number = 16000) => {
      levelCbRef.current = undefined;
      const id = 'pcm_stop_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      return new Promise<WavConversionResult>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          if (pendingWavRequests.current.has(id)) {
            pendingWavRequests.current.delete(id);
            reject(new Error('Waktu penghentian rekaman PCM melebihi batas.'));
          }
        }, 12000);
        pendingWavRequests.current.set(id, { resolve, reject, timeoutId });
        webViewRef.current?.postMessage(
          JSON.stringify({ type: 'STOP_PCM_RECORD', id, targetSampleRate })
        );
      });
    },

    convertToWav: async (
      inputUri: string,
      targetSampleRate: number = 16000
    ): Promise<WavConversionResult> => {
      let base64: string;
      try {
        base64 = await FileSystem.readAsStringAsync(inputUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (readErr: any) {
        throw new Error(
          'Gagal membaca file rekaman audio: ' + (readErr?.message || 'File tidak ditemukan')
        );
      }

      if (!base64 || base64.length < 50) {
        throw new Error('File rekaman batuk kosong atau terlalu pendek.');
      }

      return new Promise<WavConversionResult>((resolve, reject) => {
        const id = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const timeoutId = setTimeout(() => {
          if (pendingWavRequests.current.has(id)) {
            pendingWavRequests.current.delete(id);
            reject(new Error('Waktu konversi audio ke WAV melebihi batas (timeout).'));
          }
        }, 15000);

        pendingWavRequests.current.set(id, { resolve, reject, timeoutId });

        webViewRef.current?.postMessage(
          JSON.stringify({
            type: 'CONVERT_TO_WAV',
            id,
            base64,
            targetSampleRate,
          })
        );
      });
    },
  }));

  const handleMessage = async (event: any) => {
    try {
      const rawData = event.nativeEvent.data;
      const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;

      if (!data || data.type === 'READY') return;

      if (data.type === 'PCM_LEVEL') {
        levelCbRef.current?.(data.levelPct || 0, data.peak || 0);
        return;
      }

      if (data.type === 'PCM_STARTED') {
        const boolReq = pendingBoolRequests.current.get(data.id);
        if (boolReq) {
          clearTimeout(boolReq.timeoutId);
          pendingBoolRequests.current.delete(data.id);
          boolReq.resolve(Boolean(data.success));
        }
        return;
      }

      const wavReq = pendingWavRequests.current.get(data.id);
      if (!wavReq) return;

      clearTimeout(wavReq.timeoutId);
      pendingWavRequests.current.delete(data.id);

      if (data.success && data.wavBase64) {
        const outputUri = `${FileSystem.cacheDirectory}cough_converted_${Date.now()}.wav`;
        await FileSystem.writeAsStringAsync(outputUri, data.wavBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const peakAmp = typeof data.peakAmp === 'number' ? data.peakAmp : 0;
        const rms = typeof data.rms === 'number' ? data.rms : 0;
        wavReq.resolve({
          uri: outputUri,
          peakAmp,
          rms,
          duration: typeof data.duration === 'number' ? data.duration : 0,
          sampleRate: typeof data.sampleRate === 'number' ? data.sampleRate : 16000,
          isSilent: peakAmp < 0.00015,
        });
      } else {
        wavReq.reject(new Error(data.error || 'Gagal memproses audio ke WAV.'));
      }
    } catch (e: any) {
      console.warn('[AudioConverter] handleMessage error:', e);
    }
  };

  return (
    <View style={styles.hiddenContainer} pointerEvents="none">
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={source}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="compatibility"
        style={styles.webView}
      />
    </View>
  );
});

AudioToWavConverter.displayName = 'AudioToWavConverter';

const styles = StyleSheet.create({
  hiddenContainer: {
    width: 1,
    height: 1,
    opacity: 0,
    position: 'absolute',
    top: -100,
    left: -100,
  },
  webView: {
    width: 1,
    height: 1,
  },
});
