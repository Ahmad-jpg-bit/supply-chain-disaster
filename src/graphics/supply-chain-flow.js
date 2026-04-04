// Animated SVG supply chain flow diagram
// Shows: Supplier -> Factory -> Warehouse -> Truck -> Customer
// Features: animated dots, active node glow, disruption indicators,
//           dynamic status colors per node (normal|ok|warning|critical|disrupted|inactive)

const NODES = [
    { id: 'supplier',  label: 'Supplier',  x: 60,  icon: 'supplier'  },
    { id: 'factory',   label: 'Factory',   x: 210, icon: 'factory'   },
    { id: 'warehouse', label: 'Warehouse', x: 360, icon: 'warehouse' },
    { id: 'truck',     label: 'Transport', x: 510, icon: 'truck'     },
    { id: 'store',     label: 'Customer',  x: 660, icon: 'store'     }
];

const NODE_ICONS = {
    supplier:  `<path d="M-8-4h6v12h-6z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M-2-4h6v12h-6z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="-5" cy="2" r="2" fill="none" stroke="currentColor" stroke-width="1.5"/>`,
    factory:   `<path d="M-10 8h20v-12l-6 4v-4l-6 4v-6h-8z" fill="none" stroke="currentColor" stroke-width="1.5"/>`,
    warehouse: `<path d="M-10 8V-2l10-6 10 6v10h-20z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M-3 8V2h6v6" fill="none" stroke="currentColor" stroke-width="1.5"/>`,
    truck:     `<path d="M-10 0h10v-8h-10z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M0-4h4l3 3v1h-7z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="-5" cy="2" r="2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="5" cy="2" r="2" fill="none" stroke="currentColor" stroke-width="1.5"/>`,
    store:     `<path d="M-10-2l1-4h18l1 4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M-10-2v10h20v-10" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M-3 8V3h6v5" fill="none" stroke="currentColor" stroke-width="1.5"/>`
};

/**
 * Visual config for each node status.
 *   badge: short ERP-style monospaced label rendered below the node name.
 *
 * Statuses:
 *   normal    – active node, default blue
 *   ok        – healthy / on-track → green
 *   warning   – degraded, attention needed → amber
 *   critical  – severe issue, action required → red
 *   disrupted – link broken / supplier down → red + dashed ring
 *   inactive  – node not involved in current chapter → dim gray
 */
const STATUS_CONFIG = {
    normal:    { stroke: '#3b82f6', fill: 'rgba(59,130,246,0.18)',  icon: '#3b82f6',  filter: 'glow-blue',   badge: null,        badgeColor: null      },
    ok:        { stroke: '#22c55e', fill: 'rgba(34,197,94,0.18)',   icon: '#22c55e',  filter: 'glow-green',  badge: 'NOMINAL',   badgeColor: '#22c55e' },
    warning:   { stroke: '#f59e0b', fill: 'rgba(245,158,11,0.18)',  icon: '#f59e0b',  filter: 'glow-orange', badge: 'WARNING',   badgeColor: '#f59e0b' },
    critical:  { stroke: '#ef4444', fill: 'rgba(239,68,68,0.18)',   icon: '#ef4444',  filter: 'glow-red',    badge: 'CRITICAL',  badgeColor: '#ef4444' },
    disrupted: { stroke: '#ef4444', fill: 'rgba(239,68,68,0.10)',   icon: '#ef4444',  filter: 'glow-red',    badge: 'DISRUPTED', badgeColor: '#ef4444' },
    inactive:  { stroke: 'rgba(148,163,184,0.3)', fill: 'rgba(30,41,59,0.8)', icon: '#94a3b8', filter: null, badge: null, badgeColor: null },
};

export class SupplyChainFlow {
    constructor(containerId) {
        this.container      = document.getElementById(containerId);
        this.activeNodes    = [];
        this.disruptedLinks = [];
        this.nodeStatuses   = {};   // { nodeId: statusKey }
        this.animationId    = null;

        if (this.container) {
            this.render();
            this.startAnimation();
        }
    }

