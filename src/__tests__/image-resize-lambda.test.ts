import { Readable } from "stream";

// Mock sharp before importing the handler
const mockSharp = {
  metadata: jest.fn().mockResolvedValue({ width: 1000, height: 800, format: "jpeg" }),
  resize: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from("resized-image")),
};

jest.mock("sharp", () => {
  return jest.fn(() => mockSharp);
});

// Mock S3 client
const mockSend = jest.fn();
jest.mock("@aws-sdk/client-s3", () => {
  return {
    S3Client: jest.fn(() => ({ send: mockSend })),
    GetObjectCommand: jest.fn(),
    PutObjectCommand: jest.fn(),
  };
});

// Set env vars before importing handler
process.env.S3_BUCKET_NAME = "test-bucket";
process.env.ENABLE_IMAGE_RESIZE = "true";
process.env.MAX_SIZES = "150x300,500x600";

import { handler } from "../functions/image-resize-lambda";
import type { S3Event, Context, Callback } from "aws-lambda";

function createS3Event(key: string): S3Event {
  return {
    Records: [
      {
        eventVersion: "2.0",
        eventSource: "aws:s3",
        awsRegion: "us-east-1",
        eventTime: "2024-01-01T00:00:00.000Z",
        eventName: "ObjectCreated:Put",
        userIdentity: { principalId: "test" },
        requestParameters: { sourceIPAddress: "127.0.0.1" },
        responseElements: {
          "x-amz-request-id": "test",
          "x-amz-id-2": "test",
        },
        s3: {
          s3SchemaVersion: "1.0",
          configurationId: "test",
          bucket: {
            name: "test-bucket",
            ownerIdentity: { principalId: "test" },
            arn: "arn:aws:s3:::test-bucket",
          },
          object: {
            key: encodeURIComponent(key),
            size: 1024,
            eTag: "test",
            sequencer: "test",
          },
        },
      },
    ],
  };
}

function createImageStream(): Readable {
  const stream = new Readable();
  stream.push(Buffer.from("fake-image-data"));
  stream.push(null);
  return stream;
}

describe("Image Resize Lambda", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockReset();
  });

  it("should process an uploaded image and create resized versions", async () => {
    mockSend
      .mockResolvedValueOnce({
        Body: createImageStream(),
        ContentType: "image/jpeg",
      })
      .mockResolvedValue({});

    const event = createS3Event("uploads/test-image.jpg");
    await handler(event, {} as Context, (() => {}) as Callback);

    // Should have called GetObject once + PutObject for each size (2 sizes)
    expect(mockSend).toHaveBeenCalledTimes(3);
  });

  it("should skip files in resized/ prefix", async () => {
    const event = createS3Event("resized/150x300/test-image.jpg");
    await handler(event, {} as Context, (() => {}) as Callback);

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("should skip non-image files", async () => {
    mockSend.mockResolvedValueOnce({
      Body: createImageStream(),
      ContentType: "application/pdf",
    });

    const event = createS3Event("uploads/document.pdf");
    await handler(event, {} as Context, (() => {}) as Callback);

    // Should only call GetObject, not PutObject
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("should resize to correct dimensions", async () => {
    mockSend
      .mockResolvedValueOnce({
        Body: createImageStream(),
        ContentType: "image/png",
      })
      .mockResolvedValue({});

    const event = createS3Event("uploads/photo.png");
    await handler(event, {} as Context, (() => {}) as Callback);

    expect(mockSharp.resize).toHaveBeenCalledWith(150, 300, {
      fit: "inside",
      withoutEnlargement: true,
    });
    expect(mockSharp.resize).toHaveBeenCalledWith(500, 600, {
      fit: "inside",
      withoutEnlargement: true,
    });
  });
});
