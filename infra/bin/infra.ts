#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { CdnApiStack } from "../lib/cdn-api-stack";

const app = new cdk.App();
new CdnApiStack(app, "CdnApiStack");
