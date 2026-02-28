import type { Rule, InferenceResult, InferenceMethod } from './types';

export const evaluateGoal = (
  goalId: string,
  rules: Rule[],
  facts: Record<string, boolean>,
  method: InferenceMethod,
  newFacts: Record<string, boolean> = {},
  visited: Set<string> = new Set() // Previene bucles infinitos
): InferenceResult => {
  
  const currentFacts = { ...facts, ...newFacts };

  if (currentFacts[goalId] !== undefined) {
    return { resolved: true, value: currentFacts[goalId], inferredFacts: newFacts };
  }

  if (visited.has(goalId)) {
    return { resolved: false };
  }
  visited.add(goalId);

  const methodsToTry: InferenceMethod[] = method === 'automatic' ? ['ponens', 'tollens'] : [method];

  let firstMissingNode: string | undefined = undefined;

  for (const currentMethod of methodsToTry) {
    
    // ------------------------------------------
    //* LÓGICA MODUS PONENS
    // ------------------------------------------
    if (currentMethod === 'ponens') {
      const applicableRules = rules.filter((r) => r.conclusion === goalId);
      
      for (const rule of applicableRules) {
        let allPremisesTrue = true;

        for (const premise of rule.premises) {
          const premiseEval = evaluateGoal(premise, rules, facts, method, newFacts, new Set(visited));
          
          if (!premiseEval.resolved) {
            allPremisesTrue = false;
            // Guardamos el nodo faltante pero NO abortamos, seguimos intentando otras reglas
            if (!firstMissingNode) firstMissingNode = premiseEval.missingNodeToAsk || premise;
            break; 
          }
          if (premiseEval.value === false) {
            allPremisesTrue = false;
            break; // La regla falla, intentamos la siguiente
          }
        }

        if (allPremisesTrue) {
          newFacts[goalId] = true;
          return { resolved: true, value: true, inferredFacts: newFacts };
        }
      }
    }

    // ------------------------------------------
    //* LÓGICA MODUS TOLLENS
    // ------------------------------------------
    if (currentMethod === 'tollens') {
      const applicableRules = rules.filter((r) => r.premises.includes(goalId));
      
      for (const rule of applicableRules) {
        // Evaluamos la conclusión de la regla
        const conclusionEval = evaluateGoal(rule.conclusion, rules, facts, method, newFacts, new Set(visited));
        
        if (!conclusionEval.resolved) {
          if (!firstMissingNode) firstMissingNode = conclusionEval.missingNodeToAsk || rule.conclusion;
          continue; // Intentamos la siguiente regla
        }

        // Si la conclusión es FALSA, revisamos las demas premisas
        if (conclusionEval.value === false) {
          let otherPremisesTrue = true;

          for (const p of rule.premises) {
            if (p !== goalId) {
              const pEval = evaluateGoal(p, rules, facts, method, newFacts, new Set(visited));
              
              if (!pEval.resolved) {
                otherPremisesTrue = false;
                if (!firstMissingNode) firstMissingNode = pEval.missingNodeToAsk || p;
                break;
              }
              if (pEval.value === false) {
                otherPremisesTrue = false;
                break; // Otra premisa es falsa, Tollens no aplica aquí
              }
            }
          }

          // Si la conclusión es falsa y todas las demás premisas son ciertas encontramos la respuesta
          if (otherPremisesTrue) {
            newFacts[goalId] = false;
            return { resolved: true, value: false, inferredFacts: newFacts };
          }
        }
      }
    }
  }

  // Si agotamos absolutamente todas las reglas y caminos, pedimos el dato a usuario
  return { 
    resolved: false, 
    missingNodeToAsk: firstMissingNode || goalId, 
    inferredFacts: newFacts 
  };
};