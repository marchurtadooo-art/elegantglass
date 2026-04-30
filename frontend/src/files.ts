import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Download a base64 file payload and open the system share sheet (mobile),
 * or trigger a browser download (web).
 */
export async function downloadBase64File(payload: { filename: string; mime: string; base64: string }) {
  const { filename, mime, base64 } = payload;

  if (Platform.OS === 'web') {
    // Web: convert base64 → Blob → download
    const byteChars = atob(base64);
    const byteNums = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
    const blob = new Blob([new Uint8Array(byteNums)], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = (globalThis as any).document.createElement('a');
    a.href = url; a.download = filename;
    (globalThis as any).document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return;
  }

  const dir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory;
  const uri = `${dir}${filename}`;
  await (FileSystem as any).writeAsStringAsync(uri, base64, { encoding: (FileSystem as any).EncodingType?.Base64 || 'base64' });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: filename, UTI: mime === 'application/pdf' ? 'com.adobe.pdf' : undefined });
  }
}

/**
 * Share a base64 file — always tries to open the native share sheet on mobile,
 * or triggers the Web Share API / falls back to download on web.
 */
export async function shareBase64File(payload: { filename: string; mime: string; base64: string }) {
  const { filename, mime, base64 } = payload;

  if (Platform.OS === 'web') {
    try {
      const byteChars = atob(base64);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNums)], { type: mime });
      const nav: any = (globalThis as any).navigator;
      const file = new File([blob], filename, { type: mime });
      if (nav && nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: filename });
        return;
      }
    } catch { /* fall through to download */ }
    // Fallback: trigger download
    return downloadBase64File(payload);
  }

  const dir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory;
  const uri = `${dir}${filename}`;
  await (FileSystem as any).writeAsStringAsync(uri, base64, { encoding: (FileSystem as any).EncodingType?.Base64 || 'base64' });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: mime,
      dialogTitle: 'Enviar reporte al cliente',
      UTI: mime === 'application/pdf' ? 'com.adobe.pdf' : undefined,
    });
  }
}
