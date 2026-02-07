import { getObservationsBySession, getObservationsByConversation, getObservationsAround, getRecentObservations } from '../../db/observations.js';
export async function handleTimeline(args) {
    const limit = args['limit'] || 20;
    const sessionId = args['session_id'];
    const conversationId = args['conversation_id'];
    const project = args['project'];
    const around = args['around'];
    let observations;
    if (conversationId) {
        observations = getObservationsByConversation(conversationId, limit);
    }
    else if (sessionId) {
        observations = getObservationsBySession(sessionId, limit);
    }
    else if (around) {
        const timestamp = new Date(around).getTime();
        observations = getObservationsAround(timestamp, limit, project);
    }
    else if (project) {
        observations = getRecentObservations(project, limit);
    }
    else {
        observations = getRecentObservations('', limit);
    }
    return {
        count: observations.length,
        observations: observations.map(o => ({
            id: o.id,
            tool: o.tool_name,
            input_summary: o.tool_input_summary,
            output_summary: o.tool_output_summary,
            files: o.files_involved,
            timestamp: new Date(o.timestamp).toISOString(),
            conversation_id: o.conversation_id,
            session_id: o.session_id,
        })),
    };
}
//# sourceMappingURL=timeline.js.map