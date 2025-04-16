import express from "express";
import cors from "cors";
import { S3Client } from "@aws-sdk/client-s3";
import serverless from "serverless-http";
import { s3Router } from "./routes/s3-routes";

// Create Express app
const app = express();

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
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// S3 routes
app.use("/api/s3", s3Router);

// Handle unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
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
