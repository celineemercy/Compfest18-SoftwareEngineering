export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      data?.message instanceof Array
        ? data.message.join(', ')
        : data?.message || 'Request failed'
    throw new Error(message)
  }

  return data as T
}

export function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong'
}
