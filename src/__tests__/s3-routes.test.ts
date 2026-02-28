import express from "express";
import { s3Router } from "../routes/s3-routes";

// Mock the AWS SDK modules
jest.mock("@aws-sdk/client-s3", () => {
  return {
    PutObjectCommand: jest.fn(),
    GetObjectCommand: jest.fn(),
    DeleteObjectCommand: jest.fn(),
    ListObjectsV2Command: jest.fn(),
  };
});

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn().mockResolvedValue("https://signed-url.example.com"),
}));

function createApp(options?: { bucketName?: string | null }) {
  const app = express();
  app.use(express.json());
  app.locals.s3Client = {
    send: jest.fn().mockResolvedValue({
      Contents: [{ Key: "uploads/test.jpg", Size: 1024, LastModified: new Date() }],
    }),
  };
  const bucket = options?.bucketName === null ? undefined : (options?.bucketName ?? "test-bucket");
  app.locals.bucketName = bucket;
  app.use("/api/s3", s3Router);
  return app;
}

// Use dynamic import for supertest-like testing via http
import http from "http";

function request(
  app: express.Express,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        return reject(new Error("Could not get server address"));
      }

      const options: http.RequestOptions = {
        hostname: "127.0.0.1",
        port: addr.port,
        path,
        method: method.toUpperCase(),
        headers: { "Content-Type": "application/json" },
      };

      const req = http.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          server.close();
          try {
            resolve({ status: res.statusCode || 500, body: JSON.parse(data) });
          } catch {
            resolve({
              status: res.statusCode || 500,
              body: { raw: data } as Record<string, unknown>,
            });
          }
        });
      });

      req.on("error", (err) => {
        server.close();
        reject(err);
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  });
}

describe("S3 Routes", () => {
  describe("GET /api/s3/presigned-url", () => {
    it("should return 400 when fileName is missing", async () => {
      const app = createApp();
      const res = await request(app, "GET", "/api/s3/presigned-url?contentType=image/jpeg");
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("fileName and contentType are required");
    });

    it("should return 400 when contentType is missing", async () => {
      const app = createApp();
      const res = await request(app, "GET", "/api/s3/presigned-url?fileName=test.jpg");
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("fileName and contentType are required");
    });

    it("should return a presigned URL when params are valid", async () => {
      const app = createApp();
      const res = await request(
        app,
        "GET",
        "/api/s3/presigned-url?fileName=test.jpg&contentType=image/jpeg"
      );
      expect(res.status).toBe(200);
      expect(res.body.url).toBe("https://signed-url.example.com");
      expect(res.body.key).toMatch(/^uploads\/\d+-test\.jpg$/);
    });

    it("should sanitize fileName with path traversal", async () => {
      const app = createApp();
      const res = await request(
        app,
        "GET",
        "/api/s3/presigned-url?fileName=../../etc/passwd&contentType=text/plain"
      );
      expect(res.status).toBe(200);
      expect(res.body.key).not.toContain("..");
      expect(res.body.key).toMatch(/^uploads\/\d+-passwd$/);
    });

    it("should return 500 when bucket name is not configured", async () => {
      const app = createApp({ bucketName: null });
      const res = await request(
        app,
        "GET",
        "/api/s3/presigned-url?fileName=test.jpg&contentType=image/jpeg"
      );
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("S3 bucket name not configured");
    });
  });

  describe("GET /api/s3/object", () => {
    it("should return 400 when key is missing", async () => {
      const app = createApp();
      const res = await request(app, "GET", "/api/s3/object");
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("key query parameter is required");
    });

    it("should return a presigned download URL", async () => {
      const app = createApp();
      const res = await request(app, "GET", "/api/s3/object?key=uploads/test.jpg");
      expect(res.status).toBe(200);
      expect(res.body.url).toBe("https://signed-url.example.com");
    });
  });

  describe("GET /api/s3/list", () => {
    it("should list objects with default params", async () => {
      const app = createApp();
      const res = await request(app, "GET", "/api/s3/list");
      expect(res.status).toBe(200);
      expect(res.body.objects).toBeDefined();
      expect(Array.isArray(res.body.objects)).toBe(true);
    });

    it("should return 500 when bucket name is not configured", async () => {
      const app = createApp({ bucketName: null });
      const res = await request(app, "GET", "/api/s3/list");
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("S3 bucket name not configured");
    });
  });

  describe("DELETE /api/s3/object", () => {
    it("should return 400 when key is missing", async () => {
      const app = createApp();
      const res = await request(app, "DELETE", "/api/s3/object");
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("key query parameter is required");
    });

    it("should delete an object successfully", async () => {
      const app = createApp();
      const res = await request(app, "DELETE", "/api/s3/object?key=uploads/test.jpg");
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Object deleted successfully");
    });
  });
});
