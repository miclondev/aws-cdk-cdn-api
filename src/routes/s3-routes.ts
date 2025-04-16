import express, { Request, Response, RequestHandler } from "express";
import multer from "multer";
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Get presigned URL for uploading a file
router.get("/presigned-url", (async (req: Request, res: Response) => {
  try {
    const { fileName, contentType } = req.query;

    if (!fileName || !contentType) {
      return res
        .status(400)
        .json({ error: "fileName and contentType are required" });
    }

    const s3Client = req.app.locals.s3Client;
    const bucketName = req.app.locals.bucketName;

    if (!bucketName) {
      return res.status(500).json({ error: "S3 bucket name not configured" });
    }

    const key = `uploads/${Date.now()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType as string,
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    });

    res.json({
      url: signedUrl,
      key,
    });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    res.status(500).json({ error: "Failed to generate presigned URL" });
  }
}) as RequestHandler);

// Upload file directly to S3
router.post("/upload", upload.single("file"), (async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const s3Client = req.app.locals.s3Client;
    const bucketName = req.app.locals.bucketName;

    if (!bucketName) {
      return res.status(500).json({ error: "S3 bucket name not configured" });
    }

    const key = `uploads/${Date.now()}-${req.file.originalname}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    });

    await s3Client.send(command);

    res.json({
      message: "File uploaded successfully",
      key,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ error: "Failed to upload file" });
  }
}) as RequestHandler);

// Get a presigned URL for downloading a file
router.get("/object/:key", (async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    const s3Client = req.app.locals.s3Client;
    const bucketName = req.app.locals.bucketName;

    if (!bucketName) {
      return res.status(500).json({ error: "S3 bucket name not configured" });
    }

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    });

    res.json({ url: signedUrl });
  } catch (error) {
    console.error("Error getting object URL:", error);
    res.status(500).json({ error: "Failed to get object URL" });
  }
}) as RequestHandler);

// List objects in the bucket
router.get("/list", (async (req: Request, res: Response) => {
  try {
    const { prefix = "uploads/", maxKeys = 100 } = req.query;

    const s3Client = req.app.locals.s3Client;
    const bucketName = req.app.locals.bucketName;

    if (!bucketName) {
      return res.status(500).json({ error: "S3 bucket name not configured" });
    }

    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix as string,
      MaxKeys: Number(maxKeys),
    });

    const response = await s3Client.send(command);

    res.json({
      objects: response.Contents || [],
    });
  } catch (error) {
    console.error("Error listing objects:", error);
    res.status(500).json({ error: "Failed to list objects" });
  }
}) as RequestHandler);

// Delete an object
router.delete("/object/:key", (async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    const s3Client = req.app.locals.s3Client;
    const bucketName = req.app.locals.bucketName;

    if (!bucketName) {
      return res.status(500).json({ error: "S3 bucket name not configured" });
    }

    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await s3Client.send(command);

    res.json({ message: "Object deleted successfully" });
  } catch (error) {
    console.error("Error deleting object:", error);
    res.status(500).json({ error: "Failed to delete object" });
  }
}) as RequestHandler);

export const s3Router = router;
