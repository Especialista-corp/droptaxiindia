const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;
/** Abaixo disso a foto já é leve o bastante — recomprimir só perderia qualidade. */
const SKIP_BELOW_BYTES = 300 * 1024;

/**
 * Reduz uma foto no próprio aparelho antes do upload: uma foto de celular de
 * 3–5 MB vira ~200–400 KB, o que acelera o envio no 4G e economiza o espaço de
 * armazenamento. PDFs e arquivos que não são imagem passam intactos, e
 * qualquer falha devolve o arquivo original — a compressão nunca impede o envio.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= SKIP_BELOW_BYTES) return file;

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const nome = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nome, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}

export function compressImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map(compressImage));
}

/**
 * Troca os arquivos de um <input type="file"> pelas versões comprimidas, para
 * formulários que enviam o input direto (sem montar o FormData à mão).
 */
export async function compressInputFiles(input: HTMLInputElement) {
  if (!input.files?.length) return;
  const comprimidos = await compressImages([...input.files]);
  const transfer = new DataTransfer();
  comprimidos.forEach((file) => transfer.items.add(file));
  input.files = transfer.files;
}
