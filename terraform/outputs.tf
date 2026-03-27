output "frontend_url" {
  description = "프론트엔드 접속 URL"
  value       = var.route53_zone_id != "" ? "https://${var.domain_name}" : "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "api_url" {
  description = "백엔드 API URL"
  value       = var.route53_zone_id != "" ? "https://api.${var.domain_name}" : "https://${aws_cloudfront_distribution.api.domain_name}"
}

output "s3_frontend_bucket" {
  description = "프론트엔드 S3 버킷 이름 (GitHub Actions Secret: S3_BUCKET)"
  value       = aws_s3_bucket.frontend.id
}

output "s3_lambda_bucket" {
  description = "Lambda 패키지 S3 버킷 이름 (GitHub Actions Secret: S3_LAMBDA_BUCKET)"
  value       = aws_s3_bucket.lambda_packages.id
}

output "cloudfront_frontend_id" {
  description = "프론트엔드 CloudFront Distribution ID (GitHub Actions Secret: CF_FRONTEND_DIST_ID)"
  value       = aws_cloudfront_distribution.frontend.id
}

output "lambda_function_name" {
  description = "Lambda 함수 이름"
  value       = aws_lambda_function.api.function_name
}

output "lambda_function_url" {
  description = "Lambda Function URL (직접 접근 가능 — 임시 테스트용)"
  value       = aws_lambda_function_url.api.function_url
}

# fix: IAM User + Access Key 제거 → OIDC Role ARN 출력으로 대체
# GitHub Actions에서 role-to-assume에 이 ARN 등록
output "github_actions_role_arn" {
  description = "GitHub Actions OIDC Role ARN (GitHub Actions Secret: AWS_ROLE_ARN)"
  value       = aws_iam_role.github_actions.arn
}
