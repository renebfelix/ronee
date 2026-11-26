import { NextResponse } from "next/server";

/**
 * Upload de imagens para o ImgBB (fotos dos produtos da Lista de compras).
 * A chave `RONEE_NEXT_PUBLIC_IMGBB_API_KEY` só existe no servidor — nunca vai para o navegador.
 */
export async function POST(req: Request) {
  const key = process.env.RONEE_NEXT_PUBLIC_IMGBB_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Chave do ImgBB não configurada." }, { status: 500 });
  }

  const incoming = await req.formData();
  const file = incoming.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Envie uma imagem." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "O arquivo precisa ser uma imagem." }, { status: 400 });
  }

  const body = new FormData();
  body.append("image", file);
  if (file.name) body.append("name", file.name.replace(/\.[^.]+$/, ""));

  const res = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(key)}`, { method: "POST", body });
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: { display_url?: string; url?: string };
    error?: { message?: string };
  };

  const url = json.data?.display_url || json.data?.url;
  if (!json.success || !url) {
    return NextResponse.json({ error: json.error?.message ?? "Não foi possível enviar a imagem." }, { status: 400 });
  }

  return NextResponse.json({ url });
}
