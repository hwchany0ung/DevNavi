"""월간 role_references 갱신 파이프라인 진입점.

Usage:
    python backend/scripts/refresh_references.py [--roles backend,frontend]
"""
import argparse
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from scripts import db_writer
from scripts.aggregator import compute_scores, build_priority_map
from scripts.collectors import worknet, tech_blog, pkg_stats, so_survey
from scripts.notifier import build_report, send_email
from scripts.validator import generate_reference

ALL_ROLES = db_writer.ALL_ROLES


def _collect_all(role: str) -> dict[str, dict]:
    """4개 소스 병렬 수집."""
    collectors = {
        "worknet":   lambda: worknet.collect(role),
        "tech_blog": lambda: tech_blog.collect(role),
        "npm_pypi":  lambda: pkg_stats.collect(role),
        "so_survey": lambda: so_survey.collect(role),
    }
    results = {}
    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = {ex.submit(fn): name for name, fn in collectors.items()}
        for future in as_completed(futures):
            name = futures[future]
            try:
                results[name] = future.result()
            except Exception as e:
                print(f"  [{name}] 수집 실패 (스킵): {e}")
    return results


def run(roles: list[str], triggered_by: str = "manual") -> None:
    start = time.time()
    run_id = db_writer.create_pipeline_run(triggered_by)
    print(f"[pipeline] run_id={run_id}, roles={roles}")

    diffs: dict[str, tuple[str, bool]] = {}
    global_stats: dict = {"worknet_total": 0, "blog_total": 0}

    try:
        for role in roles:
            print(f"\n[pipeline] === {role} ===")
            source_results = _collect_all(role)

            # 소스 원본 저장
            for src_data in source_results.values():
                db_writer.save_source(run_id, role, src_data)

            # 통계 누적
            global_stats["worknet_total"] += source_results.get(
                "worknet", {}).get("total_postings", 0)
            global_stats["blog_total"] += source_results.get(
                "tech_blog", {}).get("total_posts", 0)

            if not source_results:
                print(f"  [{role}] 모든 소스 수집 실패 -- 스킵")
                diffs[role] = ("(수집 실패)", False)
                continue

            # 점수 산출 + Claude 검증
            scores = compute_scores(list(source_results.values()))
            priority_map = build_priority_map(scores)
            existing = db_writer.get_active_content(role)
            new_content = generate_reference(role, priority_map, existing)

            # DB 저장
            diff_text, changed = db_writer.save_new_version(run_id, role, new_content)
            diffs[role] = (diff_text, changed)

        # 변경된 직군의 teaser_cache 초기화
        changed_roles = [role for role, (_, changed) in diffs.items() if changed]
        db_writer.clear_teaser_cache(changed_roles)

        db_writer.update_pipeline_run(run_id, "completed")

    except Exception as e:
        db_writer.update_pipeline_run(run_id, "failed", error=str(e))
        raise

    # 이메일 발송
    elapsed = time.time() - start
    report = build_report(run_id, diffs, global_stats, elapsed)
    today = __import__("datetime").datetime.now().strftime("%Y년 %m월")
    send_email(f"[DevNavi] 월간 기술 트렌드 리포트 -- {today}", report)
    print(f"\n[pipeline] 완료 ({elapsed:.1f}초)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--roles", default="", help="쉼표 구분 직군 (비우면 전체)")
    parser.add_argument("--triggered-by", default="manual")
    args = parser.parse_args()

    target_roles = [r.strip() for r in args.roles.split(",") if r.strip()] or ALL_ROLES
    run(target_roles, triggered_by=args.triggered_by)
