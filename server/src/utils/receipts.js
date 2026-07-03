import { v2 as cloudinary } from "cloudinary";

function cloudinaryConfigured() {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

export async function storeReceipt(receiptImage) {
  if (!receiptImage?.data) return undefined;

  if (!cloudinaryConfigured()) {
    return receiptImage;
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const upload = await cloudinary.uploader.upload(receiptImage.data, {
    folder: "ledge/receipts",
    resource_type: "image",
  });

  return {
    name: receiptImage.name,
    type: receiptImage.type,
    data: upload.secure_url,
    publicId: upload.public_id,
  };
}
