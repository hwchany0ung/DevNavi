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
