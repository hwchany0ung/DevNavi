import pytest
import inspect

pytestmark = pytest.mark.unit


def test_admin_stats_api_usage_query_has_limit():
    """admin.py의 api_usage 쿼리 소스에 limit 파라미터가 있는지 검증.

    PostgREST는 limit 미지정 시 기본 1000행을 반환.
    하루 사용량이 1000건 초과 시 api_calls_today 등이 과소 집계됨.
    """
    import app.api.admin as m
    source = inspect.getsource(m)

    lines = source.split('\n')
    in_block = False
    found_limit = False
    for line in lines:
        if 'sb_url("api_usage")' in line or "sb_url('api_usage')" in line:
            in_block = True
        if in_block:
            if '"limit"' in line or "'limit'" in line:
                found_limit = True
                break
            if 'headers=sb_headers()' in line and in_block:
                break

    assert found_limit, (
        "admin.py의 api_usage 쿼리에 'limit' 파라미터가 없습니다.\n"
        "PostgREST 기본 1000행 제한으로 트래픽 증가 시 api_calls_today가 과소 집계됩니다.\n"
        'params={"select": "endpoint,count", ..., "limit": "10000"} 으로 수정하세요.'
    )
