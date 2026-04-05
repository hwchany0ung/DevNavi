# Telegram 알림 훅 설정 가이드

## 1. 봇 생성

1. Telegram에서 [@BotFather](https://t.me/BotFather) 검색
2. `/newbot` 입력 → 이름·username 설정
3. 발급된 **Bot Token** 복사 (예: `123456789:ABCdef...`)

## 2. Chat ID 확인

1. 생성한 봇에게 아무 메시지 전송
2. 브라우저에서 아래 URL 접속 (토큰 교체):
   ```
   https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
   ```
3. 응답 JSON에서 `"chat": {"id": <숫자>}` 복사

## 3. 환경변수 등록 (Windows)

PowerShell에서 (영구 설정):
```powershell
[System.Environment]::SetEnvironmentVariable("TELEGRAM_BOT_TOKEN", "여기에_토큰", "User")
[System.Environment]::SetEnvironmentVariable("TELEGRAM_CHAT_ID", "여기에_채팅ID", "User")
```

또는 bash에서 (세션 한정):
```bash
export TELEGRAM_BOT_TOKEN="여기에_토큰"
export TELEGRAM_CHAT_ID="여기에_채팅ID"
```

## 4. 동작 확인

Claude Code 작업이 끝나면 자동으로 Telegram 메시지가 옵니다:
- ✅ 작업 완료 (end_turn)
- ❌ 오류 발생 (error)
- ⏹ 기타 중단
