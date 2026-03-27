/**
 * 기존 로드맵 존재 안내 모달
 * - 기존 로드맵으로 이동
 * - 기존 로드맵 삭제 후 새로 생성
 */
export default function ExistingRoadmapModal({ roadmapId, onGoExisting, onDeleteAndNew }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-sm p-7 space-y-5">
        {/* 아이콘 */}
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-2xl">
          🗺️
        </div>

        {/* 제목 */}
        <div>
          <h2 className="text-lg font-black text-gray-900 dark:text-white">
            이미 로드맵이 있어요
          </h2>
          <p className="text-sm text-gray-500 dark:text-white/50 mt-1 leading-relaxed">
            이전에 생성한 로드맵이 저장되어 있습니다.<br />
            어떻게 하시겠어요?
          </p>
        </div>

        {/* 버튼 */}
        <div className="space-y-2.5">
          <button
            onClick={onGoExisting}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl transition-colors"
          >
            기존 로드맵 보러 가기 →
          </button>
          <button
            onClick={onDeleteAndNew}
            className="w-full py-3.5 border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10
              hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400
              font-bold text-sm rounded-2xl transition-colors"
          >
            기존 로드맵 삭제 후 새로 만들기
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-white/30">
          삭제된 로드맵은 복구할 수 없습니다
        </p>
      </div>
    </div>
  )
}
