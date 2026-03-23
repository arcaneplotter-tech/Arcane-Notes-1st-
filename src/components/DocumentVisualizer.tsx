import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';
import { MapTheme, MapLayout } from './VisualizerConstants';
import DocumentRenderer, { DocumentContext } from './DocumentRenderer';

interface Props {
  data: any[];
  theme?: string;
  layout?: string;
  onReorder?: (sourceId: string, targetId: string) => void;
}

export default function DocumentVisualizer({ data, theme = MapTheme.DEFAULT, layout = MapLayout.TREE_HORIZONTAL, onReorder }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const handleResize = () => {
      if (wrapperRef.current) {
        setDimensions({
          width: wrapperRef.current.offsetWidth,
          height: wrapperRef.current.offsetHeight
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getThemeStyles = (t: string) => {
    const depthColor = (d: number, colors: string[]) => {
      if (d === 0) return colors[0];
      if (d === 1) return colors[1];
      if (d === 2) return colors[2];
      return colors[3] || colors[2]; 
    };

    switch (t) {
      case MapTheme.HAND_DRAWN:
        return {
          bg: '#fffbeb', line: '#44403c', text: '#1c1917', font: '"Kalam", cursive', shape: 'rough-rect',
          getFill: (d: number) => depthColor(d, ['#fef08a', '#fda4af', '#93c5fd', '#ffffff']),
          getStroke: () => '#44403c', strokeWidth: 2, shadow: 'drop-shadow(3px 3px 0px rgba(0,0,0,0.15))', connectionType: 'curve'
        };
      case MapTheme.PROFESSIONAL:
        return {
          bg: '#ffffff', line: '#94a3b8', text: '#334155', font: 'Inter, sans-serif', shape: 'rect',
          getFill: () => '#ffffff',
          getStroke: (d: number) => depthColor(d, ['#1e3a8a', '#2563eb', '#0d9488', '#94a3b8']),
          strokeWidth: 2, shadow: 'drop-shadow(0 4px 6px -1px rgba(0, 0, 0, 0.1))', connectionType: 'straight'
        };
      case MapTheme.DARK_NEON:
        return {
          bg: '#0f172a', line: '#334155', text: '#e2e8f0', font: 'Inter, sans-serif', shape: 'rect',
          getFill: () => '#1e293b',
          getStroke: (d: number) => depthColor(d, ['#f72585', '#7209b7', '#4361ee', '#4cc9f0']),
          strokeWidth: 2, shadow: 'drop-shadow(0 0 10px rgba(76, 201, 240, 0.3))', connectionType: 'curve'
        };
      default: 
        return {
          bg: '#f8fafc', line: '#cbd5e1', text: '#334155', font: 'Inter, sans-serif', shape: 'rect',
          getFill: (d: number) => depthColor(d, ['#2563eb', '#60a5fa', '#93c5fd', '#f1f5f9']),
          getStroke: (d: number) => depthColor(d, ['#1e40af', '#2563eb', '#60a5fa', '#94a3b8']),
          strokeWidth: 1, shadow: 'none', connectionType: 'curve'
        };
    }
  };

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const styles = getThemeStyles(theme);
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); 

    const { width, height } = dimensions;
    const g = svg.append("g");

    if (wrapperRef.current) {
      wrapperRef.current.style.backgroundColor = styles.bg;
    }

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on("zoom", (event) => g.attr("transform", event.transform));

    svg.call(zoom);

    const initialTransform = d3.zoomIdentity.translate(width / 2, height / 2).scale(0.85);
    const treeStartTransform = d3.zoomIdentity.translate(150, height/2).scale(0.85);
    const treeVertTransform = d3.zoomIdentity.translate(width/2, 100).scale(0.85);

    // Convert ParsedData to D3 Hierarchy
    const isGrouped = data.length > 0 && data[0].GROUP !== undefined;
    
    const rootData = {
      id: 'root',
      name: 'Document',
      type: 'root',
      children: isGrouped 
        ? data.map((group, gIndex) => ({
            id: `group-${gIndex}`,
            name: group.GROUP,
            type: 'group',
            children: (group.ITEMS || []).map((item: any, iIndex: number) => ({
              id: `item-${gIndex}-${iIndex}`,
              name: item.TYPE,
              content: item.CONTENT,
              type: 'item',
              item: item,
              originalGroupIndex: gIndex,
              originalItemIndex: iIndex
            }))
          }))
        : data.map((item, iIndex) => ({
            id: `item-0-${iIndex}`,
            name: item.TYPE,
            content: item.CONTENT,
            type: 'item',
            item: item,
            originalGroupIndex: 0,
            originalItemIndex: iIndex
          }))
    };

    const root = d3.hierarchy<any>(rootData);
    let nodes: d3.HierarchyPointNode<any>[] = [];
    let links: d3.HierarchyPointLink<any>[] = [];
    let simulation: any = null;

    const nodeWidth = 320;
    const nodeHeight = 150;

    if (layout === MapLayout.ORGANIC) {
      nodes = root.descendants() as any;
      links = root.links() as any;
      simulation = d3.forceSimulation(nodes as any)
        .force("link", d3.forceLink(links).id((d: any) => d.data.id).distance(250))
        .force("charge", d3.forceManyBody().strength(-2000)) 
        .force("center", d3.forceCenter(0, 0))
        .force("collide", d3.forceCollide().radius(160).strength(0.9));
      svg.call(zoom.transform, initialTransform);
    } else if (layout === MapLayout.TREE_VERTICAL) {
      const tree = d3.tree<any>().nodeSize([nodeWidth, nodeHeight * 1.5]);
      tree(root);
      svg.call(zoom.transform, treeVertTransform);
      nodes = root.descendants() as any;
      links = root.links() as any;
    } else { // Horizontal
      const tree = d3.tree<any>().nodeSize([nodeHeight, nodeWidth * 1.3]);
      tree(root);
      root.descendants().forEach((d: any) => {
        const temp = d.x; d.x = d.y; d.y = temp;
      });
      svg.call(zoom.transform, treeStartTransform);
      nodes = root.descendants() as any;
      links = root.links() as any;
    }

    const linkSelection = g.append("g").selectAll(".link")
      .data(links).enter().append("path").attr("class", "link"); 

    const nodeSelection = g.append("g").selectAll(".node")
      .data(nodes).enter().append("g")
      .attr("class", "node")
      .attr("transform", d => `translate(${d.x},${d.y})`);

    // Drag Behavior for reordering visually
    const dragBehavior = d3.drag<SVGGElement, d3.HierarchyPointNode<any>>()
      .on("start", (event, d: any) => {
        if (simulation) { if (!event.active) simulation.alphaTarget(0.3).restart(); }
        d.fx = d.x; d.fy = d.y;
        d3.select(event.sourceEvent.target.closest("g")).raise();
      })
      .on("drag", (event, d: any) => {
        d.fx = event.x; d.fy = event.y;
        d.x = event.x; d.y = event.y;
        d3.select(event.sourceEvent.target.closest("g")).attr("transform", `translate(${event.x},${event.y})`);
        linkSelection.attr("d", l => getLinkPath(l, layout, styles.connectionType));
      })
      .on("end", (event, d: any) => {
        if (simulation) { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }
        
        // Find closest node to drop on for reordering (simple visual swap logic)
        let closestNode: any = null;
        let minDistance = 100; // Drop radius
        
        nodes.forEach((n: any) => {
          if (n.data.id !== d.data.id && n.data.type === d.data.type) {
            const dx = n.x - d.x;
            const dy = n.y - d.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            if (distance < minDistance) {
              minDistance = distance;
              closestNode = n;
            }
          }
        });

        if (closestNode && onReorder && d.data.type === 'item') {
          onReorder(d.data.id, closestNode.data.id);
        } else {
          // Snap back if not dropped on a valid target and not organic
          if (!simulation) {
            d3.select(event.sourceEvent.target.closest("g"))
              .transition().duration(300)
              .attr("transform", `translate(${d.x},${d.y})`); // Need original x,y here, but we mutated it. 
              // For a robust implementation, we'd re-run the layout.
          }
        }
      });

    nodeSelection.call(dragBehavior);
    
    const getLinkPath = (d: any, layout: string, connectionType: string) => {
      if (connectionType === 'step') return `M${d.source.x},${d.source.y} V${d.target.y} H${d.target.x}`;
      if (connectionType === 'straight') return `M${d.source.x},${d.source.y} L${d.target.x},${d.target.y}`;
      if (layout === MapLayout.TREE_HORIZONTAL) return d3.linkHorizontal<any, any>().x(d=>d.x).y(d=>d.y)(d);
      if (layout === MapLayout.TREE_VERTICAL) return d3.linkVertical<any, any>().x(d=>d.x).y(d=>d.y)(d);
      const dx = d.target.x - d.source.x, dy = d.target.y - d.source.y;
      const dr = Math.sqrt(dx * dx + dy * dy);
      return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
    };

    linkSelection.attr("d", d => getLinkPath(d, layout, styles.connectionType));

    linkSelection.attr("fill", "none")
      .attr("stroke", styles.line)
      .attr("stroke-width", styles.strokeWidth)
      .attr("stroke-dasharray", theme === MapTheme.HAND_DRAWN ? "4,2" : "0");

    nodeSelection.style("cursor", "grab")
      .on("mousedown", function() { d3.select(this).style("cursor", "grabbing"); })
      .on("mouseup", function() { d3.select(this).style("cursor", "grab"); });

    const getTextWidth = (text: string) => Math.max(120, text.length * 9 + 40);
    
    nodeSelection.append("rect")
      .attr("x", d => d.data.type === 'item' ? -160 : -getTextWidth(d.data.name) / 2)
      .attr("y", d => d.data.type === 'item' ? -75 : -25)
      .attr("width", d => d.data.type === 'item' ? 320 : getTextWidth(d.data.name))
      .attr("height", d => d.data.type === 'item' ? 150 : 50)
      .attr("rx", 8)
      .attr("fill", d => styles.getFill(d.depth))
      .attr("stroke", d => styles.getStroke(d.depth))
      .attr("stroke-width", styles.strokeWidth)
      .style("filter", styles.shadow);

    // Render Preview Elements inside ForeignObject for items
    const roots: any[] = [];
    nodeSelection.each(function(d: any) {
      const node = d3.select(this);
      if (d.data.type === 'item') {
        const w = 320;
        const h = 150;
        const fo = node.append("foreignObject")
          .attr("x", -w/2)
          .attr("y", -h/2)
          .attr("width", w)
          .attr("height", h)
          .append("xhtml:div")
          .style("width", "100%")
          .style("height", "100%")
          .style("overflow-y", "auto")
          .style("overflow-x", "hidden")
          .style("padding", "8px")
          .style("background", "white")
          .style("border-radius", "8px");
          
        const root = createRoot(fo.node() as HTMLElement);
        roots.push(root);
        root.render(
          <div className="w-full h-full pointer-events-none scale-75 origin-top-left" style={{ width: '133%', height: '133%' }}>
            <DocumentContext.Provider value={{ fullData: data }}>
              <DocumentRenderer 
                data={[d.data.item]} 
                isDragModeActive={false} 
                isOrderingMode={false} 
                imagePlacements={{}} 
              />
            </DocumentContext.Provider>
          </div>
        );
      } else {
        node.append("text")
          .text(d.data.name)
          .attr("text-anchor", "middle")
          .attr("dy", "0.3em")
          .style("font-family", styles.font)
          .style("font-size", "14px")
          .style("font-weight", "600")
          .style("fill", d.depth === 0 ? "white" : styles.text)
          .style("pointer-events", "none");
      }
    });

    if (simulation) {
      simulation.on("tick", () => {
        linkSelection.attr("d", d => getLinkPath(d, layout, styles.connectionType));
        nodeSelection.attr("transform", d => `translate(${d.x},${d.y})`);
      });
    }

    return () => { 
      if (simulation) simulation.stop(); 
      roots.forEach(r => r.unmount());
    };
  }, [data, layout, theme, dimensions]);

  return (
    <div ref={wrapperRef} className="w-full h-full relative overflow-hidden transition-colors duration-500 rounded-2xl border border-slate-200 shadow-inner">
      <svg ref={svgRef} className="w-full h-full block select-none" />
      <div className="absolute top-4 left-4 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 shadow-sm border border-slate-200 pointer-events-none">
        Drag nodes to reorder items
      </div>
    </div>
  );
}
