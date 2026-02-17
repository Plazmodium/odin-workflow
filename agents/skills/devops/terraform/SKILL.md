---
name: terraform
description: Terraform Infrastructure as Code expertise for provisioning and managing cloud resources. Covers HCL syntax, modules, state management, and multi-cloud deployments.
category: devops
compatible_with:
  - aws
  - docker
  - kubernetes
---

# Terraform Infrastructure as Code

## Instructions

1. **Assess the infrastructure need**: Single resource, module, or complete environment.
2. **Follow Terraform best practices**:
   - Use modules for reusability
   - Remote state with locking
   - Use workspaces or directories for environments
   - Version pin providers
3. **Provide complete configurations**: Include variables, outputs, and provider setup.
4. **Guide on state management**: Remote backends, state locking, import/migration.

## Basic Structure

```hcl
# main.tf
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      ManagedBy   = "Terraform"
      Project     = var.project_name
    }
  }
}
```

```hcl
# variables.tf
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "project_name" {
  description = "Project name for tagging"
  type        = string
}
```

```hcl
# outputs.tf
output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnets" {
  description = "Public subnet IDs"
  value       = aws_subnet.public[*].id
}
```

## Common Resources

### VPC and Networking

```hcl
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project_name}-vpc"
  }
}

resource "aws_subnet" "public" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-public-${count.index + 1}"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
}
```

### EC2 Instance

```hcl
resource "aws_instance" "app" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public[0].id
  vpc_security_group_ids = [aws_security_group.app.id]
  key_name               = aws_key_pair.deployer.key_name

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
    encrypted   = true
  }

  user_data = <<-EOF
    #!/bin/bash
    yum update -y
    yum install -y docker
    systemctl start docker
  EOF

  tags = {
    Name = "${var.project_name}-app"
  }
}

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}
```

### Security Group

```hcl
resource "aws_security_group" "app" {
  name        = "${var.project_name}-app-sg"
  description = "Security group for application"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

### RDS Database

```hcl
resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-db"
  engine         = "postgres"
  engine_version = "16.1"
  instance_class = "db.t3.micro"

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  vpc_security_group_ids = [aws_security_group.db.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name

  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  skip_final_snapshot = var.environment != "prod"
  deletion_protection = var.environment == "prod"

  tags = {
    Name = "${var.project_name}-db"
  }
}
```

### S3 Bucket

```hcl
resource "aws_s3_bucket" "assets" {
  bucket = "${var.project_name}-assets-${var.environment}"
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket                  = aws_s3_bucket.assets.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```

## Modules

### Creating a Module

```hcl
# modules/vpc/main.tf
variable "name" {
  type = string
}

variable "cidr_block" {
  type    = string
  default = "10.0.0.0/16"
}

resource "aws_vpc" "this" {
  cidr_block           = var.cidr_block
  enable_dns_hostnames = true

  tags = {
    Name = var.name
  }
}

output "vpc_id" {
  value = aws_vpc.this.id
}
```

### Using a Module

```hcl
module "vpc" {
  source = "./modules/vpc"

  name       = "my-vpc"
  cidr_block = "10.0.0.0/16"
}

module "vpc_from_registry" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.0.0"

  name = "my-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["us-east-1a", "us-east-1b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]

  enable_nat_gateway = true
}
```

## Common Commands

```bash
# Initialize
terraform init
terraform init -upgrade  # Upgrade providers

# Plan
terraform plan
terraform plan -out=tfplan  # Save plan
terraform plan -var="environment=prod"

# Apply
terraform apply
terraform apply tfplan  # Apply saved plan
terraform apply -auto-approve  # Skip confirmation

# Destroy
terraform destroy
terraform destroy -target=aws_instance.app  # Specific resource

# State management
terraform state list
terraform state show aws_instance.app
terraform state mv aws_instance.old aws_instance.new
terraform state rm aws_instance.app  # Remove from state
terraform import aws_instance.app i-1234567890abcdef0

# Format and validate
terraform fmt -recursive
terraform validate

# Output
terraform output
terraform output vpc_id
```

## Environment Management

### Using Workspaces

```bash
terraform workspace new staging
terraform workspace new production
terraform workspace select staging
terraform workspace list
```

```hcl
# Use workspace in config
locals {
  environment = terraform.workspace
}

resource "aws_instance" "app" {
  instance_type = terraform.workspace == "production" ? "t3.large" : "t3.micro"
}
```

### Using Directories (Recommended)

```
infrastructure/
├── modules/
│   └── vpc/
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars
│   ├── staging/
│   └── prod/
```

## Data Sources

```hcl
# Get existing resources
data "aws_vpc" "existing" {
  id = "vpc-12345678"
}

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

# Use in resources
resource "aws_subnet" "new" {
  vpc_id = data.aws_vpc.existing.id
  # ...
}
```

## Best Practices

- **Remote state** - Never store state locally for team projects
- **State locking** - Use DynamoDB for AWS, or built-in for Terraform Cloud
- **Sensitive variables** - Mark with `sensitive = true`
- **Module versions** - Pin to specific versions
- **Provider versions** - Use `~>` for minor version flexibility
- **Resource naming** - Use consistent naming conventions
- **Tagging** - Apply tags for cost tracking and management
- **Small, focused changes** - Don't change everything at once

## Sensitive Data

```hcl
variable "db_password" {
  type      = string
  sensitive = true
}

# Or use AWS Secrets Manager
data "aws_secretsmanager_secret_version" "db" {
  secret_id = "prod/db/password"
}

resource "aws_db_instance" "main" {
  password = data.aws_secretsmanager_secret_version.db.secret_string
}
```

## References

- Terraform Documentation: https://developer.hashicorp.com/terraform/docs
- AWS Provider: https://registry.terraform.io/providers/hashicorp/aws/latest/docs
- Terraform Registry: https://registry.terraform.io/
