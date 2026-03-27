import { useNavigate } from 'react-router-dom'

const sections = [
  {
    title: '제1조 (목적)',
    content: `이 약관은 DevNavi(이하 "서비스")가 제공하는 AI 기반 개발자 커리어 로드맵 서비스의 이용조건 및 절차, 회사와 회원 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.`,
  },
  {
    title: '제2조 (정의)',
    content: `① "서비스"란 DevNavi가 제공하는 AI 커리어 로드맵 생성 및 관련 부가서비스를 의미합니다.\n② "회원"이란 서비스에 가입하여 이용계약을 체결한 자를 의미합니다.\n③ "비회원"이란 회원가입 없이 서비스를 이용하는 자를 의미합니다.`,
  },
  {
    title: '제3조 (약관의 효력 및 변경)',
    content: `① 이 약관은 서비스를 이용하고자 하는 모든 이용자에게 적용됩니다.\n② 서비스는 합리적인 사유가 있는 경우 이 약관을 변경할 수 있으며, 변경 시 서비스 내 공지사항을 통해 7일 전 사전 고지합니다.\n③ 회원이 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단하고 회원 탈퇴를 요청할 수 있습니다.`,
  },
  {
    title: '제4조 (서비스 이용)',
    content: `① 서비스는 연중무휴 24시간 제공을 원칙으로 하되, 시스템 점검·보수 등 불가피한 경우 일시 중단될 수 있습니다.\n② 비회원도 AI 로드맵 미리보기 기능을 이용할 수 있으나, 로드맵 저장·진행률 추적 등 일부 기능은 로그인이 필요합니다.\n③ AI가 생성하는 로드맵은 참고용이며, 서비스는 결과의 정확성·완전성을 보증하지 않습니다.`,
  },
  {
    title: '제5조 (회원가입 및 계정)',
    content: `① 회원가입은 이용자가 약관에 동의하고 소정의 정보를 기입함으로써 완료됩니다.\n② 회원은 자신의 계정 정보를 안전하게 관리할 책임이 있으며, 타인에게 양도하거나 공유할 수 없습니다.\n③ 타인의 정보를 도용하여 가입하는 행위는 엄격히 금지됩니다.`,
  },
  {
    title: '제6조 (개인정보 보호)',
    content: `서비스는 관련 법령에 따라 회원의 개인정보를 보호합니다. 개인정보 수집·이용·보관에 관한 상세 내용은 별도의 개인정보처리방침에 따릅니다.`,
  },
  {
    title: '제7조 (금지행위)',
    content: `회원은 다음 각 호의 행위를 하여서는 안 됩니다.\n① 타인의 개인정보 도용 또는 허위정보 제공\n② 서비스의 정상적인 운영을 방해하는 행위\n③ 서비스를 통해 생성된 콘텐츠를 상업적 목적으로 무단 재배포하는 행위\n④ 관련 법령 및 공서양속에 반하는 행위`,
  },
  {
    title: '제8조 (서비스 중단 및 탈퇴)',
    content: `① 서비스는 사업상 사정 또는 기술상 이유로 서비스 전부 또는 일부를 변경·중단할 수 있습니다.\n② 회원은 언제든지 서비스 내 설정 또는 고객센터를 통해 탈퇴를 요청할 수 있으며, 탈퇴 시 개인정보처리방침에 따라 데이터가 처리됩니다.`,
  },
  {
    title: '제9조 (면책조항)',
    content: `① 서비스는 AI가 생성한 로드맵 결과의 정확성·적합성에 대해 법적 책임을 지지 않습니다.\n② 천재지변, 서비스 장애 등 불가항력적 사유로 인한 서비스 중단에 대해 책임을 지지 않습니다.`,
  },
  {
    title: '제10조 (준거법 및 관할)',
    content: `이 약관은 대한민국 법률에 따라 해석되며, 분쟁 발생 시 대한민국 법원을 관할 법원으로 합니다.`,
  },
]

export default function TermsPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-400 hover:text-gray-600 mb-8 flex items-center gap-1"
        >
          ← 뒤로가기
        </button>

        <h1 className="text-2xl font-black text-gray-900 mb-2">이용약관</h1>
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
