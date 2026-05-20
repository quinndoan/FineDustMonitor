const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export const API_BASE_URL = BASE_URL
export const WS_BASE_URL = BASE_URL.replace(/^http/, 'ws')
