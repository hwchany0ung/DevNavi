# ──────────────────────────────────────────────────────────────────────
# SSM Parameter Store — Lambda 환경변수 시크릿 관리
# ──────────────────────────────────────────────────────────────────────

resource "aws_ssm_parameter" "anthropic_api_key" {
  name        = "${local.ssm_prefix}/ANTHROPIC_API_KEY"
  description = "Anthropic Claude API Key"
  type        = "SecureString"
  value       = var.anthropic_api_key

  tags = local.common_tags
}

resource "aws_ssm_parameter" "supabase_url" {
  name        = "${local.ssm_prefix}/SUPABASE_URL"
  description = "Supabase Project URL"
  type        = "String"
  value       = var.supabase_url

  tags = local.common_tags
}

resource "aws_ssm_parameter" "supabase_service_key" {
  name        = "${local.ssm_prefix}/SUPABASE_SERVICE_KEY"
  description = "Supabase Service Role Key (RLS 우회)"
  type        = "SecureString"
  value       = var.supabase_service_key

  tags = local.common_tags
}

resource "aws_ssm_parameter" "supabase_anon_key" {
  name        = "${local.ssm_prefix}/SUPABASE_ANON_KEY"
  description = "Supabase Anon Key (프론트엔드용)"
  type        = "SecureString"
  value       = var.supabase_anon_key

  tags = local.common_tags
}

resource "aws_ssm_parameter" "supabase_jwt_secret" {
  name        = "${local.ssm_prefix}/SUPABASE_JWT_SECRET"
  description = "Supabase JWT Secret (토큰 검증)"
  type        = "SecureString"
  value       = var.supabase_jwt_secret

  tags = local.common_tags
}

resource "aws_ssm_parameter" "cors_origins" {
  name        = "${local.ssm_prefix}/CORS_ORIGINS"
  description = "허용 CORS 오리진 목록 (JSON 배열)"
  type        = "String"
  value       = jsonencode(["https://${var.domain_name}"])

  tags = local.common_tags
}

resource "aws_ssm_parameter" "env" {
  name        = "${local.ssm_prefix}/ENV"
  description = "배포 환경"
  type        = "String"
  value       = "production"

  tags = local.common_tags
}

# CLOUDFRONT_SECRET: 설정 시 Lambda가 X-CF-Secret 헤더 없는 직접 요청 차단.
# CloudFront custom_header와 반드시 동일한 값이어야 함.
# 비어있으면 SSM 파라미터 생성 안 함 (검증 비활성화).
resource "aws_ssm_parameter" "cloudfront_secret" {
  count = var.cloudfront_secret != "" ? 1 : 0

  name        = "${local.ssm_prefix}/CLOUDFRONT_SECRET"
  description = "CloudFront → Lambda 요청 인증 시크릿"
  type        = "SecureString"
  value       = var.cloudfront_secret

  tags = local.common_tags
}
