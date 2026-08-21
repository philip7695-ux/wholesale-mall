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

/**
 * 브라우저에서 Cloudinary 로 직접 올릴 때 쓰는 서명.
 *
 * 룩북 PDF 는 수십 MB 라 서버(Vercel 4.5MB 한도)를 거치면 실패한다.
 * 서버는 서명만 내주고 파일은 브라우저가 Cloudinary 로 바로 올린다.
 * API Secret 은 서명 계산에만 쓰이고 브라우저로 나가지 않는다.
 */
export function signUpload(params: Record<string, string | number>): {
  signature: string
  timestamp: number
  apiKey: string
  cloudName: string
} {
  configure()
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = cloudinary.utils.api_sign_request(
    { ...params, timestamp },
    process.env.CLOUDINARY_API_SECRET as string,
  )
  return {
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY as string,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME as string,
  }
}

/** Cloudinary 리소스를 지운다. 이미지가 아닌 파일(PDF 등)은 resourceType 지정. */
export async function deleteResource(
  publicId: string,
  resourceType: "image" | "raw" = "image",
): Promise<void> {
  configure()
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
}

/**
 * 룩북(PDF) 다운로드용 서명 URL.
 *
 * Cloudinary 는 2022 년부터 PDF/ZIP 전송을 계정 기본으로 막았다(전송 시 401).
 * 공개 delivery URL 대신 API secret 으로 서명한 download 엔드포인트를 쓰면
 * 그 제한을 우회해 원본을 그대로 받는다. 서명에는 timestamp 가 들어가 URL 은
 * 짧게만 유효하므로 매번 새로 만든다.
 */
export function lookbookDownloadUrl(publicId: string, filename?: string): string {
  configure()
  const attachment = filename ? filename.replace(/[^\w.\-가-힣 ]/g, "").slice(0, 80) : true
  // Cloudinary 타입은 attachment 를 boolean 으로만 보지만 실제로는 파일명
  // 문자열도 받는다. 다운로드 파일명을 지정하기 위해 캐스팅한다.
  return cloudinary.utils.private_download_url(publicId, "", {
    resource_type: "raw",
    type: "upload",
    attachment,
  } as Parameters<typeof cloudinary.utils.private_download_url>[2])
}
