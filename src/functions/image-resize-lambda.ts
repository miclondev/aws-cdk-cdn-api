import { S3Event, S3Handler } from "aws-lambda";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { Readable } from "stream";

const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const bucketName = process.env.S3_BUCKET_NAME!;
const enableResize = process.env.ENABLE_IMAGE_RESIZE === "true";
const maxSizes = (process.env.MAX_SIZES || "150x300,500x600").split(",");

// Helper function to convert stream to buffer
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

// Check if file is an image based on content type
function isImage(contentType: string | undefined): boolean {
  if (!contentType) return false;
  return contentType.startsWith("image/");
}

export const handler: S3Handler = async (event: S3Event) => {
  // Skip processing if resizing is disabled
  if (!enableResize) {
    console.log("Image resizing is disabled. Skipping processing.");
    return;
  }

  try {
    for (const record of event.Records) {
      // Get object key and check if it's in the uploads folder
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

      // Skip already resized images to prevent infinite loops
      if (key.startsWith("resized/")) {
        console.log(`Skipping already resized image: ${key}`);
        continue;
      }

      console.log(`Processing: ${key}`);

      // Get the object from S3
      const getObjectParams = {
        Bucket: bucketName,
        Key: key,
      };

      const { Body, ContentType } = await s3Client.send(new GetObjectCommand(getObjectParams));

      // Skip if not an image
      if (!isImage(ContentType)) {
        console.log(`Skipping non-image file: ${key} (${ContentType})`);
        continue;
      }

      // Convert stream to buffer
      const imageBuffer = await streamToBuffer(Body as Readable);

      // Get original image metadata
      const metadata = await sharp(imageBuffer).metadata();
      console.log(
        `Original image: ${metadata.width}x${metadata.height}, format: ${metadata.format}`
      );

      // Process each size
      for (const sizeStr of maxSizes) {
        const [width, height] = sizeStr.split("x").map(Number);

        if (isNaN(width) || isNaN(height)) {
          console.error(`Invalid size format: ${sizeStr}`);
          continue;
        }

        console.log(`Resizing to ${width}x${height}`);

        // Resize image
        const resizedBuffer = await sharp(imageBuffer)
          .resize(width, height, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .toBuffer();

        // Generate new key for resized image
        const fileNameParts = key.split("/");
        const fileName = fileNameParts[fileNameParts.length - 1];
        const newKey = `resized/${width}x${height}/${fileName}`;

        // Upload resized image
        await s3Client.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: newKey,
            Body: resizedBuffer,
            ContentType: ContentType,
          })
        );

        console.log(`Uploaded resized image to ${newKey}`);
      }
    }
  } catch (error) {
    console.error("Error processing image:", error);
    throw error;
  }
};
