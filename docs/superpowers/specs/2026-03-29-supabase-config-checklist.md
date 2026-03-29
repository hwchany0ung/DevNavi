# Supabase Dashboard Configuration Checklist

인증 개선 기능을 완성하려면 아래 Supabase 대시보드 설정이 필요합니다.

## 1. Custom SMTP (Authentication → SMTP Settings)

| 항목 | 값 |
|------|-----|
| Enabled | true |
| Host | smtp.hiworks.com |
| Port | 465 |
| Username | support@devnavi.kr |
| Password | [하이웍스 비밀번호 입력] |
| Sender Name | DevNavi |
| Sender Email | support@devnavi.kr |

## 2. URL Configuration (Authentication → URL Configuration)

| 항목 | 값 |
|------|-----|
| Site URL | https://devnavi.kr |
| Redirect URLs | https://devnavi.kr/auth/callback |
| | https://devnavi.kr/reset-password |

## 3. Password Policy (Authentication → Policies)

- Minimum password length: **8**
- Require uppercase letters: OFF (프론트에서 regex로 처리)
- Require numbers: OFF
- Require special characters: **ON**

## 4. Email Templates (Authentication → Email Templates)

### Confirm signup

**Subject:** DevNavi 이메일 인증

```html
<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
  <img src="https://devnavi.kr/logo.svg" width="120" alt="DevNavi" style="margin-bottom: 24px;" />
  <h2 style="color: #111827; font-size: 20px; font-weight: 800; margin-bottom: 8px;">이메일 인증</h2>
  <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
    아래 버튼을 클릭해 이메일 인증을 완료해 주세요.
  </p>
  <a href="{{ .ConfirmationURL }}"
     style="display: inline-block; background: #4F46E5; color: #fff; text-decoration: none;
            padding: 12px 24px; border-radius: 12px; font-weight: 700; font-size: 14px;">
    이메일 인증하기
  </a>
  <p style="color: #9CA3AF; font-size: 12px; margin-top: 24px;">
    본인이 요청하지 않은 경우 이 메일을 무시해 주세요.
  </p>
</div>
```

### Reset password

**Subject:** DevNavi 비밀번호 재설정

```html
<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
  <img src="https://devnavi.kr/logo.svg" width="120" alt="DevNavi" style="margin-bottom: 24px;" />
  <h2 style="color: #111827; font-size: 20px; font-weight: 800; margin-bottom: 8px;">비밀번호 재설정</h2>
  <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
    아래 버튼을 클릭해 새 비밀번호를 설정해 주세요.
  </p>
  <a href="{{ .ConfirmationURL }}"
     style="display: inline-block; background: #4F46E5; color: #fff; text-decoration: none;
            padding: 12px 24px; border-radius: 12px; font-weight: 700; font-size: 14px;">
    비밀번호 재설정하기
  </a>
  <p style="color: #9CA3AF; font-size: 12px; margin-top: 24px;">
    본인이 요청하지 않은 경우 이 메일을 무시해 주세요. 링크는 1시간 후 만료됩니다.
  </p>
</div>
```
