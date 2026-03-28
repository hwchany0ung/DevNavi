import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const sections = [
  {
    title: '1. 수집하는 개인정보 항목',
    content: `DevNavi는 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다.\n\n[필수 항목]\n• 이메일 주소 (회원가입·로그인 시)\n• 소셜 로그인 제공업체(Google)로부터 제공받은 이메일 주소 및 프로필 정보\n\n[서비스 이용 과정에서 자동 수집]\n• 서비스 이용 기록, AI 로드맵 생성 내역\n• 접속 IP, 브라우저 정보, 접속 시간`,
  },
  {
    title: '2. 개인정보 수집 및 이용 목적',
    content: `수집한 개인정보는 다음 목적으로 이용됩니다.\n• 회원 식별 및 서비스 제공\n• AI 로드맵 생성 결과 저장 및 동기화\n• 학습 진행률 추적 기능 제공\n• 서비스 운영·개선 및 통계 분석\n• 법령 준수 및 분쟁 해결`,
  },
  {
    title: '3. 개인정보 보유 및 이용 기간',
    content: `회원의 개인정보는 회원 탈퇴 시 즉시 파기합니다. 단, 관련 법령에 따라 일정 기간 보관이 필요한 경우 해당 기간 동안 보관합니다.\n\n• 전자상거래 기록: 5년 (전자상거래법)\n• 접속 로그: 3개월 (통신비밀보호법)`,
  },
  {
    title: '4. 개인정보 제3자 제공',
    content: `DevNavi는 원칙적으로 회원의 개인정보를 외부에 제공하지 않습니다. 단, 다음의 경우는 예외입니다.\n• 회원이 사전에 동의한 경우\n• 법령의 규정에 따르거나 수사 목적으로 법령에 정해진 절차에 따른 요청이 있는 경우`,
  },
  {
    title: '5. 개인정보 처리 위탁',
    content: `서비스는 원활한 운영을 위해 아래와 같이 개인정보 처리를 위탁합니다.\n\n• 수탁업체: Supabase Inc. — 회원 인증 및 데이터 저장\n• 수탁업체: Amazon Web Services Inc. — 서버 인프라 운영\n• 수탁업체: Anthropic PBC — AI 로드맵 생성 처리\n\n위탁 업체는 최소한의 정보만 수집하며, 위탁 목적 외 사용을 금지합니다.`,
  },
  {
    title: '6. 이용자의 권리',
    content: `회원은 언제든지 다음과 같은 권리를 행사할 수 있습니다.\n• 개인정보 조회·수정 요청\n• 개인정보 삭제(회원 탈퇴) 요청\n• 개인정보 처리 정지 요청\n\n요청은 support@devnavi.kr로 이메일을 보내주세요. 처리 결과를 10 영업일 이내에 안내드립니다.`,
  },
  {
    title: '7. 쿠키(Cookie) 사용',
    content: `서비스는 로그인 세션 유지 등을 위해 쿠키를 사용합니다. 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 일부 서비스 이용이 제한될 수 있습니다.`,
  },
  {
    title: '8. 개인정보 보호책임자',
    content: `개인정보 관련 문의, 불만 처리, 피해구제 등의 사항은 아래 담당자에게 연락해 주세요.\n\n• 담당자: DevNavi 운영팀\n• 이메일: support@devnavi.kr`,
  },
  {
    title: '9. 개인정보처리방침 변경',
    content: `이 개인정보처리방침은 법령·정책 변경 시 개정될 수 있으며, 변경 시 서비스 공지사항을 통해 사전 안내합니다.`,
  },
]

export default function PrivacyPage() {
  const navigate = useNavigate()

  useEffect(() => {
    document.title = '개인정보처리방침 — DevNavi'
    return () => { document.title = 'DevNavi — IT 직군 맞춤형 AI 로드맵' }
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-400 hover:text-gray-600 mb-8 flex items-center gap-1"
        >
          ← 뒤로가기
        </button>

        <h1 className="text-2xl font-black text-gray-900 mb-2">개인정보처리방침</h1>
        <p className="text-sm text-gray-400 mb-10">최종 업데이트: 2025년 1월 1일</p>

        <div className="space-y-8">
          {sections.map(({ title, content }) => (
            <section key={title}>
              <h2 className="text-sm font-bold text-gray-800 mb-2">{title}</h2>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{content}</p>
            </section>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-gray-100 text-xs text-gray-400">
          문의: <a href="mailto:support@devnavi.kr" className="text-indigo-500">support@devnavi.kr</a>
        </div>
      </div>
    </div>
  )
}
