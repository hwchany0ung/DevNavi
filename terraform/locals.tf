locals {
  name_prefix = "${var.project}-${var.env}"

  common_tags = {
    Project     = var.project
    Environment = var.env
    ManagedBy   = "terraform"
  }

  # SSM Parameter 경로 prefix
  ssm_prefix = "/${var.project}/${var.env}"
}
