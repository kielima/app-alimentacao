/**
 * Lê um arquivo de imagem, redimensiona no cliente e devolve um data URL JPEG
 * compacto — pequeno o bastante para guardar junto da receita no Firestore
 * (sem precisar de Firebase Storage). Fotos de receita ficam tipicamente entre
 * ~60 e ~180 KB, bem abaixo do limite de 1 MB por documento.
 */
export function compressImageToDataUrl(
  file: File,
  maxDim = 900,
  quality = 0.62,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width === 0 || height === 0) {
        reject(new Error('Imagem inválida.'));
        return;
      }
      const scale = Math.min(1, maxDim / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Não foi possível processar a imagem neste dispositivo.'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler a imagem.'));
    };
    img.src = url;
  });
}
