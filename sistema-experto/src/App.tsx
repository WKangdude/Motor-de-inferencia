import { useState, useCallback } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  addEdge, 
  applyNodeChanges,
  applyEdgeChanges, 
  type Node, 
  type Edge, 
  type Connection,
  type NodeChange, 
  type EdgeChange   
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { Rule, InferenceMethod } from './types';
import { evaluateGoal } from './inferenceEngine';



const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

export default function ExpertSystemApp() {

  const [initialFactName, setInitialFactName] = useState('');
  const [initialFactValue, setInitialFactValue] = useState<boolean>(true);
  const [method, setMethod] = useState<InferenceMethod>('automatic');

  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [rules, setRules] = useState<Rule[]>([]);
  const [facts, setFacts] = useState<Record<string, boolean>>({});
  
  const [newNodeName, setNewNodeName] = useState('');
  const [targetGoal, setTargetGoal] = useState('');
  const [questionNode, setQuestionNode] = useState<string | null>(null);
  const [evaluationResult, setEvaluationResult] = useState<string | null>(null);

  const handleAddNode = () => {
    if (!newNodeName.trim()) return;

    const names = newNodeName
      .split(',')
      .map(name => name.trim())
      .filter(name => name.length > 0);

    const newNodesToInsert = names.map((name, index) => ({
      id: name,
      position: { 
        x: (Math.random() * 200) + (index * 30), 
        y: (Math.random() * 200) + (index * 30) 
      },
      data: { label: name },
    }));

    setNodes((nds) => [...nds, ...newNodesToInsert]);
    setNewNodeName('');
  };

  // Conectar nodos (Crear una regla)
  const onConnect = useCallback((params: Connection) => {
    const source = params.source as string;
    const target = params.target as string;
    
    if (!source || !target) return;

    const uniqueId = `rule-${source}-${target}-${Date.now()}`;
    const newEdge = { ...params, id: uniqueId };
    
    setEdges((eds) => addEdge(newEdge, eds));
  
    setRules((prev) => {

      const existingRuleIndex = prev.findIndex(r => r.conclusion === target);
      
      if (existingRuleIndex >= 0) {

        const wantsAnd = window.confirm(
          `El nodo "${target}" ya tiene una regla apuntándole.\n\n` +
          `¿Quieres que "${source}" sea una condición obligatoria "Y" (AND)?\n\n` +
          `[Aceptar] = Unir a la regla existente (SI ... Y ${source} ENTONCES ${target})\n` +
          `[Cancelar] = Crear regla separada "O" (SI ${source} ENTONCES ${target})`
        );
        
        if (wantsAnd) {
          const updatedRules = [...prev];

          if (!updatedRules[existingRuleIndex].premises.includes(source)) {
            updatedRules[existingRuleIndex] = {
              ...updatedRules[existingRuleIndex],
              premises: [...updatedRules[existingRuleIndex].premises, source]
            };
          }
          return updatedRules;
        }
      }

      return [
        ...prev,
        {
          id: uniqueId,
          premises: [source],
          conclusion: target,
        }
      ];
    });
  }, []);

  // Invertir la dirección de una regla y su flecha en el lienzo
  const handleReverseRule = (ruleId: string) => {
    setRules(prevRules => prevRules.map(rule => {
      if (rule.id === ruleId) {
        return {
          ...rule,
          premises: [rule.conclusion],
          conclusion: rule.premises[0]
        };
      }
      return rule;
    }));

    setEdges(prevEdges => prevEdges.map(edge => {
      if (edge.id === ruleId) {
        return {
          ...edge,
          source: edge.target,
          target: edge.source,
          sourceHandle: edge.targetHandle,
          targetHandle: edge.sourceHandle
        };
      }
      return edge;
    }));
  };

  // Manejador para cuando mueves, seleccionas o borras nodos
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  // Manejador para cuando seleccionas o borras aristas (reglas)
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  // Iniciar evaluación del objetivo
  const handleEvaluate = () => {
    if (!targetGoal) return;
    setEvaluationResult(null);
    runInference(targetGoal);
  };

  // Ejecutar el motor
  const runInference = (goal: string, currentFacts = facts) => {
    const result = evaluateGoal(goal, rules, currentFacts, method);

    if (result.inferredFacts && Object.keys(result.inferredFacts).length > 0) {
      const newInferences = Object.entries(result.inferredFacts);
      
      newInferences.forEach(([node, value], index) => {
        setTimeout(() => {
          setFacts(prev => ({ ...prev, [node]: value }));
        }, index * 600);
      });

      setTimeout(() => {
        procesarResultadoFinal(goal, result);
      }, newInferences.length * 600);

    } else {
      procesarResultadoFinal(goal, result);
    }
  };

  // Función auxiliar para no repetir código
  const procesarResultadoFinal = (goal: string, result: any) => {
    if (result.resolved) {
      setEvaluationResult(`El nodo ${goal} es: ${result.value ? 'VERDADERO' : 'FALSO'}`);
      setQuestionNode(null);
    } else if (result.missingNodeToAsk) {
      setQuestionNode(result.missingNodeToAsk);
    }
  };

  // Responder a la pregunta del sistema
  const handleAnswerQuestion = (answer: boolean) => {
    if (questionNode) {
      const updatedFacts = { ...facts, [questionNode]: answer };
      setFacts(updatedFacts);
      setQuestionNode(null);
      setTimeout(() => {
        runInference(targetGoal, updatedFacts);
      }, 300);
    }
  };

  // Limpiar todo el lienzo y la memoria
  const handleClearAll = () => {
    setNodes([]);
    setEdges([]);
    setRules([]);
    setFacts({});
    setTargetGoal('');
    setEvaluationResult(null);
    setQuestionNode(null);
  };

  // Insertar el ejemplo de las diapositivas de clase
  const handleInsertExample = () => {
    // Limpiar todo primero
    handleClearAll();

    // Definir los nodos con posiciones (x, y) para que parezcan un árbol jerárquico
    const exampleNodes: Node[] = [
      { id: 'A', position: { x: 50, y: 50 }, data: { label: 'A' } },
      { id: 'B', position: { x: 150, y: 50 }, data: { label: 'B' } },
      { id: 'D', position: { x: 250, y: 50 }, data: { label: 'D' } },
      { id: 'E', position: { x: 350, y: 50 }, data: { label: 'E' } },
      { id: 'F', position: { x: 450, y: 50 }, data: { label: 'F' } },
      { id: 'H', position: { x: 550, y: 50 }, data: { label: 'H' } },
      { id: 'I', position: { x: 650, y: 50 }, data: { label: 'I' } },
      { id: 'C', position: { x: 100, y: 150 }, data: { label: 'C' } },
      { id: 'G', position: { x: 350, y: 150 }, data: { label: 'G' } },
      { id: 'J', position: { x: 600, y: 150 }, data: { label: 'J' } },
      { id: 'K', position: { x: 225, y: 250 }, data: { label: 'K' } },
      { id: 'L', position: { x: 475, y: 250 }, data: { label: 'L' } },
      { id: 'M', position: { x: 350, y: 350 }, data: { label: 'M' } },
    ];

    // Definir las conexiones visuales (Flechas)
    const exampleEdges: Edge[] = [
      // Regla 1
      { id: 'e-A-C', source: 'A', target: 'C' },
      { id: 'e-B-C', source: 'B', target: 'C' },
      // Regla 2
      { id: 'e-D-G', source: 'D', target: 'G' },
      { id: 'e-E-G', source: 'E', target: 'G' },
      { id: 'e-F-G', source: 'F', target: 'G' },
      // Regla 3
      { id: 'e-H-J', source: 'H', target: 'J' },
      { id: 'e-I-J', source: 'I', target: 'J' },
      // Regla 4 (C o G -> K)
      { id: 'e-C-K', source: 'C', target: 'K' },
      { id: 'e-G-K', source: 'G', target: 'K' },
      // Regla 5
      { id: 'e-G-L', source: 'G', target: 'L' },
      { id: 'e-J-L', source: 'J', target: 'L' },
      // Regla 6
      { id: 'e-K-M', source: 'K', target: 'M' },
      { id: 'e-L-M', source: 'L', target: 'M' },
    ];

    // Definir las reglas lógicas para el motor
    const exampleRules: Rule[] = [
      { id: 'regla-1', premises: ['A', 'B'], conclusion: 'C' },
      { id: 'regla-2', premises: ['D', 'E', 'F'], conclusion: 'G' },
      { id: 'regla-3', premises: ['H', 'I'], conclusion: 'J' },
      { id: 'regla-4a', premises: ['C'], conclusion: 'K' }, 
      { id: 'regla-4b', premises: ['G'], conclusion: 'K' }, 
      { id: 'regla-5', premises: ['G', 'J'], conclusion: 'L' },
      { id: 'regla-6', premises: ['K', 'L'], conclusion: 'M' },
    ];

    setNodes(exampleNodes);
    setEdges(exampleEdges);
    setRules(exampleRules);
  };

  // Nodos derivados con colores dinámicos según los hechos
  const coloredNodes = nodes.map((node) => {
    let bgColor = '#ffffff'; // Blanco por defecto
    let textColor = '#333333';
    let borderColor = '#222222';

    if (facts[node.id] === true) {
      bgColor = '#4ade80'; // Verde (Verdadero)
      textColor = '#064e3b';
      borderColor = '#166534';
    } else if (facts[node.id] === false) {
      bgColor = '#f87171'; // Rojo (Falso)
      textColor = '#450a0a';
      borderColor = '#991b1b';
    }

    return {
      ...node,
      style: { 
        ...node.style, 
        backgroundColor: bgColor, 
        color: textColor, 
        borderColor: borderColor,
        borderWidth: '2px',
        fontWeight: 'bold', 
        borderRadius: '8px', 
        padding: '6px 16px', 
        minWidth: 'auto',    
        width: 'auto',       
        display: 'flex',     
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
      }
    };
  });

  return (
    <div className="flex h-screen w-full font-sans">
      {/* Panel de Control Lateral */}
      <div className="w-96 bg-gray-100 p-4 border-r flex flex-col gap-6 overflow-y-auto shadow-md z-10">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-xl font-bold text-gray-800">Motor de Inferencia</h1>
          <div className="flex gap-1">
            <button 
              onClick={handleInsertExample}
              className="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold py-1 px-2 rounded transition-colors"
            >
              Cargar Ejemplo
            </button>
            <button 
              onClick={handleClearAll}
              className="text-xs bg-red-100 hover:bg-red-200 text-red-700 font-bold py-1 px-2 rounded transition-colors"
            >
              Limpiar Todo
            </button>
          </div>
        </div>
        
        {/* Sección 1: Crear Nodos */}
        <div className="bg-white p-3 rounded shadow-sm">
          <h2 className="font-semibold mb-2 text-sm text-gray-700">1. Agregar Nodo</h2>
          <div className="flex gap-2">
            <input 
              className="border p-1 w-full rounded text-sm outline-none focus:border-blue-400"
              value={newNodeName} 
              onChange={(e) => setNewNodeName(e.target.value.toUpperCase())} 
              placeholder="Ej. K, L, M"
            />
            <button className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded transition-colors font-bold" onClick={handleAddNode}>+</button>
          </div>
        </div>

        {/* Sección 2: Base de Conocimiento (Reglas) */}
        <div className="bg-white p-3 rounded shadow-sm">
          <h2 className="font-semibold mb-2 text-sm text-gray-700">2. Base de Conocimiento (Reglas)</h2>
          {rules.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Conecta nodos arrastrando de uno a otro para crear reglas lógicas.</p>
          ) : (
            <ul className="text-xs space-y-2 max-h-32 overflow-y-auto pr-1">
              {rules.map((r) => (
                <li key={r.id} className="bg-gray-50 p-2 rounded border border-gray-200 flex justify-between items-center group hover:bg-gray-100 transition-colors">
                  <div>
                    <span className="font-bold text-blue-600">SI</span> {r.premises.join(' y ')} <span className="font-bold text-blue-600">ENTONCES</span> {r.conclusion}
                  </div>
                  <button 
                    onClick={() => handleReverseRule(r.id)}
                    className="bg-gray-200 hover:bg-blue-500 hover:text-white text-gray-600 px-2 py-1 rounded text-xs font-bold transition-colors opacity-0 group-hover:opacity-100"
                    title="Invertir dirección de la regla"
                  >
                    ⇄
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Sección 3: Base de Hechos */}
        <div className="bg-white p-3 rounded shadow-sm">
          <h2 className="font-semibold mb-2 text-sm text-gray-700">2. Hechos Iniciales (Memoria de Trabajo)</h2>
          <div className="flex gap-2 mb-2">
            <input 
              className="border p-1 w-1/2 rounded text-sm"
              value={initialFactName} 
              onChange={(e) => setInitialFactName(e.target.value.toUpperCase())} 
              placeholder="Nodo"
            />
            <select 
              className="border p-1 w-1/2 rounded text-sm bg-white"
              value={initialFactValue ? 'true' : 'false'}
              onChange={(e) => setInitialFactValue(e.target.value === 'true')}
            >
              <option value="true">Verdadero</option>
              <option value="false">Falso</option>
            </select>
            <button 
              className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded transition-colors" 
              onClick={() => {
                if(initialFactName) {
                  setFacts(prev => ({...prev, [initialFactName]: initialFactValue}));
                  setInitialFactName('');
                }
              }}
            >
              +
            </button>
          </div>

          {/* Mostrar hechos actuales */}
          <div className="flex flex-wrap gap-1 mt-2">
            {Object.entries(facts).map(([key, val]) => (
              <span 
                key={key} 
                onClick={() => {
                  const newFacts = {...facts};
                  delete newFacts[key];
                  setFacts(newFacts);
                }}
                className={`text-xs px-2 py-1 rounded font-bold text-white cursor-pointer hover:opacity-75 transition-opacity ${val ? 'bg-green-500' : 'bg-red-500'}`}
                title="Clic para eliminar este hecho"
              >
                {key}: {val ? 'V' : 'F'} &times;
              </span>
            ))}
          </div>
        </div>

        {/* Sección 4: Evaluación y Método */}
        <div className="bg-white p-3 rounded shadow-sm border-t-4 border-blue-500">
          <h2 className="font-semibold mb-2 text-sm text-gray-700">3. Evaluar Objetivo</h2>
          
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Método de Inferencia</label>
          <select 
            className="border p-2 w-full rounded text-sm mb-3 bg-gray-50 cursor-pointer font-medium"
            value={method}
            onChange={(e) => setMethod(e.target.value as InferenceMethod)}
          >
            <option value="automatic">Automático (Ponens + Tollens)</option>
            <option value="ponens">Modus Ponens (Hacia adelante)</option>
            <option value="tollens">Modus Tollens (Hacia atrás)</option>
          </select>

          <input 
            className="border p-2 w-full rounded text-sm mb-2 focus:ring-2 focus:ring-blue-300 outline-none"
            value={targetGoal} 
            onChange={(e) => setTargetGoal(e.target.value.toUpperCase())} 
            placeholder="Nodo objetivo (Ej. M o L)"
          />
          <button className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 w-full rounded transition-colors" onClick={handleEvaluate}>
            Resolver
          </button>
        </div>

        {questionNode && (
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded shadow-md animate-pulse">
            <p className="font-bold text-yellow-800 text-sm">El motor requiere datos:</p>
            <p className="text-sm my-1">¿Es verdadero o falso el hecho <span className="font-bold text-lg">{questionNode}</span>?</p>
            <div className="flex gap-2 mt-3">
              <button className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded w-full text-sm font-bold shadow" onClick={() => handleAnswerQuestion(true)}>Verdadero</button>
              <button className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded w-full text-sm font-bold shadow" onClick={() => handleAnswerQuestion(false)}>Falso</button>
            </div>
          </div>
        )}

        {/* Resultado Final */}
        {evaluationResult && (
          <div className={`border p-4 rounded text-center font-bold shadow-md text-lg ${evaluationResult.includes('VERDADERO') ? 'bg-green-100 border-green-500 text-green-800' : 'bg-red-100 border-red-500 text-red-800'}`}>
            {evaluationResult}
          </div>
        )}
      </div>

      {/* Lienzo del Grafo */}
      <div className="flex-1 h-full relative">
        <ReactFlow 
          nodes={coloredNodes}
          edges={edges} 
          onConnect={onConnect}
          onNodesChange={onNodesChange} 
          onEdgesChange={onEdgesChange} 
          fitView
        >
          <Background color="#ccc" gap={16} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}