// Design Ref: §8.3 — E2E 온보딩→로드맵 흐름 (module-6)
// Plan SC: E2E 테스트로 주요 사용자 흐름 검증
import { test, expect } from '@playwright/test'

/**
 * E2E 테스트 범위:
 * 1. 랜딩 페이지 로드
 * 2. 온보딩 폼 입력 (역할/기간/레벨 선택)
 * 3. 로드맵 생성 트리거 확인
 *
 * 참고: Supabase 인증 및 실제 AI 스트리밍은 Mock/stub 처리.
 *       실제 네트워크 의존 없이 UI 흐름만 검증.
 */

test.describe('온보딩 페이지 기본 흐름', () => {
  test.beforeEach(async ({ page }) => {
    // localStorage 에 auth 세션 없이 시작
    await page.context().clearCookies()
  })

  test('랜딩 페이지가 로드됨', async ({ page }) => {
    await page.goto('/')
    // 타이틀 또는 주요 텍스트 존재 확인 (실제 텍스트는 앱에 맞게)
    await expect(page).toHaveTitle(/.+/)
  })

  test('온보딩 페이지 접근 시 역할 선택 UI 표시', async ({ page }) => {
    await page.goto('/onboarding')
    // 역할 선택 버튼 존재 확인
    await expect(page.getByText('백엔드')).toBeVisible()
    await expect(page.getByText('프론트엔드')).toBeVisible()
  })

  test('역할 선택 후 버튼 활성화 스타일 적용', async ({ page }) => {
    await page.goto('/onboarding')
    const backendBtn = page.getByText('백엔드').locator('..')
    await backendBtn.click()
    // 선택 후 border-indigo-500 클래스 적용 여부 확인
    await expect(backendBtn).toHaveClass(/border-indigo-500/)
  })

  test('기간 선택 옵션 표시', async ({ page }) => {
    await page.goto('/onboarding')
    await expect(page.getByText('6개월')).toBeVisible()
    await expect(page.getByText('1년')).toBeVisible()
  })

  test('레벨 선택 옵션 표시', async ({ page }) => {
    await page.goto('/onboarding')
    await expect(page.getByText('완전 입문')).toBeVisible()
    await expect(page.getByText('기초 이해')).toBeVisible()
  })
})
