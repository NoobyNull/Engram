export type ResolutionAction = 'merge' | 'keep_both' | 'replace' | 'skip';
export declare function handleResolve(args: Record<string, unknown>): Promise<unknown>;
