/** Tamanho máximo aceito para a foto do produto. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Envia a imagem para o ImgBB pela rota `/api/upload` (a chave da API fica só no servidor)
 * e devolve a URL pública da imagem.
 */
export async function uploadImage(file: File): Promise<string> {
  const body = new FormData();
  body.append("image", file);
  const res = await fetch("/api/upload", { method: "POST", body });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? "Falha no upload da imagem.");
  return data.url;
}
