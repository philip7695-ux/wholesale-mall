import { v2 as cloudinary } from "cloudinary"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export { cloudinary }

export function getOptimizedUrl(url: string, width = 800) {
  if (!url) return ""
  // Transform Cloudinary URL for auto optimization
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`)
}
