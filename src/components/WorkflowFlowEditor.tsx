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
import { Zap, Cpu, Calculator } from 'lucide-react';

const TriggerNode = ({ data, id }: any) => (
  <div className="proton-glass p-6 rounded-[32px] border border-proton-border min-w-[280px] shadow-2xl bg-proton-card/50 relative overflow-hidden group">
    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-30 transition-opacity">
        <Zap size={40} className="text-proton-accent" />
    </div>
    <div className="text-[9px] font-mono text-proton-accent mb-4 font-bold tracking-[0.3em] uppercase flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-proton-accent animate-pulse" />
        STEP 01: TRIGGER / ტრიგერი
    </div>
    <div className="space-y-4">
      <div>
        <label className="text-[9px] text-proton-muted uppercase font-mono block mb-2 tracking-widest font-bold">EVENT CONDITION</label>
        <input 
          value={data.condition || ''}
          onChange={(e) => data.onChange(id, 'condition', e.target.value)}
          placeholder="e.g. New User Joined..."
          className="nodrag w-full bg-proton-bg/80 border border-proton-border rounded-2xl px-4 py-3 text-xs text-proton-text focus:border-proton-accent focus:ring-1 focus:ring-proton-accent/20 outline-none transition-all shadow-inner"
        />
      </div>
      <p className="text-[10px] text-proton-muted italic opacity-60">This event starts the automation chain.</p>
    </div>
    <Handle type="source" position={Position.Right} className="w-5 h-5 !bg-proton-accent border-4 border-proton-bg shadow-lg" />
  </div>
);

const LogicNode = ({ data, id }: any) => (
  <div className="proton-glass p-6 rounded-[32px] border border-proton-border min-w-[280px] shadow-2xl bg-proton-card/50 relative overflow-hidden group">
    <Handle type="target" position={Position.Left} className="w-5 h-5 !bg-proton-muted border-4 border-proton-bg shadow-lg" />
    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-30 transition-opacity">
        <Calculator size={40} className="text-proton-muted" />
    </div>
    <div className="text-[9px] font-mono text-proton-muted mb-4 font-bold tracking-[0.3em] uppercase flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-proton-muted" />
        STEP 01.5: LOGIC / ლოგიკა
    </div>
    <div className="space-y-4">
      <div>
        <label className="text-[9px] text-proton-muted uppercase font-mono block mb-2 tracking-widest font-bold">CALCULATION FORMULA</label>
        <textarea 
          value={data.formula || ''}
          onChange={(e) => data.onChange(id, 'formula', e.target.value)}
          placeholder="e.g. Material + Labor + 30% Margin"
          className="nodrag w-full bg-proton-bg/80 border border-proton-border rounded-2xl px-4 py-3 text-xs text-proton-text outline-none focus:border-proton-muted resize-none h-24 transition-all shadow-inner"
        />
      </div>
    </div>
    <Handle type="source" position={Position.Right} className="w-5 h-5 !bg-proton-muted border-4 border-proton-bg shadow-lg" />
  </div>
);

const ActionNode = ({ data, id }: any) => (
  <div className="proton-glass p-6 rounded-[32px] border border-proton-border min-w-[280px] shadow-2xl bg-proton-card/50 relative overflow-hidden group">
    <Handle type="target" position={Position.Left} className="w-5 h-5 !bg-proton-secondary border-4 border-proton-bg shadow-lg" />
    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-30 transition-opacity">
        <Cpu size={40} className="text-proton-secondary" />
    </div>
    <div className="text-[9px] font-mono text-proton-secondary mb-4 font-bold tracking-[0.3em] uppercase flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-proton-secondary" />
        STEP 02: ACTION / მოქმედება
    </div>
    <div className="space-y-4">
      <div>
        <label className="text-[9px] text-proton-muted uppercase font-mono block mb-2 tracking-widest font-bold">EXECUTOR AGENT</label>
        <select 
          value={data.personaId || ''}
          onChange={(e) => data.onChange(id, 'personaId', e.target.value)}
          className="nodrag w-full bg-proton-bg/80 border border-proton-border rounded-2xl px-4 py-3 text-xs text-proton-text outline-none focus:border-proton-secondary transition-all shadow-inner cursor-pointer"
        >
          <option value="">Select Persona</option>
          {data.personas?.map((p: any) => <option key={p.id} value={p.id}>{p.avatar} {p.name}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[9px] text-proton-muted uppercase font-mono block mb-2 tracking-widest font-bold">INSTRUCTIONS</label>
        <textarea 
          value={data.parameters || ''}
          onChange={(e) => data.onChange(id, 'parameters', e.target.value)}
          placeholder="What should the agent do?"
          className="nodrag w-full bg-proton-bg/80 border border-proton-border rounded-2xl px-4 py-3 text-xs text-proton-text outline-none focus:border-proton-secondary resize-none h-24 transition-all shadow-inner"
        />
      </div>
    </div>
    <Handle type="source" position={Position.Right} className="w-4 h-4 !bg-proton-secondary opacity-50" />
  </div>
);

const nodeTypes = { triggerNode: TriggerNode, actionNode: ActionNode, logicNode: LogicNode };

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
