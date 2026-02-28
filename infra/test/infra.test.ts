import * as cdk from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import { CdnApiStack } from "../lib/cdn-api-stack";

let template: ReturnType<typeof Template.fromStack>;

beforeAll(() => {
  const app = new cdk.App();
  const stack = new CdnApiStack(app, "MyTestStack");
  template = Template.fromStack(stack);
});

describe("CDN API Stack", () => {
  test("creates expected resource counts", () => {
    template.resourceCountIs("AWS::S3::Bucket", 1);
    // 2 app Lambdas + auto-delete-objects + S3 notification custom resources
    template.resourceCountIs("AWS::Lambda::Function", 4);
    template.resourceCountIs("AWS::ApiGatewayV2::Api", 1);
    template.resourceCountIs("AWS::CloudFront::Distribution", 1);
  });

  test("Lambda functions use Node.js 22 runtime", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Runtime: "nodejs22.x",
      Handler: "index.handler",
    });
    template.hasResourceProperties("AWS::Lambda::Function", {
      Runtime: "nodejs22.x",
      Handler: "functions/image-resize-lambda.handler",
    });
  });

  test("API Lambda has correct environment variables", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.handler",
      Environment: {
        Variables: {
          S3_BUCKET_NAME: Match.anyValue(),
        },
      },
    });
  });

  test("Image resize Lambda has correct environment variables", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "functions/image-resize-lambda.handler",
      Environment: {
        Variables: {
          S3_BUCKET_NAME: Match.anyValue(),
          ENABLE_IMAGE_RESIZE: "true",
          MAX_SIZES: "150x300,500x600",
        },
      },
    });
  });

  test("S3 bucket has CORS configured", () => {
    template.hasResourceProperties("AWS::S3::Bucket", {
      CorsConfiguration: {
        CorsRules: [
          {
            AllowedMethods: Match.arrayWith(["GET", "PUT", "POST", "DELETE"]),
            AllowedOrigins: ["*"],
            AllowedHeaders: ["*"],
          },
        ],
      },
    });
  });

  test("CloudFront distribution has OAC configured", () => {
    template.resourceCountIs(
      "AWS::CloudFront::OriginAccessControl",
      1
    );
  });

  test("stack produces expected outputs", () => {
    template.hasOutput("BucketName", {});
    template.hasOutput("ApiEndpoint", {});
    template.hasOutput("CloudFrontUrl", {});
    template.hasOutput("ImageResizingEnabled", { Value: "true" });
    template.hasOutput("ImageSizes", { Value: "150x300,500x600" });
  });
});
