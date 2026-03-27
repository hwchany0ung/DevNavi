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
  description = <<-EOT
    서비스 도메인 (예: devnavi.kr)
    - 비워두면: CloudFront 기본 도메인(xxxx.cloudfront.net)으로 동작
    - 입력하면: ACM 인증서 + CloudFront aliases 활성화
    단계별 사용:
      1단계) "" → 도메인 없이 먼저 배포/테스트
      2단계) "devnavi.kr" → ACM 인증서 ISSUED 후 terraform apply 재실행
  EOT
  type    = string
  default = ""
}

variable "github_repo" {
  description = "GitHub 저장소 (owner/repo 형식, OIDC 신뢰 정책에 사용)"
  type        = string
  default     = "hwchany0ung/DevNavi"
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

variable "cloudfront_secret" {
  description = <<-EOT
    CloudFront → Lambda 요청 인증용 시크릿 헤더 값.
    CloudFront가 origin 요청 시 X-CF-Secret 헤더에 이 값을 포함.
    Lambda는 이 값이 없는 직접 요청을 403으로 차단.
    미설정 시 검증 비활성화 (로컬 개발 환경).
    예시: openssl rand -hex 32
  EOT
  type      = string
  sensitive = true
  default   = ""
}
