# ──────────────────────────────────────────────────────────────────────
# ACM 인증서 — CloudFront는 반드시 us-east-1
# 가비아 네임서버 사용 → DNS 검증 레코드 수동 등록 필요
# ──────────────────────────────────────────────────────────────────────

resource "aws_acm_certificate" "main" {
  provider = aws.us_east_1

  domain_name               = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = local.common_tags
}

# ──────────────────────────────────────────────────────────────────────
# terraform apply 후 수동 작업 (가비아 DNS 관리 페이지):
#
# 1. AWS 콘솔 → Certificate Manager (us-east-1) → 인증서 선택
#    → "도메인" 탭에서 CNAME 이름/값 확인 (devnavi.kr, *.devnavi.kr 각 1개)
#
# 2. 가비아 → My가비아 → 도메인 → DNS 관리 → CNAME 레코드 추가
#    호스트: _xxxx.devnavi.kr  →  값: _yyyy.acm-validations.aws
#    (ACM이 제공하는 값으로 교체)
#
# 3. 수분~수시간 후 인증서 상태가 ISSUED로 변경됨
#    → 이후 terraform apply 재실행하면 CloudFront aliases 적용
# ──────────────────────────────────────────────────────────────────────
