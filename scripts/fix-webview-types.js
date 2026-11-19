const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'node_modules', 'react-native-webview', 'index.d.ts');

if (fs.existsSync(targetFile)) {
  try {
    let content = fs.readFileSync(targetFile, 'utf8');
    if (content.includes('declare class WebView<P = undefined>')) {
      content = content.replace('declare class WebView<P = undefined>', 'declare class WebView<P = {}>');
      fs.writeFileSync(targetFile, content, 'utf8');
      console.log('[fix-webview-types] Successfully patched react-native-webview types for React 19');
    }
  } catch (err) {
    console.warn('[fix-webview-types] Failed patching react-native-webview types:', err);
  }
}
