"""월간 리포트 diff 생성 + SMTP 이메일 발송."""
import smtplib
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from scripts.config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, NOTIFY_EMAIL


def build_report(
    run_id: str,
    diffs: dict[str, tuple[str, bool]],  # role -> (diff_text, changed)
    stats: dict,
    elapsed_seconds: float,
) -> str:
    today = datetime.now().strftime("%Y년 %m월 %d일")
    lines = [
        f"[DevNavi] 월간 기술 트렌드 리포트 -- {today}",
        "",
        "=" * 48,
        "수집 현황",
        "=" * 48,
        f"  워크넷 채용공고 분석: {stats.get('worknet_total', 0)}건",
        f"  테크 블로그 포스트: {stats.get('blog_total', 0)}건",
        f"  npm/PyPI 패키지 통계: 직군별 상위 패키지",
        f"  실행 시간: {elapsed_seconds:.0f}초",
        "",
        "=" * 48,
        "직군별 변경사항",
        "=" * 48,
    ]

    changed_roles = []
    unchanged_roles = []
    for role, (diff_text, changed) in diffs.items():
        if changed:
            changed_roles.append((role, diff_text))
        else:
            unchanged_roles.append(role)

    for role, diff_text in changed_roles:
        lines.append(f"\n[{role}] 변경됨")
        lines.append(diff_text)

    if unchanged_roles:
        lines.append(f"\n[변경 없음] {', '.join(unchanged_roles)}")

    lines += [
        "",
        "=" * 48,
        "롤백 필요 시",
        "=" * 48,
        "POST https://api.devnavi.kr/admin/references/{role}/rollback",
        "Authorization: Bearer {ADMIN_TOKEN}",
        "",
        f"파이프라인 실행 ID: {run_id}",
    ]
    return "\n".join(lines)


def send_email(subject: str, body: str) -> bool:
    """SMTP로 이메일 발송. 설정 없으면 스킵하고 False 반환."""
    if not all([SMTP_USER, SMTP_PASSWORD, NOTIFY_EMAIL]):
        print("  [notifier] SMTP 설정 없음 -- 이메일 발송 스킵")
        return False
    try:
        msg = MIMEMultipart()
        msg["From"]    = SMTP_USER
        msg["To"]      = NOTIFY_EMAIL
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain", "utf-8"))

        import ssl
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        if SMTP_PORT == 465:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context) as server:
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SMTP_USER, NOTIFY_EMAIL, msg.as_string())
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.starttls(context=context)
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SMTP_USER, NOTIFY_EMAIL, msg.as_string())
        print(f"  [notifier] 이메일 발송 완료 -> {NOTIFY_EMAIL}")
        return True
    except Exception as e:
        print(f"  [notifier] 이메일 발송 실패: {e}")
        return False
