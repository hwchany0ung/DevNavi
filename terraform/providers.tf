terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
  }

  # 원격 상태 저장 — 배포 전 S3 버킷/DynamoDB 직접 생성 후 주석 해제
  # backend "s3" {
  #   bucket         = "devnavi-terraform-state"
  #   key            = "prod/terraform.tfstate"
  #   region         = "ap-northeast-2"
  #   dynamodb_table = "devnavi-terraform-locks"
  #   encrypt        = true
  # }
}

# 기본 리전 — 서울
provider "aws" {
  region = var.aws_region
}

# ACM 인증서는 반드시 us-east-1 (CloudFront 전용)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
