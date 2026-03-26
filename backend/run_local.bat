@echo off
echo CareerPath Backend 시작 중...
cd /d %~dp0
.venv\Scripts\uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
