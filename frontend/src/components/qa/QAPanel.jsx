import { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { useQA } from '../../hooks/useQA'
import { useAuth } from '../../hooks/useAuth'
import QAInput from './QAInput'
import QAFeedback from './QAFeedback'

/**
 * QAPanel — 우측 고정 AI Q&A 사이드 패널
 *
 * Props:
 *   isOpen      — 패널 열림 여부
 *   taskContext — { taskId, taskName, jobType, month, week, category }
 *   onClose     — () => void
 */
export default function QAPanel({ isOpen, taskContext = null, onClose }) {
  const { messages, isStreaming, openPanel, closePanel, sendMessage } = useQA()
  const { user } = useAuth()
  const messagesEndRef = useRef(null)

  // taskContext 변경 시 패널 상태 동기화
  useEffect(() => {
    if (isOpen && taskContext?.taskId) {
      openPanel(taskContext.taskId, taskContext)
    }
  }, [isOpen, taskContext?.taskId]) // eslint-disable-line react-hooks/exhaustive-deps

  // 패널 닫힐 때 스트리밍 정리
  useEffect(() => {
    if (!isOpen) {
      closePanel()
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // 새 메시지 도착 시 스크롤 하단으로
  useEffect(() => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleClose = () => {
    closePanel()
    onClose()
  }

  return (
    <>
      {/* 모바일 오버레이 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-[19] sm:hidden"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      {/* 패널 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={taskContext?.taskName ? `${taskContext.taskName} AI Q&A` : 'AI Q&A'}
        className={`
          fixed top-0 right-0 z-20
          w-[360px] h-screen max-w-full
          flex flex-col
          bg-white dark:bg-gray-900
          border-l border-gray-100 dark:border-white/10
          shadow-2xl
          transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-indigo-600 dark:text-indigo-400 text-sm font-bold flex-shrink-0">AI</span>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90 truncate">
              {taskContext?.taskName ?? '태스크 Q&A'}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="패널 닫기"
            className="
              w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
              text-gray-400 dark:text-white/40
              hover:text-gray-700 dark:hover:text-white/80
              hover:bg-gray-100 dark:hover:bg-white/10
              transition-colors
            "
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* 메시지 목록 */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-2 py-8">
              <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                <span className="text-indigo-500 text-lg font-bold">?</span>
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-white/80">
                이 태스크가 궁금하신가요?
              </p>
              <p className="text-xs text-gray-400 dark:text-white/40">
                질문을 입력하면 AI가 도움을 드립니다.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className="flex flex-col max-w-[85%]">
                  <div
                    className={`
                      rounded-2xl px-3 py-2 text-sm leading-relaxed
                      ${msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-sm'
                        : msg.isError
                          ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-bl-sm'
                          : 'bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-white/90 rounded-bl-sm'
                      }
                    `}
                  >
                    {msg.content || (
                      msg.role === 'assistant' && isStreaming && idx === messages.length - 1
                        ? <StreamingDots />
                        : null
                    )}
                  </div>
                  {msg.role === 'assistant' && !isStreaming && msg.content && taskContext?.taskId && (
                    <QAFeedback
                      taskId={taskContext.taskId}
                      question={messages[idx - 1]?.content ?? ''}
                      answer={msg.content}
                      isLoggedIn={!!user}
                    />
                  )}
                  {msg.role === 'assistant' && !msg.isError && !isStreaming && msg.content && idx === messages.length - 1 && msg.followups?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {msg.followups.map((q, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => sendMessage(q)}
                          disabled={isStreaming}
                          className="
                            px-2.5 py-1 rounded-full text-xs
                            bg-gray-100 dark:bg-white/10
                            text-gray-500 dark:text-white/50
                            hover:bg-gray-200 dark:hover:bg-white/20
                            hover:text-gray-700 dark:hover:text-white/70
                            transition-colors
                            disabled:opacity-40 disabled:cursor-not-allowed
                          "
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {/* 스트리밍 중 마지막 어시스턴트 메시지가 비어있을 때 dots 표시 */}
          {isStreaming && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && messages[messages.length - 1].content === '' && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-white/10 rounded-2xl rounded-bl-sm px-3 py-2">
                <StreamingDots />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 입력 폼 */}
        <QAInput onSubmit={sendMessage} disabled={isStreaming} />
      </div>
    </>
  )
}

function StreamingDots() {
  return (
    <span className="flex gap-1 items-center h-4">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-white/40 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  )
}

QAPanel.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  taskContext: PropTypes.shape({
    taskId:   PropTypes.string,
    taskName: PropTypes.string,
    jobType:  PropTypes.string,
    month:    PropTypes.number,
    week:     PropTypes.number,
    category: PropTypes.string,
  }),
  onClose: PropTypes.func.isRequired,
}

