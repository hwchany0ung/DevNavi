export const PASSWORD_RE = /^(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/

/**
 * @param {string} password
 * @returns {boolean}
 */
export function validatePassword(password) {
  return PASSWORD_RE.test(password)
}

export const PASSWORD_ERROR_MSG = '비밀번호는 8자 이상, 특수문자를 1개 이상 포함해야 합니다'
