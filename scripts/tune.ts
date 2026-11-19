import { simulate } from '../src/engine/simulate';
import { SCENARIOS, withDefaults } from '../src/engine/levels/scenarios';
import { bindingPressure, goalMet } from '../src/engine/pressures';
const fmt = (m: any) => `acc ${(m.accuracy*100).toFixed(0)} hal ${(m.hallucination*100).toFixed(0)} inj ${(m.injection*100).toFixed(0)} err ${(m.errorRate*100).toFixed(1)} $${m.costPer1k.toFixed(2)} p50 ${m.p50.toFixed(0)} ttft ${m.ttftP50.toFixed(0)} rec ${m.recall==null?'-':(m.recall*100).toFixed(0)}`;
for (const s of SCENARIOS) {
  for (const which of ['start','solution'] as const) {
    const g = which==='start'? {nodes:s.nodes,edges:s.edges}: s.solution;
    const graph = { nodes: g.nodes.map(withDefaults).map(n=>({id:n.id,type:n.type,config:n.config!})), edges: g.edges };
    const m = simulate(graph, s.traffic, { seed: 7, samples: 4000 });
    const met = s.goals.map(goal=>goalMet(m,goal)?'✓':'✗').join('');
    console.log(s.id.padEnd(14), which.padEnd(8), met, fmt(m), '|', bindingPressure(m,s.goals).key, m.warnings.join(';'));
  }
}
