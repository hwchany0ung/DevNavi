output "frontend_url" {
  description = "프론트엔드 접속 URL"
  value       = var.route53_zone_id != "" ? "https://${var.domain_name}" : "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "api_url" {
  description = "백엔드 API URL"
  value       = var.route53_zone_id != "" ? "https://api.${var.domain_name}" : "https://${aws_cloudfront_distribution.api.domain_name}"
}

output "s3_frontend_bucket" {
  description = "프론트엔드 S3 버킷 이름 (GitHub Actions Secrets에 등록)"
  value       = aws_s3_bucket.frontend.id
}

output "s3_lambda_bucket" {
  description = "Lambda 패키지 S3 버킷 이름 (GitHub Actions Secrets에 등록)"
  value       = aws_s3_bucket.lambda_packages.id
}

output "cloudfront_frontend_id" {
  description = "프론트엔드 CloudFront Distribution ID (GitHub Actions Secrets에 등록)"
  value       = aws_cloudfront_distribution.frontend.id
}

output "lambda_function_name" {
  description = "Lambda 함수 이름"
  value       = aws_lambda_function.api.function_name
}

output "lambda_function_url" {
  description = "Lambda Function URL (직접 접근 가능)"
  value       = aws_lambda_function_url.api.function_url
}

output "github_actions_access_key_id" {
  description = "GitHub Actions AWS_ACCESS_KEY_ID (GitHub Secrets에 등록)"
  value       = aws_iam_access_key.github_actions.id
}

output "github_actions_secret_access_key" {
  description = "GitHub Actions AWS_SECRET_ACCESS_KEY (GitHub Secrets에 등록)"
  value       = aws_iam_access_key.github_actions.secret
  sensitive   = true
}
