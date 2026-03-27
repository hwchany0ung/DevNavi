# ──────────────────────────────────────────────────────────────────────
# CloudFront — 프론트엔드(S3) + 백엔드(Lambda URL)
# ──────────────────────────────────────────────────────────────────────

# ── 프론트엔드 배포 ──────────────────────────────────────────────────

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_200" # 북미+유럽+아시아 (All보다 저렴)
  comment             = "${local.name_prefix} frontend"

  # fix: www 서브도메인도 aliases에 포함 (누락 시 421 에러)
  aliases = var.route53_zone_id != "" ? [
    var.domain_name,
    "www.${var.domain_name}"
  ] : []

  # fix: 인증서 검증 완료 후 배포 생성
  depends_on = [aws_acm_certificate_validation.main]

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.frontend.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  # 기본 캐시 동작 — 정적 assets (해시 포함, 1년 캐시)
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.frontend.id}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    min_ttl     = 0
    default_ttl = 86400
    max_ttl     = 31536000
  }

  # index.html: 캐시 없음 (항상 최신 React 앱 로드)
  ordered_cache_behavior {
    path_pattern           = "/index.html"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.frontend.id}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  # SPA 라우팅 — 404/403 → index.html (React Router 지원)
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.main.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = local.common_tags
}

# ── 백엔드 API 배포 ──────────────────────────────────────────────────

resource "aws_cloudfront_distribution" "api" {
  enabled         = true
  is_ipv6_enabled = true
  price_class     = "PriceClass_200"
  comment         = "${local.name_prefix} API (Lambda URL)"
  aliases         = var.route53_zone_id != "" ? ["api.${var.domain_name}"] : []

  # fix: 인증서 검증 완료 후 배포 생성
  depends_on = [aws_acm_certificate_validation.main]

  origin {
    # fix: trimsuffix로 trailing slash 제거 (없으면 CloudFront origin 오류)
    # Lambda URL 형식: https://xxx.lambda-url.region.on.aws/
    domain_name = trimsuffix(
      replace(aws_lambda_function_url.api.function_url, "https://", ""),
      "/"
    )
    origin_id = "LambdaURL-${aws_lambda_function.api.function_name}"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      # fix: keepalive_timeout 추가 (Python 콜드스타트 대응)
      origin_keepalive_timeout = 60
      # SSE 스트리밍 응답 대기 시간 (CloudFront 최대값)
      # 주의: 60초마다 keepalive SSE 이벤트 전송 필요 (": keepalive\n\n")
      origin_read_timeout = 60
    }
  }

  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "LambdaURL-${aws_lambda_function.api.function_name}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = false # SSE 스트리밍 영향 방지

    # fix: cache_policy_id 사용 시 TTL 직접 지정 불가 (충돌 오류)
    # CachingDisabled: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad
    # AllViewerExceptHostHeader: b689b0a8-53d0-40ab-baf2-68738e2966ac
    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
    # min_ttl / default_ttl / max_ttl 제거 (cache_policy_id와 상호 배타적)
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.main.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = local.common_tags
}
