// 영문자 1개 이상 + 숫자 1개 이상 + 특수문자 1개 이상 + 8자 이상
export const PASSWORD_RE = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/

/**
 * @param {string} password
 * @returns {boolean}
 */
export function validatePassword(password) {
  return PASSWORD_RE.test(password)
}

export const PASSWORD_ERROR_MSG = '비밀번호는 8자 이상, 영문자·숫자·특수문자를 각 1개 이상 포함해야 합니다'
