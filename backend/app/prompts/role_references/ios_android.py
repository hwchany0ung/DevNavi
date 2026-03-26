"""
iOS/Android 모바일 개발자 로드맵 참조 데이터
출처: 내일배움캠프 iOS 로드맵 2025, 스파르타코딩클럽 iOS 로드맵, JetBrains Kotlin Multiplatform 2025
"""

REFERENCE = """
[모바일(iOS/Android) 개발자 — 2025 한국 취업 실무 참조]

■ iOS vs Android 선택 기준 (한국 시장)
- Android: 국내 점유율 높음, 채용 공고 다양, Kotlin 공식 언어
- iOS: 금융·커머스 앱 비중 높음, Swift 수요 꾸준, 연봉 다소 높은 경향
- 크로스플랫폼(Flutter/RN): 스타트업·소규모 팀에서 급증, 하나로 양쪽 커버

■ Android 개발자 학습 순서 (Kotlin 기준)
1단계: Kotlin 문법 기초 (Java 경험 있으면 1~2주)
2단계: Android Studio 환경 + 생명주기(Lifecycle) 이해
3단계: View 시스템 or Jetpack Compose (UI 구현)
   → 2024년부터 Jetpack Compose가 신규 프로젝트 표준
4단계: 아키텍처 패턴 — MVVM (기본) → MVI (심화)
5단계: Jetpack 라이브러리 (Navigation, Room, WorkManager, DataStore)
6단계: 비동기 처리 — Coroutines + Flow (필수)
7단계: Retrofit + OkHttp (REST API 통신)
8단계: Hilt (의존성 주입, 기업 프로젝트 표준)
9단계: 앱 배포 (Play Store 등록, 서명, 릴리즈 빌드)

■ iOS 개발자 학습 순서 (Swift 기준)
1단계: Swift 문법 (옵셔널, 프로토콜, 클로저, 제네릭)
2단계: Xcode 환경 + iOS 앱 구조 이해
3단계: UIKit 기초 (Auto Layout, Storyboard → 코드 UI로 전환 권장)
   또는 SwiftUI (2024년부터 신규 앱 표준 전환 중)
4단계: MVC → MVVM 패턴 적용
5단계: 비동기 처리 — async/await + Combine
6단계: 네트워크 통신 — URLSession + Codable
7단계: 로컬 저장 — UserDefaults, CoreData, SwiftData(iOS 17+)
8단계: 앱 배포 (App Store Connect, TestFlight, 프로비저닝)

■ 2025 채용 필수 기술 (한국 JD 분석)
Android: Kotlin, Jetpack Compose, MVVM/MVI, Coroutines/Flow, Hilt, Room, Retrofit
iOS: Swift, SwiftUI or UIKit, MVVM, Combine or async/await, URLSession

■ 크로스플랫폼 선택지 (2025)
- Flutter (Dart): 국내 스타트업 채용 공고 증가, 하나로 iOS·Android 커버
  → 네이티브 성능에 근접, 단일 코드베이스
- React Native: JS/TS 배경자 진입 쉬움, 기존 웹팀의 모바일 확장
- Kotlin Multiplatform: 비즈니스 로직만 공유, UI는 각 네이티브 (JetBrains 공식 로드맵 2025 발표)

■ 자격증 (모바일 특화)
- 정보처리기사 (대기업 앱 개발팀 지원 시 가산점)
- Android ATC (구글 파트너 공식 인증, 국내 인지도 낮음)
- Apple Developer Program 등록 (App Store 배포 경험 증명)

■ 회사 유형별 포커스
- 스타트업: Flutter or React Native, 빠른 기능 개발 능력, CI/CD(Fastlane)
- 대기업/금융: 네이티브(Swift/Kotlin) 필수, 접근성, 보안 코딩
- 게임: Unity + C# 또는 Cocos2d (별도 게임 개발 로드맵)
- 커머스: 결제 SDK 연동 경험, 딥링크, 푸시알림(FCM/APNs)

■ 포트폴리오 핵심 포인트
- 앱스토어/플레이스토어 실제 배포 앱 (다운로드 수 있으면 최강)
- GitHub 코드 + 아키텍처 설명 문서
- 화면 녹화 영상 or GIF로 기능 시연
- 네트워크 연동 + 로컬 DB + 로그인 기능 포함한 앱

■ 기술 면접 핵심 주제
[Android]
- 액티비티/프래그먼트 생명주기 + 백스택 관리
- Coroutines Dispatcher 종류와 사용 시점
- Room DB 쿼리 최적화, LiveData vs StateFlow 차이
- ANR 원인과 방지 방법, 메모리 누수 탐지

[iOS]
- ARC(자동 참조 카운팅), 순환 참조 방지 (weak/unowned)
- RunLoop, GCD vs async/await 차이
- SwiftUI State 관리 (@State, @Binding, @ObservableObject)
- 앱 서명 및 배포 프로세스 (프로비저닝 프로파일)
"""
