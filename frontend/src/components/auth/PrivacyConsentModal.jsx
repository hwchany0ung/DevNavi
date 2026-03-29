/**
 * 개인정보 수집 및 이용 동의 모달
 *
 * @param {boolean}  open
 * @param {function} onAgree     — "동의하기" 클릭
 * @param {function} onDisagree  — "동의하지 않음" 클릭
 */
export default function PrivacyConsentModal({ open, onAgree, onDisagree }) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onDisagree() }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4
        border border-gray-100 dark:border-white/10">

        <h3 className="text-base font-black text-gray-900 dark:text-white">
          개인정보 수집 및 이용 동의
        </h3>

        <table className="w-full text-xs text-gray-600 dark:text-white/70 border-collapse">
          <tbody>
            <tr className="border-t border-gray-100 dark:border-white/10">
              <td className="py-2 pr-3 font-semibold text-gray-700 dark:text-white/80 whitespace-nowrap w-20">수집 항목</td>
              <td className="py-2">이메일 주소, 비밀번호(암호화 저장)</td>
            </tr>
            <tr className="border-t border-gray-100 dark:border-white/10">
              <td className="py-2 pr-3 font-semibold text-gray-700 dark:text-white/80 whitespace-nowrap">수집 목적</td>
              <td className="py-2">회원 식별 및 서비스 제공</td>
            </tr>
            <tr className="border-t border-gray-100 dark:border-white/10">
              <td className="py-2 pr-3 font-semibold text-gray-700 dark:text-white/80 whitespace-nowrap align-top">보유 기간</td>
              <td className="py-2">회원 탈퇴 시까지<br />(관련 법령에 따라 보존 필요 시까지)</td>
            </tr>
            <tr className="border-t border-gray-100 dark:border-white/10">
              <td className="py-2 pr-3 font-semibold text-gray-700 dark:text-white/80 whitespace-nowrap align-top">거부 권리</td>
              <td className="py-2">동의를 거부할 권리가 있으며,<br />거부 시 회원가입이 제한됩니다.</td>
            </tr>
          </tbody>
        </table>

        <p className="text-xs text-gray-400 dark:text-white/40">
          * 그 밖의 사항은 개인정보처리방침을 준수합니다.
        </p>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onDisagree}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-white/10
              text-sm font-semibold text-gray-500 dark:text-white/60
              hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            동의하지 않음
          </button>
          <button
            onClick={onAgree}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700
              text-white text-sm font-bold transition-colors"
          >
            동의하기
          </button>
        </div>
      </div>
    </div>
  )
}
