# AWS CDK Gallery App

A fully serverless Express API for S3 image operations, deployed and managed with AWS CDK.

## Features

- Upload images to S3
- Get signed URLs for client-side uploads
- List and delete images in the S3 bucket
- Automatic image resizing to multiple dimensions (configurable)
- All endpoints exposed via a secure, scalable REST API

## Architecture

This project uses AWS CDK to provision and manage the following resources:

- **S3 Bucket:** Stores uploaded images and files
- **Lambda Function (API):** Runs your Express API (via serverless-http)
- **Lambda Function (Image Resizing):** Automatically resizes uploaded images to configured dimensions
- **API Gateway HTTP API:** Exposes your API endpoints
- **CloudFront Distribution:** Serves S3 files globally and proxies `/api/*` requests to the API Gateway

All infrastructure is serverless and scales automatically. No EC2 or container servers are required.

## Environment Variables

The API Lambda function receives these environment variables (automatically set by CDK):
- `S3_BUCKET_NAME`: Name of the S3 bucket
- `AWS_REGION`: AWS region

The Image Resizing Lambda function receives these additional environment variables:
- `ENABLE_IMAGE_RESIZE`: Set to 'true' to enable image resizing, 'false' to disable
- `MAX_SIZES`: Comma-separated list of dimensions to resize images to (e.g., '150x300,500x600')

## Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run locally:

   ```bash
   npm run dev
   ```

## Deploying to AWS

1. Build the TypeScript code (output will be in `dist/`):

   ```bash
   npm run build
   ```

2. Bootstrap CDK (first time only):

   ```bash
   cd infra
   cdk bootstrap
   ```

3. Deploy:

   ```bash
   cd infra
   cdk deploy
   ```

## API Endpoints

All API endpoints are available under the `/api` path. Example endpoints:

- `POST   /api/s3/upload` — Upload a file directly to S3
- `GET    /api/s3/presigned-url` — Get a presigned URL for uploading
- `GET    /api/s3/object/:key` — Get a presigned URL for downloading
- `GET    /api/s3/list` — List objects in the bucket
- `DELETE /api/s3/object/:key` — Delete an object

## Security Notes

- **CORS:** By default, CORS is enabled for all origins. For production, restrict allowed origins in the CDK stack.
- **S3 Access:** The S3 bucket is private and only accessible by the Lambda functions and CloudFront. No public S3 access is allowed.
- **CloudFront:** Serves static files from S3 and proxies API requests to API Gateway. HTTPS is enforced.
- **API Gateway:** You can add authentication (e.g., Cognito, JWT) for protected endpoints.
- **Encryption:** S3 bucket encryption is enabled by default.
- **Image Processing:** The image resizing Lambda only processes files with image/* content types.

## Useful Commands

- `npm run build` — Compile TypeScript to `dist/`
- `npm run dev` — Run the Express app locally
- `cd infra && cdk deploy` — Deploy the stack to AWS

---

For more details, see the `infra/lib/cdn-api-stack.ts` file and the Express API source code in `src/`.

## Image Resizing

When enabled, the image resizing feature automatically creates multiple versions of each uploaded image at different dimensions. The resized images are stored in the S3 bucket with the following path structure:

```
resized/{width}x{height}/{original-filename}
```

For example, if you upload `cat.jpg` and have configured sizes of `150x300` and `500x600`, the following files will be created:

- `uploads/cat.jpg` (original)
- `resized/150x300/cat.jpg` (resized version)
- `resized/500x600/cat.jpg` (resized version)

You can access these resized images directly through CloudFront or via presigned URLs from the API.


- `GET /health` - Health check
- `GET /api/s3/presigned-url` - Get a presigned URL for client-side upload
- `POST /api/s3/upload` - Upload a file directly to S3
- `GET /api/s3/object/:key` - Get a presigned URL for downloading a file
- `GET /api/s3/list` - List objects in the bucket
- `DELETE /api/s3/object/:key` - Delete an object from S3

## Environment Variables

- `S3_BUCKET_NAME` - The name of the S3 bucket (set by CDK)
- `AWS_REGION` - AWS region (optional, defaults to us-east-1)
- `PORT` - Port for local development (optional, defaults to 3000)