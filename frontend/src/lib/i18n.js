/**
 * 다크/라이트 모드 테마 헬퍼.
 * isDark가 true면 darkValue, false면 lightValue 반환.
 *
 * @param {boolean} isDark
 * @returns {(darkValue: string, lightValue: string) => string}
 *
 * @example
 * const t = makeThemeHelper(isDark)
 * t('bg-gray-900', 'bg-white') // isDark ? 'bg-gray-900' : 'bg-white'
 */
export function makeThemeHelper(isDark) {
  return (darkValue, lightValue) => (isDark ? darkValue : lightValue)
}
