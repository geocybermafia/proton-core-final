import React, { useCallback } from 'react';
import ReactFlow, { 
  addEdge, 
  Background, 
  Controls, 
  Connection, 
  Edge, 
  Node, 
  useNodesState, 
  useEdgesState 
} from 'reactflow';
import { Persona } from '../services/gemini';
import { Workflow } from '../App';

// Basic custom node component for Persona selection
const PersonaNode = ({ data }: { data: { label: string, personaId: string, personas: any[], onChange: (id: string) => void } }) => (
  <div className="proton-glass p-4 rounded-xl border border-proton-border min-w-[200px]">
    <div className="text-xs font-mono text-proton-muted mb-2">{data.label}</div>
    <select 
      value={data.personaId}
      onChange={(e) => data.onChange(e.target.value)}
      className="w-full bg-proton-bg border border-proton-border rounded-lg px-2 py-1 text-xs text-proton-text"
    >
      <option value="">Select Persona</option>
      {data.personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  </div>
);

const nodeTypes = { persona: PersonaNode };

export const WorkflowFlowEditor = ({ workflow, onSave, personas }: { workflow: Workflow, onSave: (wf: any) => void, personas: any[] }) => {
  const initialNodes = [
    { id: '1', type: 'persona', position: { x: 50, y: 50 }, data: { label: 'Trigger', personaId: workflow.personaId, personas, onChange: (id: string) => {} } },
    { id: '2', type: 'persona', position: { x: 300, y: 50 }, data: { label: 'Action', personaId: workflow.personaId, personas, onChange: (id: string) => {} } },
  ];
  const initialEdges = [{ id: 'e1-2', source: '1', target: '2' }];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges as Edge[]);

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  return (
    <div className="h-[500px] w-full rounded-2xl overflow-hidden border border-proton-border">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
};
