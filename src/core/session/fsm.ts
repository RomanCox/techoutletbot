// src/core/session/fsm.ts
import type { AdminSession } from '@core/types.js';
import { createMemorySession } from './session.js';

export const adminSessions = createMemorySession<AdminSession>(() => ({ mode: 'IDLE' }))

export function getAdminSession(uid: number) {
    return adminSessions.get(uid) ?? ({ mode: 'IDLE' } as AdminSession)
}
export function setAdminSession(uid: number, s: AdminSession) {
    adminSessions.set(uid, s)
}
export function resetAdminSession(uid: number) {
    adminSessions.reset(uid, { mode: 'IDLE' })
}
