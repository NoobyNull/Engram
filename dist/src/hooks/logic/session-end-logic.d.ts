import type { HookInput } from '../../shared/types.js';
import type { ObservationBuffer } from '../../sdk/observation-buffer.js';
export declare function handleSessionEnd(input: HookInput, buffer?: ObservationBuffer): Promise<void>;
