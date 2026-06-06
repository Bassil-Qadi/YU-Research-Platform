export class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message)
    }
  }
  
  export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,  
      },
    })
  
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new ApiError(res.status, body.error ?? 'Something went wrong')
    }
  
    return res.json() as Promise<T>
  }