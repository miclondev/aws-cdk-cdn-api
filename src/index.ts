import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { S3Client } from "@aws-sdk/client-s3";
import serverless from "serverless-http";
import { s3Router } from "./routes/s3-routes";

// Create Express app
const app = express();

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(
    JSON.stringify({
      method: req.method,
      path: req.path,
      query: req.query,
      timestamp: new Date().toISOString(),
    })
  );
  next();
});

// Middleware
app.use(cors());
app.use(express.json());

// Create S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
});
app.locals.s3Client = s3Client;
app.locals.bucketName = process.env.S3_BUCKET_NAME;

// Routes
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// S3 routes
app.use("/api/s3", s3Router);

// Handle unmatched routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not Found" });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err.message, err.stack);
  res.status(500).json({ error: "Internal server error" });
});

// Export for local testing
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export for AWS Lambda
export const handler = serverless(app);
