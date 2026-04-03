// FOUC 방지: React 로드 전에 다크모드 클래스 미리 적용
try {
  if (localStorage.getItem('devnavi_theme') === 'dark') {
    document.documentElement.classList.add('dark');
  }
} catch (e) {
  // localStorage 접근 불가 시 무시 (프라이빗 브라우징 등)
}
