# ──────────────────────────────────────────────────────────────────────
# CloudFront — 프론트엔드(S3) + 백엔드(Lambda URL)
# 가비아 네임서버 사용 → aliases는 domain_name 입력 시 활성화
# ──────────────────────────────────────────────────────────────────────

# ── 프론트엔드 배포 ──────────────────────────────────────────────────

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_200"
  comment             = "${local.name_prefix} frontend"

  # domain_name 입력 시 커스텀 도메인 활성화
  # 주의: ACM 인증서가 ISSUED 상태일 때만 aliases 적용 가능
  aliases = var.domain_name != "" ? [
    var.domain_name,
    "www.${var.domain_name}"
  ] : []

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

  # domain_name 없으면 기본 CloudFront 인증서 사용 (xxxx.cloudfront.net)
  # domain_name 있으면 ACM 인증서 사용 (ISSUED 상태 필수)
  dynamic "viewer_certificate" {
    for_each = var.domain_name != "" ? [1] : []
    content {
      acm_certificate_arn      = aws_acm_certificate.main[0].arn
      ssl_support_method       = "sni-only"
      minimum_protocol_version = "TLSv1.2_2021"
    }
  }

  dynamic "viewer_certificate" {
    for_each = var.domain_name == "" ? [1] : []
    content {
      cloudfront_default_certificate = true
    }
  }

  tags = local.common_tags
}

# ── 백엔드 API 배포 ──────────────────────────────────────────────────

resource "aws_cloudfront_distribution" "api" {
  enabled         = true
  is_ipv6_enabled = true
  price_class     = "PriceClass_200"
  comment         = "${local.name_prefix} API (Lambda URL)"
  aliases         = var.domain_name != "" ? ["api.${var.domain_name}"] : []

  origin {
    # trimsuffix로 trailing slash 제거
    domain_name = trimsuffix(
      replace(aws_lambda_function_url.api.function_url, "https://", ""),
      "/"
    )
    origin_id = "LambdaURL-${aws_lambda_function.api.function_name}"

    # Lambda Function URL 직접 접근 차단용 시크릿 헤더
    # cloudfront_secret 변수가 설정된 경우에만 헤더 추가
    dynamic "custom_header" {
      for_each = var.cloudfront_secret != "" ? [1] : []
      content {
        name  = "X-CF-Secret"
        value = var.cloudfront_secret
      }
    }

    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "https-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_keepalive_timeout = 60
      # SSE 스트리밍 응답 대기 시간 (CloudFront 최대값)
      # Lambda SSE에서 55초마다 keepalive 이벤트 전송으로 대응
      origin_read_timeout = 60
    }
  }

  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "LambdaURL-${aws_lambda_function.api.function_name}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = false

    # CachingDisabled: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad
    # AllViewerExceptHostHeader: b689b0a8-53d0-40ab-baf2-68738e2966ac
    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  dynamic "viewer_certificate" {
    for_each = var.domain_name != "" ? [1] : []
    content {
      acm_certificate_arn      = aws_acm_certificate.main[0].arn
      ssl_support_method       = "sni-only"
      minimum_protocol_version = "TLSv1.2_2021"
    }
  }

  dynamic "viewer_certificate" {
    for_each = var.domain_name == "" ? [1] : []
    content {
      cloudfront_default_certificate = true
    }
  }

  tags = local.common_tags
}
