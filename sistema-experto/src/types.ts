export type FactState = boolean | undefined;

export interface Rule {
  id: string;
  premises: string[];
  conclusion: string;
}

export type InferenceMethod = 'ponens' | 'tollens' | 'automatic';

export interface InferenceResult {
  resolved: boolean;
  value?: boolean;
  missingNodeToAsk?: string;
  inferredFacts?: Record<string, boolean>; 
}