# AWS CDK Gallery App

A serverless Express API for S3 image operations: upload, list, delete, and automatic image resizing. Built with AWS CDK, Lambda, S3, API Gateway, and CloudFront.

## Features

- Upload images to S3 (direct upload or presigned URL)
- List and delete objects in the bucket
- Automatic image resizing to configurable dimensions (Sharp)
- REST API behind CloudFront with HTTPS

## Prerequisites

- **Node.js 22** (or 20+)
- **npm**
- **AWS account** (for deployment)
- **AWS CLI** (optional; for local credentials — see [Setting up credentials](#setting-up-aws-credentials))

## Quick start

```bash
# Clone and install
git clone <repo-url>
cd aws-cdk-cdn-api
npm install

# Run locally (see Local development for .env)
npm run dev

# Run tests
npm test
cd infra && npm test
```

---

## Setting up AWS credentials

You need credentials to deploy or to run the app locally against a real S3 bucket.

### Option 1: AWS CLI (recommended for local use)

1. Install the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) (e.g. `brew install awscli` on macOS).
2. Run:

   ```bash
   aws configure
   ```

3. Enter your **Access Key ID**, **Secret Access Key**, and **Default region** (e.g. `us-east-1`).  
   Keys are created in the AWS Console: IAM → Users → your user → Security credentials → Create access key.

### Option 2: Environment variables

```bash
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
export AWS_DEFAULT_REGION=us-east-1
```

### Option 3: GitHub Actions (CI/CD)

For deployments from GitHub Actions, use OIDC (no long‑lived keys in the repo):

1. In AWS IAM, add an **OpenID Connect** identity provider:  
   URL `https://token.actions.githubusercontent.com`, audience `sts.amazonaws.com`.
2. Create an **IAM role** with trust policy for `token.actions.githubusercontent.com`, restrict to your repo (e.g. `repo:YOUR_ORG/aws-cdk-cdn-api:*`), and attach permissions for CloudFormation, S3, Lambda, API Gateway, CloudFront, IAM.
3. In the GitHub repo: **Settings → Secrets and variables → Actions**, add:
   - `AWS_ROLE_ARN` — the role ARN (e.g. `arn:aws:iam::123456789012:role/github-actions-cdn-api`)
   - `AWS_REGION` — e.g. `us-east-1`

---

## Local development

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy the example env file and set at least the bucket name (use an existing S3 bucket in your account, or deploy the stack once and use the bucket name from the stack output):

   ```bash
   cp .env.example .env
   # Edit .env and set S3_BUCKET_NAME=your-bucket-name
   ```

3. **Run the app**

   ```bash
   npm run dev
   ```

   The API runs at `http://localhost:3000`. Use the [API examples](#using-the-api) below with `http://localhost:3000` as the base URL.

---

## Deploying to AWS

### First-time setup

1. **Build the app**

   ```bash
   npm run build
   ```

2. **Install infra dependencies and bootstrap CDK** (once per account/region)

   ```bash
   cd infra
   npm ci
   npx cdk bootstrap
   ```

3. **Deploy**

   ```bash
   npx cdk deploy
   ```

   Approve the changes when prompted. When it finishes, the stack outputs include:

   - **CloudFrontUrl** — base URL for the app and static files
   - **ApiEndpoint** — API Gateway URL (also reachable via CloudFront at `/api/*`)
   - **BucketName** — S3 bucket name

### Subsequent deploys

From the repo root:

```bash
npm run build
cd infra
npm ci
npx cdk deploy
```

### Deploy to a specific account/region

```bash
cd infra
npx cdk deploy -c account=123456789012 -c region=us-west-2
```

Or set `AWS_PROFILE` or `AWS_DEFAULT_REGION` before running `cdk deploy`.

### Remove the stack

```bash
cd infra
npx cdk destroy
```

### Automated deploy (GitHub Actions)

- Push to `main` or `master` runs the deploy workflow (if `AWS_ROLE_ARN` and `AWS_REGION` secrets are set).
- You can also run it manually: **Actions → Deploy CDK Stack → Run workflow**.

The workflow runs tests, builds, then runs `cdk deploy`.

---

## Using the API

After deployment, the public base URL is the **CloudFront URL** from the stack output (e.g. `https://d1234abcd.cloudfront.net`). For local dev, use `http://localhost:3000`.

Replace `BASE_URL` in the examples with either.

### Health check

```bash
curl BASE_URL/health
```

### Get a presigned URL for upload (client-side upload)

```bash
curl "BASE_URL/api/s3/presigned-url?fileName=photo.jpg&contentType=image/jpeg"
# Response: { "url": "...", "key": "uploads/1234567890-photo.jpg" }
# Use the url with PUT to upload the file; save the key for later.
```

### Upload a file (server-side)

```bash
curl -X POST -F "file=@/path/to/image.jpg" BASE_URL/api/s3/upload
# Response: { "message": "File uploaded successfully", "key": "uploads/..." }
```

### List objects

```bash
curl "BASE_URL/api/s3/list?prefix=uploads/&maxKeys=100"
# Response: { "objects": [ { "Key": "...", "Size": ..., "LastModified": "..." }, ... ] }
```

### Get a presigned URL for download

```bash
curl "BASE_URL/api/s3/object?key=uploads/1234567890-photo.jpg"
# Response: { "url": "https://..." }
# Use the url in a browser or with curl to download.
```

### Delete an object

```bash
curl -X DELETE "BASE_URL/api/s3/object?key=uploads/1234567890-photo.jpg"
# Response: { "message": "Object deleted successfully" }
```

### Resized images

When image resizing is enabled, uploads under `uploads/` trigger automatic resizing. Resized files are stored at:

- `resized/150x300/<filename>`
- `resized/500x600/<filename>`

Use the same **list** and **object** endpoints with these keys to get presigned URLs for resized images.

---

## API reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/s3/presigned-url?fileName=&contentType=` | Presigned URL for upload |
| POST | `/api/s3/upload` | Upload file (form field: `file`, max 10MB) |
| GET | `/api/s3/object?key=` | Presigned URL for download |
| GET | `/api/s3/list?prefix=uploads/&maxKeys=100` | List objects |
| DELETE | `/api/s3/object?key=` | Delete object |

---

## Environment variables

| Variable | Where | Description |
|----------|--------|-------------|
| `S3_BUCKET_NAME` | CDK / .env | S3 bucket name (required for API) |
| `AWS_REGION` | Lambda runtime | Set automatically in Lambda |
| `ENABLE_IMAGE_RESIZE` | CDK (Image Resize Lambda) | `true` / `false` |
| `MAX_SIZES` | CDK (Image Resize Lambda) | e.g. `150x300,500x600` |
| `PORT` | Local dev | Server port (default `3000`) |

---

## Architecture

- **S3** — Stores uploads and resized images (private; access via presigned URLs and CloudFront).
- **Lambda (API)** — Express app (serverless-http) handling REST endpoints.
- **Lambda (Image Resize)** — Triggered by S3 `uploads/` prefix; resizes with Sharp.
- **API Gateway HTTP API** — Fronts the API Lambda.
- **CloudFront** — Serves S3 objects and proxies `/api/*` to API Gateway (HTTPS).

---

## Useful commands

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run dev` | Run Express app locally |
| `npm test` | Run application tests |
| `npm run lint` | Lint source |
| `npm run format` | Format with Prettier |
| `npm run test:all` | Run app + infra tests |
| `cd infra && npm test` | Run CDK stack tests |
| `cd infra && npx cdk deploy` | Deploy stack |
| `cd infra && npx cdk destroy` | Delete stack |
| `cd infra && npx cdk diff` | Show deploy diff |

---

## Image resizing

Resized images are written to `resized/{width}x{height}/{filename}`. Sizes are set in the CDK stack (`MAX_SIZES`). Sharp runs inside Lambda; for manual deploys, install Sharp for Lambda’s platform so the build matches the runtime:

```bash
npm install --platform=linux --arch=x64 --include=optional sharp
```

The GitHub Actions workflow does this automatically.

---

## Security notes

- **CORS** — Default allows all origins; restrict in the CDK stack for production.
- **S3** — Bucket is private; access via presigned URLs and CloudFront only.
- **Upload limit** — 10MB per file (multer limit in the API).
- **File names** — Sanitized to prevent path traversal in S3 keys.

For more detail, see `infra/lib/cdn-api-stack.ts` and the source in `src/`.
