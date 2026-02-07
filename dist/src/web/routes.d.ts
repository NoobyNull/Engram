import type { IncomingMessage, ServerResponse } from 'node:http';
import type { StagedObservation } from '../shared/types.js';
export declare function setStagingBuffer(buffer: {
    getStaged(): StagedObservation[];
}): void;
export declare function handleApiRequest(req: IncomingMessage, res: ServerResponse): Promise<void>;
