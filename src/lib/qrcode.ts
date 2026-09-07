import QRCode from 'qrcode';

export async function qrDataUrl(text: string, size = 640): Promise<string> {
  return QRCode.toDataURL(text, {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#0f172a', light: '#ffffff' },
  });
}

export function registerUrl(): string {
  const { origin, pathname } = window.location;
  const base = (origin + pathname).replace(/\/$/, '');
  return `${base}/?view=register`;
}
