/**
 * 업로드 전에 브라우저에서 이미지를 줄인다.
 *
 * Vercel 은 요청 본문을 4.5MB 로 제한한다. 촬영 원본은 중앙값이 10MB,
 * 최대 16MB 라 그대로 보내면 서버 코드에 닿기도 전에 413 으로 끊긴다.
 *
 * 서버(lib/storage.ts)가 어차피 2000px·품질 자동으로 줄여 저장하므로,
 * 여기서 같은 크기로 미리 줄여도 최종 화질은 달라지지 않는다.
 */

const MAX_EDGE = 2000
const TARGET_BYTES = 3.5 * 1024 * 1024 // 4.5MB 한도에 여유를 둔다

export async function downscaleForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file
  // GIF 는 애니메이션이 깨지므로 건드리지 않는다
  if (file.type === "image/gif") return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file // 디코딩 실패 시 원본 그대로 (서버가 판단하게 둔다)
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const alreadySmall = scale === 1 && file.size <= TARGET_BYTES
  if (alreadySmall) {
    bitmap.close()
    return file
  }

  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    bitmap.close()
    return file
  }
  // 투명 PNG(누끼)를 JPEG 로 바꾸면 배경이 검게 나오므로 흰색을 깔아둔다
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  // 한도 안에 들어올 때까지 품질을 낮춘다
  for (const quality of [0.92, 0.85, 0.78, 0.7]) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    )
    if (!blob) break
    if (blob.size <= TARGET_BYTES || quality === 0.7) {
      const name = file.name.replace(/\.[^.]+$/, "") + ".jpg"
      return new File([blob], name, { type: "image/jpeg" })
    }
  }
  return file
}
