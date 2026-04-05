"""
CloudWatch 알람 설정 스크립트 (1회 실행).

Lambda 5xx 에러율 급증 시 이메일 알림을 설정한다.

사용법:
  python scripts/setup_cloudwatch_alarms.py \
    --function-name devnavi-prod \
    --email your@email.com \
    --region ap-northeast-2

필요 IAM 권한:
  cloudwatch:PutMetricAlarm
  cloudwatch:DescribeAlarms
  sns:CreateTopic
  sns:Subscribe
  logs:PutMetricFilter (Lambda 로그 기반 알람 사용 시)
"""
import argparse
import sys

import boto3


def setup_alarms(function_name: str, email: str, region: str) -> None:
    cw = boto3.client("cloudwatch", region_name=region)
    sns = boto3.client("sns", region_name=region)

    # ── 1. SNS 토픽 생성 (이미 있으면 기존 ARN 반환) ─────────────
    topic_name = "devnavi-security-alerts"
    topic_resp = sns.create_topic(Name=topic_name)
    topic_arn = topic_resp["TopicArn"]
    print(f"SNS 토픽: {topic_arn}")

    # ── 2. 이메일 구독 (최초 실행 시 확인 메일 발송됨) ───────────
    sns.subscribe(TopicArn=topic_arn, Protocol="email", Endpoint=email)
    print(f"이메일 구독 등록: {email} (확인 메일을 확인하세요)")

    # ── 3. Lambda 5xx 에러율 알람 ────────────────────────────────
    # Lambda Errors 메트릭: 함수가 처리 중 예외를 던진 횟수
    cw.put_metric_alarm(
        AlarmName=f"{function_name}-errors-high",
        AlarmDescription="Lambda 5xx 에러 급증 — 공격 또는 장애 가능성",
        Namespace="AWS/Lambda",
        MetricName="Errors",
        Dimensions=[{"Name": "FunctionName", "Value": function_name}],
        Statistic="Sum",
        Period=300,          # 5분
        EvaluationPeriods=1,
        Threshold=10,        # 5분 내 10건 초과
        ComparisonOperator="GreaterThanThreshold",
        AlarmActions=[topic_arn],
        OKActions=[topic_arn],
        TreatMissingData="notBreaching",
    )
    print(f"알람 생성: {function_name}-errors-high (5분 내 에러 10건 초과)")

    # ── 4. Lambda 동시 실행 수 급증 알람 (DDoS 조기 탐지) ────────
    cw.put_metric_alarm(
        AlarmName=f"{function_name}-concurrency-spike",
        AlarmDescription="Lambda 동시 실행 급증 — DDoS 또는 트래픽 폭주 가능성",
        Namespace="AWS/Lambda",
        MetricName="ConcurrentExecutions",
        Dimensions=[{"Name": "FunctionName", "Value": function_name}],
        Statistic="Maximum",
        Period=60,           # 1분
        EvaluationPeriods=2,
        Threshold=50,        # 동시 실행 50 초과
        ComparisonOperator="GreaterThanThreshold",
        AlarmActions=[topic_arn],
        TreatMissingData="notBreaching",
    )
    print(f"알람 생성: {function_name}-concurrency-spike (동시 실행 50 초과)")

    # ── 5. Lambda 스로틀 알람 (한도 초과 탐지) ───────────────────
    cw.put_metric_alarm(
        AlarmName=f"{function_name}-throttles",
        AlarmDescription="Lambda 스로틀 발생 — 동시 실행 한도 초과",
        Namespace="AWS/Lambda",
        MetricName="Throttles",
        Dimensions=[{"Name": "FunctionName", "Value": function_name}],
        Statistic="Sum",
        Period=300,
        EvaluationPeriods=1,
        Threshold=5,
        ComparisonOperator="GreaterThanThreshold",
        AlarmActions=[topic_arn],
        TreatMissingData="notBreaching",
    )
    print(f"알람 생성: {function_name}-throttles (5분 내 스로틀 5건 초과)")

    print("\n✅ CloudWatch 알람 설정 완료")
    print("   → SNS 구독 확인 이메일을 반드시 승인하세요 (스팸함 확인)")
    print(f"   → 알람 확인: https://{region}.console.aws.amazon.com/cloudwatch/home?region={region}#alarmsV2:")


def main():
    parser = argparse.ArgumentParser(description="DevNavi CloudWatch 알람 설정")
    parser.add_argument("--function-name", required=True, help="Lambda 함수 이름 (예: devnavi-prod)")
    parser.add_argument("--email", required=True, help="알람 수신 이메일")
    parser.add_argument("--region", default="ap-northeast-2", help="AWS 리전 (기본: ap-northeast-2)")
    args = parser.parse_args()

    try:
        setup_alarms(args.function_name, args.email, args.region)
    except Exception as e:
        print(f"오류: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
