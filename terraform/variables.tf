variable "aws_region" {
  description = "AWS 기본 리전"
  type        = string
  default     = "ap-northeast-2"
}

variable "project" {
  description = "프로젝트 이름 (리소스 네이밍 prefix)"
  type        = string
  default     = "devnavi"
}

variable "env" {
  description = "배포 환경"
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["prod", "staging"], var.env)
    error_message = "env는 prod 또는 staging 이어야 합니다."
  }
}

variable "domain_name" {
  description = "서비스 도메인 (Route 53 호스팅 존 필요)"
  type        = string
  default     = "devnavi.kr"
}

variable "route53_zone_id" {
  description = "Route 53 호스팅 존 ID (도메인 구매 후 입력)"
  type        = string
  default     = ""
}

# ── 시크릿 (terraform.tfvars 또는 환경변수로 주입) ──────────────────
variable "anthropic_api_key" {
  description = "Anthropic Claude API 키"
  type        = string
  sensitive   = true
}

variable "supabase_url" {
  description = "Supabase 프로젝트 URL"
  type        = string
  sensitive   = true
}

variable "supabase_service_key" {
  description = "Supabase Service Role Key"
  type        = string
  sensitive   = true
}

variable "supabase_anon_key" {
  description = "Supabase Anon Key"
  type        = string
  sensitive   = true
}

variable "supabase_jwt_secret" {
  description = "Supabase JWT Secret"
  type        = string
  sensitive   = true
}
