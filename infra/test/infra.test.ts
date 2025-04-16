import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { CdnApiStack } from '../lib/cdn-api-stack';

test('CDN API Stack Resources Created', () => {
  const app = new cdk.App();
  // WHEN
  const stack = new CdnApiStack(app, 'MyTestStack');
  // THEN

  const template = Template.fromStack(stack);

  // Test for S3 bucket
  template.resourceCountIs('AWS::S3::Bucket', 1);
  
  // Test for Lambda functions
  template.resourceCountIs('AWS::Lambda::Function', 2);
  
  // Test for API Gateway
  template.resourceCountIs('AWS::ApiGatewayV2::Api', 1);
  
  // Test for CloudFront distribution
  template.resourceCountIs('AWS::CloudFront::Distribution', 1);
});
