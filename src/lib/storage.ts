import { v2 as cloudinary } from "cloudinary"

/**
 * 이미지 저장소. Cloudinary 를 사용한다.
 *
 * 이전에는 Supabase Storage 를 썼으나 프로젝트가 삭제되어(DNS NXDOMAIN)
 * 업로드가 전부 `fetch failed` 로 실패했다. Cloudinary 는 업로드 시점에
 * 리사이즈·포맷 변환·CDN 전송을 함께 처리한다.
 */

let configured = false

function configure() {
  if (configured) return
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary 환경변수가 설정되지 않았습니다. " +
        "CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET 을 확인하세요.",
    )
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  })
  configured = true
}

export interface UploadOptions {
  /** Cloudinary 폴더 (예: "products", "receipts") */
  folder?: string
  /** 긴 변 최대 픽셀. 지정하면 업로드 시점에 축소한다 */
  maxDimension?: number
}

/**
 * 버퍼를 업로드하고 공개 URL 을 돌려준다.
 * 실패하면 예외를 던진다(호출부에서 파일 단위로 처리).
 */
export async function uploadImage(
  buffer: Buffer,
  { folder = "products", maxDimension = 2000 }: UploadOptions = {},
): Promise<string> {
  configure()

  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        // 원본이 커도 저장 시점에 줄여 대역폭과 용량을 아낀다
        transformation: [
          { width: maxDimension, height: maxDimension, crop: "limit" },
          { quality: "auto:good", fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error) return reject(new Error(error.message || "Cloudinary 업로드 실패"))
        if (!result?.secure_url) return reject(new Error("Cloudinary 응답에 URL 이 없습니다."))
        resolve(result.secure_url)
      },
    )
    stream.end(buffer)
  })
}
