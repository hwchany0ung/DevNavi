# ──────────────────────────────────────────────────────────────────────
# Lambda — FastAPI + Mangum 서버리스 백엔드
# ──────────────────────────────────────────────────────────────────────

# 첫 배포용 더미 zip (GitHub Actions가 실제 코드로 교체)
data "archive_file" "dummy" {
  type        = "zip"
  output_path = "${path.module}/.tmp/dummy.zip"

  source {
    content  = "# placeholder — GitHub Actions will replace this"
    filename = "main.py"
  }
}

resource "aws_lambda_function" "api" {
  function_name = "${local.name_prefix}-api"
  description   = "DevNavi FastAPI backend (Mangum)"

  # x86_64 — GitHub Actions 빌드 환경과 아키텍처 통일
  architectures = ["x86_64"]
  runtime       = "python3.12"
  handler       = "app.main.handler"

  memory_size = 512
  timeout     = 900  # 15분 — SSE 스트리밍 대응

  filename         = data.archive_file.dummy.output_path
  source_code_hash = data.archive_file.dummy.output_base64sha256

  role = aws_iam_role.lambda.arn

  environment {
    variables = {
      # production 모드 → config.py에서 SSM 자동 로드
      ENV                  = "production"
      POWERTOOLS_LOG_LEVEL = "INFO"
    }
  }

  # 코드 변경은 GitHub Actions가 담당 — Terraform은 인프라만 관리
  lifecycle {
    ignore_changes = [
      filename,
      source_code_hash,
      environment,
    ]
  }

  tags = local.common_tags
}

# ── Lambda Function URL (SSE 스트리밍 지원) ──────────────────────────
# API Gateway HTTP API 최대 타임아웃 29초 → SSE 불가
# Lambda Function URL은 900초 + RESPONSE_STREAM 지원

resource "aws_lambda_function_url" "api" {
  function_name      = aws_lambda_function.api.function_name
  # 인증: CloudFront → Lambda 요청 시 X-CF-Secret 헤더로 앱 레이어 인증.
  # IAM 인증(AWS_IAM)은 CloudFront Function URL 호출 시 SigV4 서명이
  # 불가능한 제약으로 미적용. CloudFrontSecretMiddleware(main.py)가 보호.
  authorization_type = "NONE"

  # Lambda URL이 CORS 단일 처리 (FastAPI CORSMiddleware는 개발 환경에서만 활성)
  # - OPTIONS preflight: Lambda URL이 자동 처리 (Lambda 도달 안 함)
  # - 실제 요청: Lambda URL이 Access-Control-Allow-Origin 헤더 추가
  cors {
    allow_credentials = true
    allow_headers     = ["content-type", "authorization"]
    allow_methods     = ["GET", "POST"]
    allow_origins     = ["https://devnavi.kr"]
    max_age           = 3600  # 1시간 — CORS 정책 변경 시 빠른 반영
  }

  # BUFFERED: Mangum이 Lambda Proxy JSON 형식으로 응답 → Function URL이 정상 해석
  # RESPONSE_STREAM 사용 시 Mangum JSON 자체가 스트림 body로 전달돼 SSE 파싱 불가
  # CloudFront 60초 origin timeout 대응: stream_full max_tokens ≤ 4000 유지
  invoke_mode = "BUFFERED"
}

# ── Lambda Function URL 퍼블릭 액세스 권한 ────────────────────────────
# 주의: AuthType=NONE 계정에서 공개 액세스를 위해 두 액션이 모두 필요
# lambda:InvokeFunction   — 일반 호출 권한
# lambda:InvokeFunctionUrl — Function URL 전용 호출 권한

resource "aws_lambda_permission" "allow_public_invoke" {
  statement_id  = "AllowPublicInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "*"
}

resource "aws_lambda_permission" "allow_public_invoke_url" {
  statement_id           = "AllowPublicInvokeFunctionUrl"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.api.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

# ── CloudWatch 로그 그룹 ─────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${aws_lambda_function.api.function_name}"
  retention_in_days = 30

  tags = local.common_tags
}

# ── Lambda 알람 — 에러율 5% 초과 시 알림 ────────────────────────────

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "${local.name_prefix}-lambda-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "Lambda 5분 내 에러 10회 초과"

  dimensions = {
    FunctionName = aws_lambda_function.api.function_name
  }

  tags = local.common_tags
}
