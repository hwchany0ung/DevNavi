# ──────────────────────────────────────────────────────────────────────
# IAM — Lambda 실행 역할 + GitHub Actions 배포 사용자
# ──────────────────────────────────────────────────────────────────────

# ── Lambda 실행 역할 ─────────────────────────────────────────────────

resource "aws_iam_role" "lambda" {
  name = "${local.name_prefix}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

# CloudWatch Logs 기본 권한
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# SSM Parameter Store 읽기 권한 (최소 권한 원칙)
resource "aws_iam_role_policy" "lambda_ssm" {
  name = "${local.name_prefix}-lambda-ssm"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath"
      ]
      Resource = "arn:aws:ssm:${var.aws_region}:*:parameter${local.ssm_prefix}/*"
    }]
  })
}

# ── GitHub Actions 배포 사용자 ───────────────────────────────────────

resource "aws_iam_user" "github_actions" {
  name = "${local.name_prefix}-github-actions"
  tags = local.common_tags
}

resource "aws_iam_access_key" "github_actions" {
  user = aws_iam_user.github_actions.name
}

resource "aws_iam_user_policy" "github_actions" {
  name = "${local.name_prefix}-github-actions-policy"
  user = aws_iam_user.github_actions.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # S3 프론트엔드 버킷 배포 권한
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.frontend.arn,
          "${aws_s3_bucket.frontend.arn}/*"
        ]
      },
      # S3 Lambda 패키지 버킷 업로드 권한
      {
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:GetObject"]
        Resource = "${aws_s3_bucket.lambda_packages.arn}/*"
      },
      # CloudFront 캐시 무효화
      {
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation"]
        Resource = aws_cloudfront_distribution.frontend.arn
      },
      # Lambda 코드 업데이트
      {
        Effect   = "Allow"
        Action   = ["lambda:UpdateFunctionCode", "lambda:GetFunction"]
        Resource = aws_lambda_function.api.arn
      }
    ]
  })
}
