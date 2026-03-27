# ──────────────────────────────────────────────────────────────────────
# Route 53 — DNS 레코드
# route53_zone_id 입력 시에만 생성 (도메인 구매 전이면 비워두기)
# ──────────────────────────────────────────────────────────────────────

# devnavi.kr → 프론트엔드 CloudFront
resource "aws_route53_record" "frontend" {
  count = var.route53_zone_id != "" ? 1 : 0

  zone_id = var.route53_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
    evaluate_target_health = false
  }
}

# www.devnavi.kr → 프론트엔드 CloudFront (리디렉션)
resource "aws_route53_record" "frontend_www" {
  count = var.route53_zone_id != "" ? 1 : 0

  zone_id = var.route53_zone_id
  name    = "www.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
    evaluate_target_health = false
  }
}

# api.devnavi.kr → 백엔드 API CloudFront
resource "aws_route53_record" "api" {
  count = var.route53_zone_id != "" ? 1 : 0

  zone_id = var.route53_zone_id
  name    = "api.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.api.domain_name
    zone_id                = aws_cloudfront_distribution.api.hosted_zone_id
    evaluate_target_health = false
  }
}
