import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as d3 from 'd3';
import Papa from 'papaparse';
import { ArrowLeft, ZoomIn, ZoomOut, Maximize, Move, Image as ImageIcon, Layout, RefreshCw, X, ArrowUp, ArrowDown, Trash2, Link as LinkIcon, Maximize2, AlignLeft, AlignCenter, AlignRight, Sliders, Layers } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface Node extends d3.SimulationNodeDatum {
  id: string;
  type: 'group' | 'item' | 'photo';
  label: string;
  content?: string;
  groupId?: string;
  url?: string;
  itemType?: string;
  photoIndex?: number;
  parentItemId?: string;
  width?: number;
  alignment?: string;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
  type: 'sequential' | 'photo-attach';
}

export default function FluidView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const noteId = searchParams.get('noteId');
  const svgRef = useRef<SVGSVGElement>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [imagePlacements, setImagePlacements] = useState<Record<string, any[]>>({});
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isReattaching, setIsReattaching] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null);
  const nodesRef = useRef<Node[]>([]);
  const linksRef = useRef<Link[]>([]);

  useEffect(() => {
    const savedParsedData = localStorage.getItem('arcane-notes-parsed-data');
    const savedImagePlacements = localStorage.getItem('arcane-notes-image-placements');

    if (savedParsedData) setParsedData(JSON.parse(savedParsedData));
    if (savedImagePlacements) setImagePlacements(JSON.parse(savedImagePlacements));
  }, []);

  const stringifyData = (data: any[]) => {
    const promptFormat = localStorage.getItem('arcane-notes-prompt-format') || 'CSV';
    if (promptFormat === 'JSON') {
      return JSON.stringify(data, null, 2);
    } else {
      // CSV
      const rows: any[] = [];
      data.forEach(group => {
        if (group.ITEMS && Array.isArray(group.ITEMS)) {
          group.ITEMS.forEach((item: any) => {
            rows.push({
              GROUP: group.GROUP || '',
              TYPE: item.TYPE || '',
              CONTENT: item.CONTENT || ''
            });
          });
        }
      });
      return Papa.unparse(rows);
    }
  };

  const saveToLocalStorage = (data: any[], placements: Record<string, any[]>) => {
    localStorage.setItem('arcane-notes-parsed-data', JSON.stringify(data));
    localStorage.setItem('arcane-notes-image-placements', JSON.stringify(placements));
    
    // Also update the input string in localStorage so Parser stays in sync
    const syncedInput = stringifyData(data);
    localStorage.setItem('arcane-notes-input', syncedInput);

    // Also update the saved note if we have a noteId
    if (noteId) {
      const savedNotes = JSON.parse(localStorage.getItem('arcane_saved_notes') || '[]');
      const noteIndex = savedNotes.findIndex((n: any) => n.id === noteId);
      if (noteIndex !== -1) {
        savedNotes[noteIndex].parsedData = data;
        savedNotes[noteIndex].imagePlacements = placements;
        localStorage.setItem('arcane_saved_notes', JSON.stringify(savedNotes));
      }
    }
  };

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  useEffect(() => {
    if (!parsedData.length || !svgRef.current) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const newNodes: Node[] = [];
    const newLinks: Link[] = [];

    // Build graph
    parsedData.forEach((group, gIdx) => {
      const groupId = group.id || `group-${gIdx}`;
      const isCollapsed = collapsedGroups.has(groupId);

      // Group node
      newNodes.push({
        id: groupId,
        type: 'group',
        label: group.GROUP,
        groupId: groupId
      });

      if (!isCollapsed) {
        group.ITEMS.forEach((item: any, iIdx: number) => {
          const nodeId = item.id || `item-${gIdx}-${iIdx}`;
          newNodes.push({
            id: nodeId,
            type: 'item',
            label: item.TYPE,
            content: item.CONTENT,
            groupId: groupId,
            itemType: item.TYPE
          });

          // Link Group node to first item
          if (iIdx === 0) {
            newLinks.push({
              source: groupId,
              target: nodeId,
              type: 'sequential'
            });
          }

          // Link to previous item in group (Train structure)
          if (iIdx > 0) {
            newLinks.push({
              source: group.ITEMS[iIdx - 1].id || `item-${gIdx}-${iIdx - 1}`,
              target: nodeId,
              type: 'sequential'
            });
          }

          // Link to photos
          const placements = imagePlacements[nodeId] || [];
          placements.forEach((photo, pIdx) => {
            if (!photo) return;
            const photoId = `photo-${nodeId}-${pIdx}`;
            newNodes.push({
              id: photoId,
              type: 'photo',
              label: 'Photo',
              url: photo.url,
              groupId: groupId,
              photoIndex: pIdx,
              parentItemId: nodeId,
              width: photo.width,
              alignment: photo.alignment
            });
            newLinks.push({
              source: nodeId,
              target: photoId,
              type: 'photo-attach'
            });
          });
        });
      }
    });

    // Preserve node positions
    newNodes.forEach(newNode => {
      const oldNode = nodesRef.current.find(n => n.id === newNode.id);
      if (oldNode) {
        newNode.x = oldNode.x;
        newNode.y = oldNode.y;
        newNode.vx = oldNode.vx;
        newNode.vy = oldNode.vy;
      }
    });

    nodesRef.current = newNodes;
    linksRef.current = newLinks;

    const svg = d3.select(svgRef.current);
    
    // Initialize SVG structure if not already done
    if (svg.select('g.main-container').empty()) {
      svg.selectAll('*').remove();
      
      const defs = svg.append('defs');
      
      // Glow filter
      const filter = defs.append('filter')
        .attr('id', 'glow')
        .attr('x', '-50%')
        .attr('y', '-50%')
        .attr('width', '200%')
        .attr('height', '200%');
      
      filter.append('feGaussianBlur')
        .attr('stdDeviation', '4')
        .attr('result', 'blur');
      
      filter.append('feComposite')
        .attr('in', 'SourceGraphic')
        .attr('in2', 'blur')
        .attr('operator', 'over');

      const pattern = defs.append('pattern')
        .attr('id', 'grid')
        .attr('width', 100)
        .attr('height', 100)
        .attr('patternUnits', 'userSpaceOnUse');
      
      pattern.append('path')
        .attr('d', 'M 100 0 L 0 0 0 100')
        .attr('fill', 'none')
        .attr('stroke', '#e2e8f0')
        .attr('stroke-width', 1);

      svg.append('rect')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('fill', 'url(#grid)');

      const mainContainer = svg.append('g').attr('class', 'main-container');
      mainContainer.append('g').attr('class', 'hulls');
      mainContainer.append('g').attr('class', 'links');
      mainContainer.append('g').attr('class', 'link-labels');
      mainContainer.append('g').attr('class', 'nodes');

      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 10])
        .on('zoom', (event) => {
          mainContainer.attr('transform', event.transform);
          setZoomLevel(event.transform.k);
        });

      svg.call(zoom);

      // Zoom controls
      d3.select('#zoom-in').on('click', () => svg.transition().call(zoom.scaleBy, 1.2));
      d3.select('#zoom-out').on('click', () => svg.transition().call(zoom.scaleBy, 0.8));
      d3.select('#zoom-reset').on('click', () => svg.transition().call(zoom.transform, d3.zoomIdentity));
    }

    const mainContainer = svg.select('g.main-container');
    const hullGroup = mainContainer.select('g.hulls');
    const linkGroup = mainContainer.select('g.links');
    const linkLabelGroup = mainContainer.select('g.link-labels');
    const nodeGroup = mainContainer.select('g.nodes');

    // Simulation
    if (!simulationRef.current) {
      simulationRef.current = d3.forceSimulation<Node>(newNodes)
        .force('link', d3.forceLink<Node, Link>(newLinks).id(d => d.id).distance(d => d.type === 'sequential' ? 150 : 200))
        .force('charge', d3.forceManyBody().strength(-1000))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(100));
    } else {
      simulationRef.current.nodes(newNodes);
      (simulationRef.current.force('link') as d3.ForceLink<Node, Link>).links(newLinks);
      simulationRef.current.alpha(0.3).restart();
    }

    const simulation = simulationRef.current;

    // Update Links
    const link = linkGroup.selectAll<SVGLineElement, Link>('line')
      .data(newLinks, (d: any) => `${d.source.id || d.source}-${d.target.id || d.target}`);

    link.exit().transition().duration(500).attr('stroke-opacity', 0).remove();

    const linkEnter = link.enter().append('line')
      .attr('stroke-opacity', 0)
      .attr('stroke', d => d.type === 'sequential' ? '#cbd5e1' : '#94a3b8')
      .attr('stroke-width', d => d.type === 'sequential' ? 4 : 2)
      .attr('stroke-dasharray', d => d.type === 'photo-attach' ? '5,5' : 'none');
    
    linkEnter.transition().duration(500).attr('stroke-opacity', 1);

    const linkMerged = linkEnter.merge(link);

    // Update Link Labels
    const linkLabel = linkLabelGroup.selectAll<SVGTextElement, Link>('text')
      .data(newLinks.filter(d => d.type === 'sequential'), (d: any) => `${d.source.id || d.source}-${d.target.id || d.target}`);

    linkLabel.exit().remove();

    const linkLabelEnter = linkLabel.enter().append('text')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('fill', '#64748b')
      .attr('text-anchor', 'middle')
      .text(d => {
        const targetNode = newNodes.find(n => n.id === (typeof d.target === 'string' ? d.target : d.target.id));
        return targetNode?.label || '';
      });

    const linkLabelMerged = linkLabelEnter.merge(linkLabel);

    // Update Nodes
    const node = nodeGroup.selectAll<SVGGElement, Node>('g.node')
      .data(newNodes, d => d.id);

    node.exit().transition().duration(500).attr('opacity', 0).remove();

    const nodeEnter = node.enter().append('g')
      .attr('class', 'node')
      .attr('opacity', 0)
      .on('click', (event, d) => {
        event.stopPropagation();
        if (d.type === 'group') {
          toggleGroupCollapse(d.id);
        } else {
          setSelectedNode(d);
        }
      })
      .call(d3.drag<SVGGElement, Node>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    nodeEnter.transition().duration(500).attr('opacity', 1);

    // Group nodes
    nodeEnter.filter(d => d.type === 'group')
      .append('circle')
      .attr('r', 60)
      .attr('fill', '#3b82f6')
      .attr('fill-opacity', 0.1)
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 3)
      .attr('stroke-dasharray', d => collapsedGroups.has(d.id) ? '5,5' : 'none')
      .attr('filter', 'url(#glow)');

    nodeEnter.filter(d => d.type === 'group')
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 5)
      .attr('font-weight', 'black')
      .attr('font-size', '14px')
      .attr('fill', '#1e40af')
      .attr('class', 'group-label')
      .text(d => d.label);

    nodeEnter.filter(d => d.type === 'group')
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 25)
      .attr('font-size', '8px')
      .attr('font-weight', 'bold')
      .attr('fill', '#3b82f6')
      .text(d => collapsedGroups.has(d.id) ? 'EXPAND' : 'COLLAPSE');

    // Update group node text for existing nodes
    node.filter(d => d.type === 'group').select('text.group-label').text(d => d.label);
    node.filter(d => d.type === 'group').select('circle').attr('stroke-dasharray', d => collapsedGroups.has(d.id) ? '5,5' : 'none');
    node.filter(d => d.type === 'group').selectAll<SVGTextElement, Node>('text').filter((_, i) => i === 1).text(d => collapsedGroups.has(d.id) ? 'EXPAND' : 'COLLAPSE');

    // Item nodes
    nodeEnter.filter(d => d.type === 'item')
      .append('rect')
      .attr('width', 180)
      .attr('height', 80)
      .attr('x', -90)
      .attr('y', -40)
      .attr('rx', 12)
      .attr('fill', '#ffffff')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2)
      .attr('filter', 'url(#glow)');

    nodeEnter.filter(d => d.type === 'item')
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', -10)
      .attr('font-weight', 'bold')
      .attr('font-size', '12px')
      .attr('fill', '#1e293b')
      .text(d => d.label);

    nodeEnter.filter(d => d.type === 'item')
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 15)
      .attr('font-size', '10px')
      .attr('fill', '#64748b')
      .text(d => d.content?.substring(0, 30) + (d.content && d.content.length > 30 ? '...' : ''));

    // Photo nodes
    nodeEnter.filter(d => d.type === 'photo')
      .append('circle')
      .attr('r', 40)
      .attr('fill', '#f8fafc')
      .attr('stroke', '#a855f7')
      .attr('stroke-width', 2)
      .attr('filter', 'url(#glow)');

    nodeEnter.filter(d => d.type === 'photo')
      .append('clipPath')
      .attr('id', d => `clip-${d.id}`)
      .append('circle')
      .attr('r', 38);

    nodeEnter.filter(d => d.type === 'photo')
      .append('image')
      .attr('xlink:href', d => d.url || '')
      .attr('width', 80)
      .attr('height', 80)
      .attr('x', -40)
      .attr('y', -40)
      .attr('clip-path', d => `url(#clip-${d.id})`)
      .attr('preserveAspectRatio', 'xMidYMid slice');

    const nodeMerged = nodeEnter.merge(node);

    simulation.on('tick', () => {
      linkMerged
        .attr('x1', d => (d.source as Node).x!)
        .attr('y1', d => (d.source as Node).y!)
        .attr('x2', d => (d.target as Node).x!)
        .attr('y2', d => (d.target as Node).y!);

      linkLabelMerged
        .attr('x', d => ((d.source as Node).x! + (d.target as Node).x!) / 2)
        .attr('y', d => ((d.source as Node).y! + (d.target as Node).y!) / 2 - 10);

      nodeMerged.attr('transform', d => `translate(${d.x},${d.y})`);

      // Update hulls
      const groupIds = Array.from(new Set(newNodes.map(n => n.groupId)));
      const hulls = groupIds.map(gid => {
        const groupNodes = newNodes.filter(n => n.groupId === gid);
        if (groupNodes.length < 3) return null;
        const points: [number, number][] = groupNodes.map(n => [n.x!, n.y!]);
        return { id: gid, polygon: d3.polygonHull(points) };
      }).filter(h => h && h.polygon);

      const hullSelection = hullGroup.selectAll<SVGPathElement, any>('path').data(hulls, d => d.id);
      
      hullSelection.enter()
        .append('path')
        .attr('fill', '#3b82f6')
        .attr('fill-opacity', 0.05)
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 20)
        .attr('stroke-linejoin', 'round')
        .attr('stroke-opacity', 0.1)
        .merge(hullSelection)
        .attr('d', d => `M${d.polygon.join('L')}Z`);

      hullSelection.exit().remove();
    });

    function dragstarted(event: any, d: Node) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: Node) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: Node) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;

      // Check for reordering
      if (d.type === 'item') {
        // Find nearest item node
        const nearest = newNodes.find(n => n.id !== d.id && n.type === 'item' && n.groupId === d.groupId && 
          Math.sqrt(Math.pow(n.x! - event.x, 2) + Math.pow(n.y! - event.y, 2)) < 50);
        
        if (nearest) {
          handleReorder(d.id, nearest.id);
        }
      }
    }

    function handleReorder(sourceId: string, targetId: string) {
      setParsedData(prev => {
        const newData = [...prev];
        const groupIndex = newData.findIndex(g => g.ITEMS.some((i: any) => i.id === sourceId));
        if (groupIndex === -1) return prev;

        const group = { ...newData[groupIndex], ITEMS: [...newData[groupIndex].ITEMS] };
        const sIdx = group.ITEMS.findIndex((i: any) => i.id === sourceId);
        const tIdx = group.ITEMS.findIndex((i: any) => i.id === targetId);

        if (sIdx !== -1 && tIdx !== -1) {
          const [removed] = group.ITEMS.splice(sIdx, 1);
          group.ITEMS.splice(tIdx, 0, removed);
          newData[groupIndex] = group;
          saveToLocalStorage(newData, imagePlacements);
          return newData;
        }
        return prev;
      });
    }

  }, [parsedData, imagePlacements, collapsedGroups]);

  const handleSwap = (direction: 'up' | 'down') => {
    if (!selectedNode || selectedNode.type !== 'item') return;
    
    setParsedData(prev => {
      const newData = [...prev];
      const groupIndex = newData.findIndex(g => g.id === selectedNode.groupId);
      if (groupIndex === -1) return prev;

      const group = { ...newData[groupIndex], ITEMS: [...newData[groupIndex].ITEMS] };
      const idx = group.ITEMS.findIndex((i: any) => i.id === selectedNode.id);
      
      if (direction === 'up' && idx > 0) {
        const temp = group.ITEMS[idx];
        group.ITEMS[idx] = group.ITEMS[idx - 1];
        group.ITEMS[idx - 1] = temp;
      } else if (direction === 'down' && idx < group.ITEMS.length - 1) {
        const temp = group.ITEMS[idx];
        group.ITEMS[idx] = group.ITEMS[idx + 1];
        group.ITEMS[idx + 1] = temp;
      } else {
        return prev;
      }

      newData[groupIndex] = group;
      saveToLocalStorage(newData, imagePlacements);
      return newData;
    });
    setSelectedNode(null);
  };

  const handleDeleteItem = () => {
    if (!selectedNode || selectedNode.type !== 'item') return;
    
    setParsedData(prev => {
      const newData = [...prev];
      const groupIndex = newData.findIndex(g => g.id === selectedNode.groupId);
      if (groupIndex === -1) return prev;

      const group = { ...newData[groupIndex], ITEMS: [...newData[groupIndex].ITEMS] };
      group.ITEMS = group.ITEMS.filter((i: any) => i.id !== selectedNode.id);
      
      newData[groupIndex] = group;
      
      // Also clean up image placements
      const newPlacements = { ...imagePlacements };
      delete newPlacements[selectedNode.id];
      setImagePlacements(newPlacements);
      
      saveToLocalStorage(newData, newPlacements);
      return newData;
    });
    setSelectedNode(null);
  };

  const handleUpdatePhoto = (updates: any) => {
    if (!selectedNode || selectedNode.type !== 'photo' || !selectedNode.parentItemId) return;
    
    setImagePlacements(prev => {
      const newPlacements = { ...prev };
      const parentId = selectedNode.parentItemId!;
      const idx = selectedNode.photoIndex!;
      
      if (newPlacements[parentId] && newPlacements[parentId][idx]) {
        newPlacements[parentId] = [...newPlacements[parentId]];
        newPlacements[parentId][idx] = { ...newPlacements[parentId][idx], ...updates };
      }
      
      saveToLocalStorage(parsedData, newPlacements);
      return newPlacements;
    });
    
    // Update selectedNode locally to reflect changes in UI immediately
    setSelectedNode(prev => prev ? { ...prev, ...updates } : null);
  };

  const handleReattachPhoto = (newParentId: string) => {
    if (!selectedNode || selectedNode.type !== 'photo' || !selectedNode.parentItemId) return;
    
    setImagePlacements(prev => {
      const newPlacements = { ...prev };
      const oldParentId = selectedNode.parentItemId!;
      const idx = selectedNode.photoIndex!;
      
      if (!newPlacements[oldParentId]) return prev;
      
      const [photo] = newPlacements[oldParentId].splice(idx, 1);
      if (!photo) return prev;
      
      if (!newPlacements[newParentId]) newPlacements[newParentId] = [];
      newPlacements[newParentId].push(photo);
      
      saveToLocalStorage(parsedData, newPlacements);
      return newPlacements;
    });
    setIsReattaching(false);
    setSelectedNode(null);
  };

  return (
    <div className="fixed inset-0 bg-slate-50 overflow-hidden" onClick={() => setSelectedNode(null)}>
      {/* UI Overlay */}
      <div className="absolute top-6 left-6 z-50 flex items-center space-x-4">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/parser${noteId ? `?noteId=${noteId}` : ''}`);
          }}
          className="flex items-center px-4 py-3 bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 text-slate-600 hover:text-blue-600 transition-all active:scale-95 group"
        >
          <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
          <span className="font-bold text-sm">Back to Preview</span>
        </button>
        <div className="bg-white/80 backdrop-blur-md px-6 py-3 rounded-2xl shadow-xl border border-white/20">
          <h1 className="text-lg font-bold text-slate-800 flex items-center leading-none">
            <div className="p-1.5 bg-blue-500 rounded-lg mr-2 shadow-sm">
              <Layout className="w-4 h-4 text-white" />
            </div>
            Fluid Mode
          </h1>
          <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1 leading-none">Interactive Force Graph</p>
        </div>
      </div>

      <div className="absolute top-6 right-6 z-50 flex flex-col space-y-3">
        <div className="bg-white p-2 rounded-2xl shadow-lg border border-slate-200 flex flex-col space-y-2">
          <button id="zoom-in" className="p-3 hover:bg-slate-50 rounded-xl text-slate-600 transition-colors" title="Zoom In">
            <ZoomIn className="w-5 h-5" />
          </button>
          <button id="zoom-out" className="p-3 hover:bg-slate-50 rounded-xl text-slate-600 transition-colors" title="Zoom Out">
            <ZoomOut className="w-5 h-5" />
          </button>
          <div className="h-px bg-slate-100 mx-2" />
          <button id="zoom-reset" className="p-3 hover:bg-slate-50 rounded-xl text-slate-600 transition-colors" title="Reset View">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
        <div className="bg-white px-4 py-2 rounded-xl shadow-lg border border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
          Zoom: {(zoomLevel * 100).toFixed(0)}%
        </div>
      </div>

      {/* Context Menu */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-white rounded-3xl shadow-2xl border border-slate-200 p-2 flex items-center space-x-2"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedNode.type === 'item' ? (
              <div className="flex items-center p-1">
                <div className="flex flex-col items-center px-4 border-r border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest">Order</span>
                  <div className="flex space-x-1">
                    <button 
                      onClick={() => handleSwap('up')}
                      className="p-3 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl transition-all"
                      title="Move Up"
                    >
                      <ArrowUp className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleSwap('down')}
                      className="p-3 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl transition-all"
                      title="Move Down"
                    >
                      <ArrowDown className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                <button 
                  onClick={handleDeleteItem}
                  className="p-4 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-2xl transition-all flex flex-col items-center mx-2"
                >
                  <Trash2 className="w-5 h-5 mb-1" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Delete</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center p-1">
                <div className="px-5 py-2 border-r border-slate-100 flex flex-col justify-center">
                  <div className="flex items-center space-x-2 mb-1">
                    <div className="p-1 bg-purple-100 rounded-md">
                      <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
                    </div>
                    <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Image Settings</span>
                  </div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">Node ID: {selectedNode.id.split('-').pop()}</p>
                </div>

                <div className="flex flex-col px-4 border-r border-slate-100">
                  <div className="flex items-center space-x-1 mb-2">
                    <Maximize2 className="w-3 h-3 text-slate-400" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Scale</span>
                  </div>
                  <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                    {[25, 50, 100].map(size => (
                      <button 
                        key={size}
                        onClick={() => handleUpdatePhoto({ width: size })}
                        className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${
                          selectedNode.width === size 
                            ? 'bg-white text-purple-600 shadow-sm ring-1 ring-slate-200' 
                            : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                        }`}
                      >
                        {size}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col px-4 border-r border-slate-100">
                  <div className="flex items-center space-x-1 mb-2">
                    <Layers className="w-3 h-3 text-slate-400" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Align</span>
                  </div>
                  <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                    {[
                      { id: 'left', icon: AlignLeft },
                      { id: 'center', icon: AlignCenter },
                      { id: 'right', icon: AlignRight }
                    ].map(align => (
                      <button 
                        key={align.id}
                        onClick={() => handleUpdatePhoto({ alignment: align.id })}
                        className={`p-1.5 rounded-lg transition-all ${
                          selectedNode.alignment === align.id 
                            ? 'bg-white text-purple-600 shadow-sm ring-1 ring-slate-200' 
                            : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                        }`}
                      >
                        <align.icon className="w-4 h-4" />
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => setIsReattaching(true)}
                  className="p-4 hover:bg-purple-50 text-slate-400 hover:text-purple-600 rounded-2xl transition-all flex flex-col items-center mx-2"
                >
                  <LinkIcon className="w-5 h-5 mb-1" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Reattach</span>
                </button>
              </div>
            )}
            <div className="w-px h-10 bg-slate-100 mx-2" />
            <button 
              onClick={() => setSelectedNode(null)}
              className="p-4 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-2xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reattach Modal */}
      <AnimatePresence>
        {isReattaching && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReattaching(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-[120] flex flex-col max-h-[70vh]"
            >
              <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 flex items-center">
                  <LinkIcon className="w-5 h-5 mr-2 text-purple-500" />
                  Reattach to Type
                </h3>
                <button onClick={() => setIsReattaching(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 space-y-2 custom-scrollbar">
                {parsedData.flatMap(g => g.ITEMS).map((item: any) => (
                  <button
                    key={item.id}
                    onClick={() => handleReattachPhoto(item.id)}
                    className={`w-full p-4 rounded-2xl border-2 text-left transition-all flex flex-col ${
                      selectedNode?.parentItemId === item.id ? 'border-purple-500 bg-purple-50' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{item.TYPE}</span>
                    <span className="text-sm font-medium text-slate-700 truncate">{item.CONTENT}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-slate-900/80 backdrop-blur-md px-6 py-3 rounded-2xl shadow-2xl border border-white/10 text-white flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <Move className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-medium">Drag nodes to move</span>
          </div>
          <div className="w-px h-4 bg-white/20" />
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium">Click nodes for options</span>
          </div>
          <div className="w-px h-4 bg-white/20" />
          <div className="flex items-center space-x-2">
            <ImageIcon className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-medium">Photos attached via strings</span>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <svg 
        ref={svgRef} 
        className="w-full h-full cursor-move"
        style={{ touchAction: 'none' }}
      />
    </div>
  );
}
