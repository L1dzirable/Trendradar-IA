import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  degree?: number;
}

interface GraphEdge {
  source: string | GraphNode;
  target: string | GraphNode;
  weight: number;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export default function ConceptGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<GraphData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/graph/edges");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: GraphData = await res.json();

      const degreeMap = new Map<string, number>();
      json.edges.forEach(edge => {
        const sourceId = typeof edge.source === "string" ? edge.source : edge.source.id;
        const targetId = typeof edge.target === "string" ? edge.target : edge.target.id;
        degreeMap.set(sourceId, (degreeMap.get(sourceId) || 0) + 1);
        degreeMap.set(targetId, (degreeMap.get(targetId) || 0) + 1);
      });

      json.nodes.forEach(node => {
        node.degree = degreeMap.get(node.id) || 0;
      });

      setData(json);
      setStatus("ready");
    } catch (e: any) {
      setError(e.message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!data || !svgRef.current || status !== "ready") return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    const g = svg.append("g");

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setZoom(event.transform.k);
      });

    svg.call(zoomBehavior);

    const simulation = d3.forceSimulation<GraphNode>(data.nodes)
      .force("link", d3.forceLink<GraphNode, GraphEdge>(data.edges)
        .id(d => d.id)
        .distance(d => 80 + (1 / Math.max(d.weight, 1)) * 50)
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(d => Math.sqrt((d.degree || 1) * 10) + 5));

    const maxWeight = Math.max(...data.edges.map(e => e.weight), 1);
    const minOpacity = 0.15;
    const maxOpacity = 0.8;

    const link = g.append("g")
      .selectAll("line")
      .data(data.edges)
      .join("line")
      .attr("stroke", "#64748b")
      .attr("stroke-width", 1)
      .attr("stroke-opacity", d => minOpacity + (d.weight / maxWeight) * (maxOpacity - minOpacity));

    const node = g.append("g")
      .selectAll("circle")
      .data(data.nodes)
      .join("circle")
      .attr("r", d => Math.sqrt((d.degree || 1) * 10) + 3)
      .attr("fill", "#4ade80")
      .attr("stroke", "#0a0f1a")
      .attr("stroke-width", 2)
      .attr("opacity", 0.85)
      .style("cursor", "pointer")
      .call(d3.drag<SVGCircleElement, GraphNode>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      )
      .on("click", (event, d) => {
        event.stopPropagation();
        setSelectedNode(prev => prev === d.id ? null : d.id);
      })
      .on("mouseenter", function(event, d) {
        d3.select(this)
          .attr("opacity", 1)
          .attr("r", Math.sqrt((d.degree || 1) * 10) + 5);
      })
      .on("mouseleave", function(event, d) {
        d3.select(this)
          .attr("opacity", 0.85)
          .attr("r", Math.sqrt((d.degree || 1) * 10) + 3);
      });

    const topNodes = [...data.nodes]
      .sort((a, b) => (b.degree || 0) - (a.degree || 0))
      .slice(0, 10)
      .map(n => n.id);

    const labelGroup = g.append("g");

    const permanentLabels = labelGroup
      .selectAll(".permanent-label")
      .data(data.nodes.filter(n => topNodes.includes(n.id)))
      .join("text")
      .attr("class", "permanent-label")
      .attr("text-anchor", "middle")
      .attr("dy", d => Math.sqrt((d.degree || 1) * 10) + 18)
      .attr("fill", "#e2e8f0")
      .attr("font-size", 11)
      .attr("font-weight", 600)
      .attr("font-family", "'DM Mono', monospace")
      .attr("pointer-events", "none")
      .text(d => d.label);

    const hoverLabel = labelGroup.append("text")
      .attr("class", "hover-label")
      .attr("text-anchor", "middle")
      .attr("fill", "#f1f5f9")
      .attr("font-size", 12)
      .attr("font-weight", 600)
      .attr("font-family", "'Cabinet Grotesk', sans-serif")
      .attr("pointer-events", "none")
      .style("opacity", 0);

    node.on("mouseenter.label", function(event, d) {
      if (!topNodes.includes(d.id)) {
        hoverLabel
          .text(d.label)
          .attr("x", d.x!)
          .attr("y", d.y! + Math.sqrt((d.degree || 1) * 10) + 18)
          .style("opacity", 1);
      }
    }).on("mouseleave.label", function() {
      hoverLabel.style("opacity", 0);
    });

    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as GraphNode).x!)
        .attr("y1", d => (d.source as GraphNode).y!)
        .attr("x2", d => (d.target as GraphNode).x!)
        .attr("y2", d => (d.target as GraphNode).y!);

      node
        .attr("cx", d => d.x!)
        .attr("cy", d => d.y!);

      permanentLabels
        .attr("x", d => d.x!)
        .attr("y", d => d.y! + Math.sqrt((d.degree || 1) * 10) + 18);
    });

    return () => {
      simulation.stop();
    };
  }, [data, status]);

  useEffect(() => {
    if (!data || !svgRef.current || status !== "ready") return;

    const svg = d3.select(svgRef.current);
    const g = svg.select("g");

    if (selectedNode) {
      const connectedNodes = new Set<string>();
      connectedNodes.add(selectedNode);

      data.edges.forEach(edge => {
        const sourceId = typeof edge.source === "string" ? edge.source : edge.source.id;
        const targetId = typeof edge.target === "string" ? edge.target : edge.target.id;
        if (sourceId === selectedNode) connectedNodes.add(targetId);
        if (targetId === selectedNode) connectedNodes.add(sourceId);
      });

      g.selectAll("circle")
        .attr("opacity", (d: any) => connectedNodes.has(d.id) ? 1 : 0.15)
        .attr("fill", (d: any) => d.id === selectedNode ? "#fb923c" : "#4ade80");

      g.selectAll("line")
        .attr("stroke-opacity", (d: any) => {
          const sourceId = typeof d.source === "string" ? d.source : d.source.id;
          const targetId = typeof d.target === "string" ? d.target : d.target.id;
          if ((sourceId === selectedNode || targetId === selectedNode)) {
            return 0.6;
          }
          return 0.05;
        });
    } else {
      const maxWeight = Math.max(...data.edges.map(e => e.weight), 1);
      const minOpacity = 0.15;
      const maxOpacity = 0.8;

      g.selectAll("circle")
        .attr("opacity", 0.85)
        .attr("fill", "#4ade80");

      g.selectAll("line")
        .attr("stroke-opacity", (d: any) => minOpacity + (d.weight / maxWeight) * (maxOpacity - minOpacity));
    }
  }, [selectedNode, data, status]);

  const handleZoomIn = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().call(
      d3.zoom<SVGSVGElement, unknown>().scaleBy as any,
      1.3
    );
  };

  const handleZoomOut = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().call(
      d3.zoom<SVGSVGElement, unknown>().scaleBy as any,
      0.7
    );
  };

  const handleResetView = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().call(
      d3.zoom<SVGSVGElement, unknown>().transform as any,
      d3.zoomIdentity
    );
    setSelectedNode(null);
  };

  if (status === "loading") {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100%", animation: "fadeIn 0.3s ease",
      }}>
        <div style={{
          width: 40, height: 40, border: "3px solid rgba(74,222,128,0.2)",
          borderTopColor: "#4ade80", borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", height: "100%", gap: 12,
      }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 650, color: "#ef4444" }}>
          Error loading graph
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>{error}</p>
        <button
          onClick={load}
          style={{
            marginTop: 8, padding: "8px 16px", borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.04)", color: "#e2e8f0",
            fontSize: 13, fontWeight: 500, cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <h1 style={{
            margin: 0, fontSize: 22, fontWeight: 750,
            color: "#f1f5f9", fontFamily: "'Cabinet Grotesk', sans-serif",
            letterSpacing: "-0.03em",
          }}>
            Concept Graph
          </h1>
          <p style={{
            margin: "3px 0 0", fontSize: 13, color: "#475569",
            fontFamily: "'DM Mono', monospace",
          }}>
            {data?.nodes.length || 0} concepts, {data?.edges.length || 0} connections
          </p>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={handleZoomIn}
            style={{
              padding: "8px 12px", borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)", color: "#e2e8f0",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
            }}
          >
            Zoom In
          </button>
          <button
            onClick={handleZoomOut}
            style={{
              padding: "8px 12px", borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)", color: "#e2e8f0",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
            }}
          >
            Zoom Out
          </button>
          <button
            onClick={handleResetView}
            style={{
              padding: "8px 12px", borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)", color: "#e2e8f0",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
            }}
          >
            Reset
          </button>
        </div>
      </div>

      <div style={{
        flex: 1, position: "relative",
        background: "rgba(255,255,255,0.015)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12, overflow: "hidden",
      }}>
        <svg
          ref={svgRef}
          style={{ width: "100%", height: "100%", display: "block" }}
          onClick={() => setSelectedNode(null)}
        />
        {selectedNode && (
          <div style={{
            position: "absolute", top: 16, left: 16,
            padding: "8px 12px", borderRadius: 8,
            background: "rgba(10,15,26,0.95)", border: "1px solid rgba(255,255,255,0.1)",
            fontSize: 12, color: "#e2e8f0",
            fontFamily: "'DM Mono', monospace",
          }}>
            Selected: <strong>{data?.nodes.find(n => n.id === selectedNode)?.label}</strong>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
