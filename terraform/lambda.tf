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

  # Graviton2 (ARM64) — x86 대비 20% 저렴, 동일 성능
  architectures = ["arm64"]
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
  authorization_type = "NONE"  # CloudFront에서 인증 처리

  cors {
    allow_credentials = true
    # domain_name 없으면 * (테스트용), 있으면 특정 오리진만 허용
    allow_origins = var.domain_name != "" ? ["https://${var.domain_name}"] : ["*"]
    # Lambda Function URL은 OPTIONS 자동 처리 — GET/POST만 명시
    allow_methods = ["GET", "POST"]
    allow_headers = ["Content-Type", "Authorization"]
    max_age       = 86400
  }

  invoke_mode = "RESPONSE_STREAM"
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
