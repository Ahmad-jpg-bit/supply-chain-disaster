export class Analytics {
    constructor(engine) {
        this.engine = engine;
    }

    getBullwhipData() {
        const history = this.engine.state.history;

        return {
            labels: history.map(h => `Q${h.turn}`),
            datasets: [
                {
                    label: 'Customer Demand',
                    data: history.map(h => h.demand),
                    borderColor: '#f59e0b', // Accent (Yellow/Orange)
                    tension: 0.4
                },
                {
                    label: 'Your Orders',
                    data: history.map(h => h.orderQuantity),
                    borderColor: '#3b82f6', // Primary (Blue)
                    tension: 0.4
                }
            ]
        };
    }

    getCashFlowData() {
        const history = this.engine.state.history;

        return {
            labels: history.map(h => `Q${h.turn}`),
            datasets: [
                {
                    label: 'Cash Balance',
                    data: history.map(h => h.cash),
                    borderColor: '#22c55e', // Success (Green)
                    fill: true,
                    backgroundColor: 'rgba(34, 197, 94, 0.1)'
                }
            ]
        };
    }

    /**
     * Bullwhip ratio = Var(orders) / Var(demand)
     * > 1.0 means orders amplify demand swings (bullwhip effect in action)
     * Returns null if fewer than 3 turns of history.
     */
    getBullwhipRatio() {
        const history = this.engine.state.history;
        if (history.length < 3) return null;

        const demands = history.map(h => h.demand);
        const orders  = history.map(h => h.orderQuantity);

        const variance = (arr) => {
            const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
            return arr.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / arr.length;
        };

        const varDemand = variance(demands);
        const varOrders = variance(orders);

        if (varDemand === 0) return varOrders === 0 ? 1.0 : null;
        return varOrders / varDemand;
    }

    getCostBreakdownData() {
        const history = this.engine.state.history;

        return {
            labels: history.map(h => `Q${h.turn}`),
            datasets: [
                {
                    label: 'Order Cost',
                    data: history.map(h => h.orderCost || 0),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Shipping Cost',
                    data: history.map(h => h.shippingCost || 0),
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Inspection Cost',
                    data: history.map(h => h.inspectionCost || 0),
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Holding Cost',
                    data: history.map(h => h.holdingCost || 0),
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
        };
    }
}
