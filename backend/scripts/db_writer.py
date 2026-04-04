"""Supabase pipeline_runs / reference_sources / role_references 관리."""
import difflib
from datetime import datetime, timezone
from scripts import sb_client as sb

ALL_ROLES = ["backend", "frontend", "cloud_devops", "fullstack",
             "data", "ai_ml", "security", "ios_android", "qa"]


def create_pipeline_run(triggered_by: str) -> str:
    """pipeline_runs 레코드 생성 후 id 반환."""
    rows = sb.post("pipeline_runs", {
        "triggered_by": triggered_by,
        "status": "running",
    })
    return rows[0]["id"] if isinstance(rows, list) else rows["id"]


def update_pipeline_run(run_id: str, status: str, error: str | None = None) -> None:
    sb.patch("pipeline_runs",
             params={"id": f"eq.{run_id}"},
             data={
                 "status": status,
                 "finished_at": datetime.now(tz=timezone.utc).isoformat(),
                 **({"error": error} if error else {}),
             })


def save_source(run_id: str, role: str, source_data: dict) -> None:
    """reference_sources에 원본 수집 데이터 저장."""
    sb.post("reference_sources", {
        "pipeline_run_id": run_id,
        "role": role,
        "source_type": source_data["source"],
        "raw_stats": source_data,
    })


def get_next_version(role: str) -> int:
    rows = sb.get("role_references",
                  params={"role": f"eq.{role}", "select": "version",
                          "order": "version.desc", "limit": "1"})
    if not rows:
        return 1
    return rows[0]["version"] + 1


def get_active_content(role: str) -> str:
    """현재 활성 role_references 텍스트 반환. 없으면 빈 문자열."""
    rows = sb.get("role_references",
                  params={"role": f"eq.{role}", "is_active": "eq.true",
                          "select": "content", "limit": "1"})
    return rows[0]["content"] if rows else ""


def build_diff(old: str, new: str) -> str:
    """두 텍스트의 diff를 사람이 읽기 쉬운 형태로 반환."""
    old_lines = old.splitlines()
    new_lines = new.splitlines()
    diff = list(difflib.unified_diff(old_lines, new_lines,
                                     fromfile="이전", tofile="신규", lineterm=""))
    return "\n".join(diff[:50]) if diff else "(변경 없음)"


def save_new_version(run_id: str, role: str, content: str) -> tuple[str, bool]:
    """새 버전 저장 + 이전 버전과 동일하면 저장 스킵.

    Returns:
        (diff_text, changed: bool)
    """
    old_content = get_active_content(role)
    diff = build_diff(old_content, content)
    changed = diff != "(변경 없음)"

    if not changed:
        return diff, False

    version = get_next_version(role)

    # 기존 active 해제
    if old_content:
        sb.patch("role_references",
                 params={"role": f"eq.{role}", "is_active": "eq.true"},
                 data={"is_active": False})

    # 새 버전 저장 + 즉시 활성화
    sb.post("role_references", {
        "role": role,
        "version": version,
        "content": content,
        "pipeline_run_id": run_id,
        "is_active": True,
        "activated_at": datetime.now(tz=timezone.utc).isoformat(),
        "activated_by": "auto",
    })
    print(f"  [db_writer] {role}: v{version} 저장 완료")
    return diff, True


def clear_teaser_cache(changed_roles: list[str]) -> int:
    """변경된 직군의 teaser_cache 삭제 (params_key LIKE '{role}|%'). 삭제 건수 반환."""
    if not changed_roles:
        return 0
    deleted = 0
    for role in changed_roles:
        rows = sb.delete("teaser_cache", params={"params_key": f"like.{role}|%"})
        deleted += len(rows) if isinstance(rows, list) else 0
    print(f"  [db_writer] teaser_cache 초기화: {changed_roles} ({deleted}건 삭제)")
    return deleted
