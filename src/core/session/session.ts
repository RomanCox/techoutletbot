export interface SessionStorage<T> {
    get(userId: number): T | undefined
    set(userId: number, data: T): void
    reset(userId: number, value: T): void
}

export function createMemorySession<T>(factory: () => T): SessionStorage<T> {
    const m = new Map<number, T>()
    return {
        get: (id) => m.get(id),
        set: (id, data) => m.set(id, data),
        reset: (id, value) => m.set(id, value ?? factory()),
    }
}
