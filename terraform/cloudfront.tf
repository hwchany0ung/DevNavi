# ──────────────────────────────────────────────────────────────────────
# CloudFront — 프론트엔드(S3) + 백엔드(Lambda URL)
# ──────────────────────────────────────────────────────────────────────

# ── 프론트엔드 배포 ──────────────────────────────────────────────────

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_200"  # 북미+유럽+아시아 (All보다 저렴)
  comment             = "${local.name_prefix} frontend"
  aliases             = var.route53_zone_id != "" ? [var.domain_name] : []

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.frontend.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  # 기본 캐시 동작 — 정적 assets
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

    # assets (해시 포함): 1년 캐시
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

  origin {
    # Lambda Function URL에서 https:// 제거
    domain_name = replace(aws_lambda_function_url.api.function_url, "https://", "")
    origin_id   = "LambdaURL-${aws_lambda_function.api.function_name}"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      # SSE 스트리밍 응답 대기 시간 (최대 60초)
      origin_read_timeout    = 60
    }
  }

  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "LambdaURL-${aws_lambda_function.api.function_name}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = false  # API 응답 압축 비활성 (SSE 스트리밍 영향 방지)

    # API는 캐시 비활성 (모든 요청 오리진 통과)
    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"  # CachingDisabled
    origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac"  # AllViewerExceptHostHeader

    # SSE 스트리밍을 위한 응답 대기 시간
    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
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
