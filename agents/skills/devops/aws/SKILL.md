---
name: aws
description: AWS cloud services expertise covering compute, storage, networking, databases, and serverless. Covers EC2, S3, RDS, Lambda, ECS, and IAM best practices.
category: devops
compatible_with:
  - terraform
  - docker
  - kubernetes
---

# AWS Cloud Services

## Instructions

1. **Assess the cloud architecture need**: Serverless, containers, or traditional compute.
2. **Follow AWS best practices**:
   - Least privilege IAM
   - Encryption at rest and in transit
   - Multi-AZ for high availability
   - Use managed services when possible
3. **Provide complete configurations**: Include IAM policies, security groups, and CLI commands.
4. **Guide on cost optimization**: Right-sizing, reserved instances, spot instances.

## Core Services Overview

| Category | Services |
|----------|----------|
| Compute | EC2, Lambda, ECS, EKS, Fargate |
| Storage | S3, EBS, EFS |
| Database | RDS, DynamoDB, ElastiCache, Aurora |
| Networking | VPC, ALB/NLB, Route 53, CloudFront |
| Security | IAM, KMS, Secrets Manager, WAF |
| Monitoring | CloudWatch, X-Ray, CloudTrail |

## IAM Best Practices

### IAM Policy Structure

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowS3ReadAccess",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::my-bucket",
        "arn:aws:s3:::my-bucket/*"
      ],
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "us-east-1"
        }
      }
    }
  ]
}
```

### Role for EC2

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ec2.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

### Role for Lambda

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

## Lambda Functions

### Basic Lambda (Node.js)

```javascript
// index.mjs
export const handler = async (event, context) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    const result = await processEvent(event);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: result })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' })
    };
  }
};
```

### Lambda with API Gateway

```yaml
# SAM template
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  MyFunction:
    Type: AWS::Serverless::Function
    Properties:
      Runtime: nodejs20.x
      Handler: index.handler
      CodeUri: ./src
      MemorySize: 256
      Timeout: 30
      Environment:
        Variables:
          TABLE_NAME: !Ref MyTable
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref MyTable
      Events:
        Api:
          Type: Api
          Properties:
            Path: /items
            Method: GET
```

## ECS/Fargate

### Task Definition

```json
{
  "family": "my-app",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::123456789:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::123456789:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "app",
      "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/my-app:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:db-url"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/my-app",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3
      }
    }
  ]
}
```

## S3 Operations

### AWS CLI

```bash
# Sync files
aws s3 sync ./dist s3://my-bucket/
aws s3 sync s3://my-bucket ./local --delete

# Copy with metadata
aws s3 cp file.txt s3://my-bucket/ \
  --content-type "text/plain" \
  --cache-control "max-age=31536000"

# Presigned URL
aws s3 presign s3://my-bucket/file.txt --expires-in 3600
```

### S3 SDK (Node.js)

```javascript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const client = new S3Client({ region: 'us-east-1' });

// Upload
await client.send(new PutObjectCommand({
  Bucket: 'my-bucket',
  Key: 'path/to/file.json',
  Body: JSON.stringify(data),
  ContentType: 'application/json'
}));

// Presigned URL
const url = await getSignedUrl(client, new GetObjectCommand({
  Bucket: 'my-bucket',
  Key: 'path/to/file.pdf'
}), { expiresIn: 3600 });
```

## RDS Best Practices

### Connection Pooling (Lambda)

```javascript
import { RDSDataClient, ExecuteStatementCommand } from '@aws-sdk/client-rds-data';

// Use RDS Data API for serverless
const client = new RDSDataClient({ region: 'us-east-1' });

const result = await client.send(new ExecuteStatementCommand({
  resourceArn: process.env.DB_CLUSTER_ARN,
  secretArn: process.env.DB_SECRET_ARN,
  database: 'mydb',
  sql: 'SELECT * FROM users WHERE id = :id',
  parameters: [{ name: 'id', value: { longValue: userId } }]
}));
```

### Connection String

```javascript
// Standard connection (for EC2/ECS)
const connectionString = `postgresql://${user}:${password}@${host}:5432/${database}?sslmode=require`;
```

## CloudWatch

### Custom Metrics

```javascript
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const client = new CloudWatchClient({ region: 'us-east-1' });

await client.send(new PutMetricDataCommand({
  Namespace: 'MyApp',
  MetricData: [{
    MetricName: 'ProcessingTime',
    Value: 150,
    Unit: 'Milliseconds',
    Dimensions: [{
      Name: 'Environment',
      Value: 'production'
    }]
  }]
}));
```

### Log Insights Query

```
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100
```

## Secrets Manager

```javascript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });

const response = await client.send(new GetSecretValueCommand({
  SecretId: 'prod/db/credentials'
}));

const secret = JSON.parse(response.SecretString);
// { username: '...', password: '...' }
```

## Common CLI Commands

```bash
# EC2
aws ec2 describe-instances --filters "Name=tag:Environment,Values=production"
aws ec2 start-instances --instance-ids i-1234567890abcdef0
aws ec2 stop-instances --instance-ids i-1234567890abcdef0

# ECS
aws ecs list-clusters
aws ecs list-services --cluster my-cluster
aws ecs update-service --cluster my-cluster --service my-service --force-new-deployment
aws ecs describe-tasks --cluster my-cluster --tasks task-arn

# Lambda
aws lambda invoke --function-name my-function output.json
aws lambda update-function-code --function-name my-function --zip-file fileb://function.zip
aws logs tail /aws/lambda/my-function --follow

# CloudWatch
aws logs get-log-events --log-group-name /ecs/my-app --log-stream-name ecs/app/xxx
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --dimensions Name=InstanceId,Value=i-xxx \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Average

# SSM Parameter Store
aws ssm get-parameter --name /myapp/config --with-decryption
aws ssm put-parameter --name /myapp/config --value "value" --type SecureString
```

## Security Best Practices

1. **Never hardcode credentials** - Use IAM roles, environment variables, or Secrets Manager
2. **Enable encryption** - S3 default encryption, RDS encryption, EBS encryption
3. **Use VPC endpoints** - Keep traffic within AWS network
4. **Enable CloudTrail** - Audit all API calls
5. **Least privilege** - Minimal IAM permissions
6. **Multi-AZ** - For production workloads
7. **Security groups** - Whitelist, don't blacklist
8. **WAF** - Protect public endpoints

## Cost Optimization

- **Right-size instances** - Use CloudWatch metrics to identify
- **Reserved Instances** - 1-3 year commitments for steady workloads
- **Spot Instances** - For fault-tolerant, flexible workloads
- **S3 lifecycle policies** - Move to Glacier for archival
- **Lambda** - Pay per invocation vs always-on EC2
- **Auto Scaling** - Scale down during off-hours

## References

- AWS Documentation: https://docs.aws.amazon.com/
- AWS CLI Reference: https://awscli.amazonaws.com/v2/documentation/api/latest/index.html
- AWS SDK for JavaScript: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/
- AWS Well-Architected: https://aws.amazon.com/architecture/well-architected/
