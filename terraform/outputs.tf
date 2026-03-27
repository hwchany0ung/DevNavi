output "frontend_url" {
  description = "프론트엔드 접속 URL"
  value       = var.domain_name != "" ? "https://${var.domain_name}" : "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "api_url" {
  description = "백엔드 API URL"
  value       = var.domain_name != "" ? "https://api.${var.domain_name}" : "https://${aws_cloudfront_distribution.api.domain_name}"
}

# ── 가비아 DNS 등록용 CloudFront 도메인 ──────────────────────────────
# terraform apply 후 아래 값을 가비아 DNS 관리 페이지에 CNAME으로 등록

output "cloudfront_frontend_domain" {
  description = "가비아 CNAME 등록값 — @ 및 www 레코드에 사용"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "cloudfront_api_domain" {
  description = "가비아 CNAME 등록값 — api 서브도메인 레코드에 사용"
  value       = aws_cloudfront_distribution.api.domain_name
}

# ── S3 / Lambda / CloudFront ID (GitHub Actions Secrets 등록용) ──────

output "s3_frontend_bucket" {
  description = "GitHub Actions Secret: S3_BUCKET"
  value       = aws_s3_bucket.frontend.id
}

output "s3_lambda_bucket" {
  description = "GitHub Actions Secret: S3_LAMBDA_BUCKET"
  value       = aws_s3_bucket.lambda_packages.id
}

output "cloudfront_frontend_id" {
  description = "GitHub Actions Secret: CF_FRONTEND_DIST_ID"
  value       = aws_cloudfront_distribution.frontend.id
}

output "lambda_function_name" {
  description = "Lambda 함수 이름"
  value       = aws_lambda_function.api.function_name
}

output "lambda_function_url" {
  description = "Lambda Function URL (임시 테스트용 직접 접근)"
  value       = aws_lambda_function_url.api.function_url
}

output "github_actions_role_arn" {
  description = "GitHub Actions Secret: AWS_ROLE_ARN"
  value       = aws_iam_role.github_actions.arn
}
