import type { HookInput, Project, Session } from '../../shared/types.js';
export interface SessionStartResult {
    context: string;
    session: Session;
    project: Project;
}
export declare function handleSessionStart(input: HookInput): Promise<SessionStartResult>;