    render() {
        const svgWidth   = 740;
        const svgHeight  = 105;   // extra room for status badges
        const nodeY      = 35;
        const nodeRadius = 22;

        let svg = `<svg class="supply-chain-flow-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">`;

        // ── Defs: generic + per-status colored glow filters ──────────────────
        svg += `
            <defs>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <filter id="glow-strong">
                    <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
                    <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <filter id="glow-blue" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="4" result="blur"/>
                    <feFlood flood-color="#3b82f6" flood-opacity="0.55" result="c"/>
                    <feComposite in="c" in2="blur" operator="in" result="cb"/>
                    <feMerge><feMergeNode in="cb"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <filter id="glow-green" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="4" result="blur"/>
                    <feFlood flood-color="#22c55e" flood-opacity="0.55" result="c"/>
                    <feComposite in="c" in2="blur" operator="in" result="cb"/>
                    <feMerge><feMergeNode in="cb"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <filter id="glow-orange" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="5" result="blur"/>
                    <feFlood flood-color="#f59e0b" flood-opacity="0.65" result="c"/>
                    <feComposite in="c" in2="blur" operator="in" result="cb"/>
                    <feMerge><feMergeNode in="cb"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <filter id="glow-red" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="5" result="blur"/>
                    <feFlood flood-color="#ef4444" flood-opacity="0.70" result="c"/>
                    <feComposite in="c" in2="blur" operator="in" result="cb"/>
                    <feMerge><feMergeNode in="cb"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
            </defs>`;

        // ── Links ──────────────────────────────────────────────────────────────
        for (let i = 0; i < NODES.length - 1; i++) {
            const from = NODES[i];
            const to   = NODES[i + 1];
            const x1   = from.x + nodeRadius + 5;
            const x2   = to.x   - nodeRadius - 5;
            const linkId      = `${from.id}-${to.id}`;
            const isDisrupted = this.disruptedLinks.includes(linkId);

            svg += `<line
                class="flow-link ${isDisrupted ? 'disrupted' : ''}"
                data-link="${linkId}"
                x1="${x1}" y1="${nodeY}" x2="${x2}" y2="${nodeY}"
                stroke="${isDisrupted ? '#ef4444' : 'rgba(148,163,184,0.4)'}"
                stroke-width="2"
                ${isDisrupted ? 'stroke-dasharray="6 4"' : ''}
            />`;

            const arrowX = x2 - 2;
            svg += `<polygon
                points="${arrowX},${nodeY - 4} ${arrowX + 8},${nodeY} ${arrowX},${nodeY + 4}"
                fill="${isDisrupted ? '#ef4444' : 'rgba(148,163,184,0.4)'}"
                class="flow-arrow ${isDisrupted ? 'disrupted' : ''}"
                data-link="${linkId}"
            />`;

            if (!isDisrupted) {
                for (let d = 0; d < 3; d++) {
                    svg += `<circle
                        class="flow-dot" data-link="${linkId}" data-dot-index="${d}"
                        cx="${x1}" cy="${nodeY}" r="3"
                        fill="var(--primary-color)" opacity="0.8">
                        <animate attributeName="cx" from="${x1}" to="${x2}"
                            dur="2.5s" begin="${d * 0.8}s" repeatCount="indefinite"/>
                        <animate attributeName="opacity" values="0;0.8;0.8;0"
                            dur="2.5s" begin="${d * 0.8}s" repeatCount="indefinite"/>
                    </circle>`;
                }
            } else {
                // Bunched pips: 4 stalled dots clustered just after the upstream node
                const bunchX = x1 + 8;
                const offsets = [0, 7, 14, 21];
                offsets.forEach((offset, d) => {
                    svg += `<circle
                        class="flow-dot flow-dot--bunched" data-link="${linkId}"
                        cx="${bunchX + offset}" cy="${nodeY}" r="2.5"
                        fill="#ef4444" opacity="0">
                        <animate attributeName="opacity"
                            values="0;0.7;0.7;0.2;0.7;0"
                            dur="2.8s" begin="${d * 0.35}s" repeatCount="indefinite"/>
                    </circle>`;
                });
            }
        }

        // ── Nodes ──────────────────────────────────────────────────────────────
        NODES.forEach(node => {
            const isActive  = this.activeNodes.includes(node.id);
            const rawStatus = this.nodeStatuses[node.id];

            // Resolve effective status
            let status;
            if (!isActive) {
                status = 'inactive';
            } else if (rawStatus && STATUS_CONFIG[rawStatus]) {
                status = rawStatus;
            } else {
                status = 'normal';
            }

            const cfg         = STATUS_CONFIG[status];
            const filterAttr  = cfg.filter ? `filter="url(#${cfg.filter})"` : '';
            const strokeWidth = status !== 'inactive' ? 2.5 : 1.5;

            svg += `<g class="flow-node ${isActive ? 'active' : ''}" data-node="${node.id}" data-status="${status}" transform="translate(${node.x}, ${nodeY})">`;

            // Main circle
            svg += `<circle r="${nodeRadius}"
                fill="${cfg.fill}"
                stroke="${cfg.stroke}"
                stroke-width="${strokeWidth}"
                ${filterAttr}
            />`;

            // Disrupted: outer dashed ring to reinforce the broken-link signal
            if (status === 'disrupted') {
                svg += `<circle r="${nodeRadius + 6}"
                    fill="none"
                    stroke="#ef4444"
                    stroke-width="1"
                    stroke-dasharray="4 3"
                    opacity="0.45"
                />`;
            }

            // Icon
            svg += `<g color="${cfg.icon}" transform="scale(0.85)">
                ${NODE_ICONS[node.id] || ''}
            </g>`;

            svg += `</g>`;

            // Node label
            const labelY = nodeY + nodeRadius + 14;
            svg += `<text
                x="${node.x}" y="${labelY}"
                text-anchor="middle"
                fill="${isActive ? 'var(--text-main)' : 'var(--text-muted)'}"
                font-size="11"
                font-family="var(--font-main)"
                font-weight="${isActive ? '600' : '400'}"
            >${node.label}</text>`;

            // Status badge — monospaced ERP-style label
            if (cfg.badge && cfg.badgeColor) {
                svg += `<text
                    x="${node.x}" y="${labelY + 13}"
                    text-anchor="middle"
                    fill="${cfg.badgeColor}"
                    font-size="7.5"
                    font-family="var(--font-mono, 'Roboto Mono', monospace)"
                    font-weight="600"
                    letter-spacing="0.09em"
                    opacity="0.9"
                >${cfg.badge}</text>`;
            }
        });

        svg += `</svg>`;
        this.container.innerHTML = svg;
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Set which nodes are active for the current chapter.
     * Optionally pass nodeStatuses to apply in the same render pass.
     */
    setActiveNodes(nodeIds = [], nodeStatuses = {}) {
        this.activeNodes = nodeIds;
        if (Object.keys(nodeStatuses).length) {
            this.nodeStatuses = nodeStatuses;
        }
        this.render();
    }

    setDisruptedLinks(linkIds = []) {
        this.disruptedLinks = linkIds;
        this.render();
    }

    /**
     * Update node statuses independently (does not change active nodes).
     * @param {Object} statusMap  e.g. { supplier: 'warning', warehouse: 'critical' }
     */
    setNodeStatuses(statusMap = {}) {
        this.nodeStatuses = statusMap;
        this.render();
    }

    highlightNode(nodeId) {
        if (nodeId && !this.activeNodes.includes(nodeId)) {
            this.activeNodes = [nodeId];
            this.render();
        }
    }

    /**
     * Scenario-level update: highlight one node, optionally mark its upstream
     * link as disrupted. Accepts optional nodeStatuses for a single render pass.
     */
    setScenarioState(highlightNode, isDisrupted = false, nodeStatuses = {}) {
        this.activeNodes = highlightNode ? [highlightNode] : [];

        if (isDisrupted && highlightNode) {
            const nodeIndex = NODES.findIndex(n => n.id === highlightNode);
            if (nodeIndex > 0) {
                const prevNode = NODES[nodeIndex - 1];
                this.disruptedLinks = [`${prevNode.id}-${highlightNode}`];
            }
        } else {
            this.disruptedLinks = [];
        }

        if (Object.keys(nodeStatuses).length) {
            this.nodeStatuses = nodeStatuses;
        }

        this.render();
    }

    startAnimation() {
        // Animation handled entirely via SVG <animate> elements — no JS loop needed.
    }

    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}
