import type { HookInput, Observation } from '../../shared/types.js';
import type { ObservationBuffer } from '../../sdk/observation-buffer.js';
export declare function handlePostToolUse(input: HookInput, buffer?: ObservationBuffer): Promise<Observation | null>;
