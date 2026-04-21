import React, { useCallback, useEffect, useRef } from 'react';
import ReactFlow, { 
  addEdge, 
  Background, 
  Controls, 
  Connection, 
  Edge, 
  Node, 
  useNodesState, 
  useEdgesState,
  Handle,
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Workflow } from '../App';

const TriggerNode = ({ data, id }: any) => (
  <div className="proton-glass p-4 rounded-xl border border-proton-border min-w-[250px] shadow-lg bg-proton-card">
    <div className="text-[10px] font-mono text-proton-accent mb-3 font-bold tracking-widest uppercase">TRIGGER NODE</div>
    <div className="space-y-3">
      <div>
        <label className="text-[10px] text-proton-muted uppercase font-mono block mb-1 tracking-wider">Condition / Event</label>
        <input 
          value={data.condition || ''}
          onChange={(e) => data.onChange(id, 'condition', e.target.value)}
          placeholder="e.g. Schedule, Webhook..."
          className="nodrag w-full bg-proton-bg border border-proton-border rounded-lg px-3 py-2 sm:py-3 min-h-[44px] text-xs text-proton-text focus:border-proton-accent outline-none transition-colors"
        />
      </div>
    </div>
    <Handle type="source" position={Position.Right} className="w-4 h-4 rounded-full bg-proton-accent" />
  </div>
);

const ActionNode = ({ data, id }: any) => (
  <div className="proton-glass p-4 rounded-xl border border-proton-border min-w-[250px] shadow-lg bg-proton-card">
    <Handle type="target" position={Position.Left} className="w-4 h-4 rounded-full bg-proton-secondary" />
    <div className="text-[10px] font-mono text-proton-secondary mb-3 font-bold tracking-widest uppercase">ACTION NODE</div>
    <div className="space-y-3">
      <div>
        <label className="text-[10px] text-proton-muted uppercase font-mono block mb-1 tracking-wider">Handler Persona</label>
        <select 
          value={data.personaId || ''}
          onChange={(e) => data.onChange(id, 'personaId', e.target.value)}
          className="nodrag w-full bg-proton-bg border border-proton-border rounded-lg px-3 py-2 sm:py-3 min-h-[44px] text-xs text-proton-text outline-none focus:border-proton-accent transition-colors"
        >
          <option value="">Select Persona</option>
          {data.personas?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[10px] text-proton-muted uppercase font-mono block mb-1 tracking-wider">Action Parameters</label>
        <textarea 
          value={data.parameters || ''}
          onChange={(e) => data.onChange(id, 'parameters', e.target.value)}
          placeholder="e.g. Send an automated response..."
          className="nodrag w-full bg-proton-bg border border-proton-border rounded-lg px-3 py-2 text-xs text-proton-text outline-none focus:border-proton-accent resize-none h-20 transition-colors"
        />
      </div>
    </div>
    <Handle type="source" position={Position.Right} className="w-3 h-3 bg-proton-secondary" />
  </div>
);

const nodeTypes = { triggerNode: TriggerNode, actionNode: ActionNode };

export const WorkflowFlowEditor = ({ workflow, onSave, personas }: { workflow: Workflow, onSave: (wf: any) => void, personas: any[] }) => {
  const handleNodeDataChange = useCallback((nodeId: string, field: string, value: string) => {
    setNodes((nds) => 
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: { ...node.data, [field]: value }
          };
        }
        return node;
      })
    );
  }, []);

  const initialNodes = workflow.nodes?.length ? workflow.nodes : [
    { 
      id: 'trigger-1', 
      type: 'triggerNode', 
      position: { x: 50, y: 100 }, 
      data: { condition: workflow.trigger } 
    },
    { 
      id: 'action-1', 
      type: 'actionNode', 
      position: { x: 400, y: 100 }, 
      data: { personaId: workflow.personaId, parameters: workflow.action } 
    },
  ];
  
  const activeNodes = initialNodes.map(n => ({
    ...n,
    data: {
      ...n.data,
      personas,
      onChange: handleNodeDataChange
    }
  }));

  const initialEdges = workflow.edges?.length ? workflow.edges : [{ id: 'e1-2', source: 'trigger-1', target: 'action-1' }];

  const [nodes, setNodes, onNodesChange] = useNodesState(activeNodes as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges as Edge[]);

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  // Use a ref to debounce saves or prevent infinite loops if onSave causes a top-level rerender that remounts this
  const isInitialRender = useRef(true);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    const cleanNodes = nodes.map(n => {
      const { onChange, personas, ...cleanData } = n.data;
      return { ...n, data: cleanData };
    });
    
    // Check if real structural / data changes occurred before saving to avoid looping
    onSave((prev: Workflow) => ({
      ...prev,
      nodes: cleanNodes,
      edges
    }));
  }, [nodes, edges, onSave]);

  return (
    <div className="h-full w-full rounded-2xl overflow-hidden border border-proton-border bg-proton-bg touch-none">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background gap={12} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
};
