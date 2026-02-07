import { getObservation, getObservationsBySession } from '../../db/observations.js';
import { getKnowledge } from '../../db/knowledge.js';
import { getSession } from '../../db/sessions.js';
import { getConversation } from '../../db/conversations.js';
import { getEdgesForNode, traverseGraph } from '../../db/knowledge-graph.js';
import { getConfig } from '../../shared/config.js';

export async function handleGet(args: Record<string, unknown>): Promise<unknown> {
  const ids = args['ids'] as string[];
  const includeContext = args['include_context'] as boolean || false;
  const includeGraph = args['include_graph'] as boolean || false;

  const results: Array<Record<string, unknown>> = [];

  for (const id of ids) {
    // Determine type from ID prefix
    if (id.startsWith('obs_')) {
      const obs = getObservation(id);
      if (obs) {
        const result: Record<string, unknown> = {
          ...obs,
          result_type: 'observation',
          timestamp: new Date(obs.timestamp).toISOString(),
        };
        if (includeContext && obs.session_id) {
          const sessionObs = getObservationsBySession(obs.session_id, 5);
          result['context'] = sessionObs.map(o => ({
            id: o.id, tool: o.tool_name, summary: o.tool_input_summary,
            timestamp: new Date(o.timestamp).toISOString(),
          }));
        }
        results.push(result);
      }
    } else if (id.startsWith('kn_')) {
      const kn = getKnowledge(id);
      if (kn) {
        const result: Record<string, unknown> = {
          ...kn,
          result_type: 'knowledge',
          created_at: new Date(kn.created_at).toISOString(),
          updated_at: new Date(kn.updated_at).toISOString(),
        };

        // Include graph connections if requested and enabled
        const config = getConfig();
        if (includeGraph && config.knowledgeGraph?.enabled) {
          const edges = getEdgesForNode(kn.id);
          result['edges'] = edges.map(e => ({
            id: e.id,
            from_id: e.from_id,
            to_id: e.to_id,
            relationship: e.relationship,
            strength: e.strength,
          }));
          // Include reasoning chain for discoveries
          if (kn.type === 'discovery') {
            const chain = traverseGraph(kn.id, config.knowledgeGraph.maxDepth);
            if (chain) {
              result['reasoning_chain'] = chain.nodes.map(n => ({
                id: n.knowledge.id,
                type: n.knowledge.type,
                content: n.knowledge.content,
                depth: n.depth,
              }));
              result['chain_depth_limited'] = chain.maxDepthReached;
            }
          }
        }

        results.push(result);
      }
    } else if (id.startsWith('ses_')) {
      const ses = getSession(id);
      if (ses) {
        const result: Record<string, unknown> = {
          ...ses,
          result_type: 'session',
          started_at: new Date(ses.started_at).toISOString(),
          ended_at: ses.ended_at ? new Date(ses.ended_at).toISOString() : null,
        };
        if (includeContext) {
          const obs = getObservationsBySession(ses.id);
          result['observations'] = obs.map(o => ({
            id: o.id, tool: o.tool_name, summary: o.tool_input_summary,
            timestamp: new Date(o.timestamp).toISOString(),
          }));
        }
        results.push(result);
      }
    } else if (id.startsWith('conv_')) {
      const conv = getConversation(id);
      if (conv) {
        results.push({
          ...conv,
          result_type: 'conversation',
          started_at: new Date(conv.started_at).toISOString(),
          ended_at: conv.ended_at ? new Date(conv.ended_at).toISOString() : null,
        });
      }
    } else {
      // Try all types
      const obs = getObservation(id);
      if (obs) { results.push({ ...obs, result_type: 'observation' }); continue; }
      const kn = getKnowledge(id);
      if (kn) { results.push({ ...kn, result_type: 'knowledge' }); continue; }
      const ses = getSession(id);
      if (ses) { results.push({ ...ses, result_type: 'session' }); continue; }
      const conv = getConversation(id);
      if (conv) { results.push({ ...conv, result_type: 'conversation' }); continue; }
    }
  }

  return {
    found: results.length,
    requested: ids.length,
    results,
  };
}
