#!/usr/bin/env python3
"""
Stop 훅 — PDCA Do 단계 완료 시 gap-detector 실행 강제
pdca-status.json의 phase=do 인 경우, 검증 없이 완료 선언 방지
"""
import sys
import json
import os

try:
    data = json.loads(sys.stdin.read()) if not sys.stdin.isatty() else {}
except Exception:
    data = {}

stop_reason = data.get("stop_reason", "end_turn")

# 정상 종료가 아니면 패스
if stop_reason != "end_turn":
    sys.exit(0)

# PDCA 상태 확인
pdca_path = os.path.join(os.path.dirname(__file__), "..", "..", ".bkit", "state", "pdca-status.json")
pdca_path = os.path.normpath(pdca_path)

try:
    with open(pdca_path, "r", encoding="utf-8") as f:
        pdca = json.load(f)
except Exception:
    sys.exit(0)

# 현재 기능의 phase 확인
features = pdca.get("features", {})
for feature_name, feature_data in features.items():
    phase = feature_data.get("phase", "")
    if phase == "do":
        # Do 단계에서 Stop 이벤트 — gap-detector 미실행 경고
        analyzed = feature_data.get("analyzed", False)
        if not analyzed:
            print(f"[task-qa-gate] WARNING: '{feature_name}' Do 단계 완료 감지.\n"
                  f"  gap-detector 검증 없이 완료 선언 금지.\n"
                  f"  '/pdca analyze' 또는 gap-detector 에이전트를 먼저 실행하세요.",
                  file=sys.stderr)

sys.exit(0)
