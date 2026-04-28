import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const API_BASE = 'http://localhost:8000/api/auth'

const AuthContext = createContext(null)

/**
 * Provides authentication state (user, token) and actions (login, register, logout).
 * Persists JWT token in localStorage. On mount, validates stored token via /me endpoint.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [isLoading, setIsLoading] = useState(true)

  // On mount: if a token exists, validate it by calling /me
  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      return
    }

    fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Token expired')
        return res.json()
      })
      .then((data) => {
        setUser(data)
      })
      .catch(() => {
        // Token invalid/expired — clear it
        localStorage.removeItem('token')
        setToken(null)
        setUser(null)
      })
      .finally(() => setIsLoading(false))
  }, [token])

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.detail || 'Đăng nhập thất bại')
    }

    localStorage.setItem('token', data.access_token)
    setToken(data.access_token)
    setUser(data.user)
    return data
  }, [])

  const register = useCallback(async (email, password, fullName, department) => {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        full_name: fullName,
        department: department || null,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.detail || 'Đăng ký thất bại')
    }

    localStorage.setItem('token', data.access_token)
    setToken(data.access_token)
    setUser(data.user)
    return data
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook to access auth state and actions.
 * Returns: { user, token, isLoading, login, register, logout }
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
