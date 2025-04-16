import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as path from "path";

export class CdnApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 bucket for uploads
    const bucket = new s3.Bucket(this, "UploadsBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
          ],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
        },
      ],
    });

    // Lambda function for Express API
    const apiLambda = new lambda.Function(this, "ApiLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler", // adjust if your build output is different
      code: lambda.Code.fromAsset(path.join(__dirname, "../../dist")),
      environment: {
        S3_BUCKET_NAME: bucket.bucketName,
        AWS_REGION: cdk.Stack.of(this).region,
      },
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
    });

    bucket.grantReadWrite(apiLambda);

    // API Gateway HTTP API
    const httpApi = new apigwv2.HttpApi(this, "HttpApi", {
      corsPreflight: {
        allowHeaders: ["*"],
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
        allowOrigins: ["*"],
      },
    });

    httpApi.addRoutes({
      path: "/{proxy+}",
      methods: [apigwv2.HttpMethod.ANY],
      integration: new integrations.HttpLambdaIntegration(
        "LambdaIntegration",
        apiLambda
      ),
    });

    // CloudFront distribution
    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: new origins.S3Origin(bucket),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        "api/*": {
          origin: new origins.HttpOrigin(
            cdk.Fn.select(2, cdk.Fn.split("/", httpApi.apiEndpoint)),
            {
              protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            }
          ),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
      },
    });

    // Image Resizing Lambda
    const imageResizeLambda = new lambda.Function(this, "ImageResizeLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "functions/image-resize-lambda.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../../dist")),
      environment: {
        S3_BUCKET_NAME: bucket.bucketName,
        AWS_REGION: cdk.Stack.of(this).region,
        ENABLE_IMAGE_RESIZE: "true", // Can be overridden with environment variable
        MAX_SIZES: "150x300,500x600", // Can be overridden with environment variable
      },
      memorySize: 1024,
      timeout: cdk.Duration.seconds(60),
    });

    // Grant the Lambda function permissions to read and write to the S3 bucket
    bucket.grantReadWrite(imageResizeLambda);

    // Add S3 event notification to trigger the Lambda function when objects are created
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(imageResizeLambda)
    );

    // Output useful values
    new cdk.CfnOutput(this, "BucketName", { value: bucket.bucketName });
    new cdk.CfnOutput(this, "ApiEndpoint", { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, "CloudFrontUrl", {
      value: `https://${distribution.domainName}`,
    });
    new cdk.CfnOutput(this, "ImageResizingEnabled", { value: "true" });
    new cdk.CfnOutput(this, "ImageSizes", { value: "150x300,500x600" });
  }
}
