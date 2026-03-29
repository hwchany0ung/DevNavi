import '@testing-library/jest-dom'

// Expose `jest` as an alias for `vi` so that @testing-library/dom can detect
// fake timers correctly (it checks `typeof jest !== 'undefined'`)
import { vi } from 'vitest'
globalThis.jest = vi
