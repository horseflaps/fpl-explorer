import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import type { History } from '../types/fpl';

interface PriceHistoryChartProps {
    history: History[];
}

const PriceHistoryChart: React.FC<PriceHistoryChartProps> = ({ history }) => {
    const data = history.map(item => ({
        gameweek: `GW${item.round}`,
        price: item.value / 10,
    }));

    return (
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={data}
                    margin={{
                        top: 5,
                        right: 10,
                        left: -20,
                        bottom: 5,
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                        dataKey="gameweek"
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        tickLine={{ stroke: '#334155' }}
                        interval="preserveStartEnd"
                    />
                    <YAxis
                        domain={['auto', 'auto']}
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        tickLine={{ stroke: '#334155' }}
                        tickFormatter={(value) => `£${value}m`}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff' }}
                        formatter={(value: any) => [`£${value}m`, 'Price']}
                        labelStyle={{ color: '#94a3b8' }}
                    />
                    <Line
                        type="monotone"
                        dataKey="price"
                        stroke="#00ff85"
                        strokeWidth={2}
                        dot={{ fill: '#00ff85', r: 3 }}
                        activeDot={{ r: 5, fill: '#fff' }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default PriceHistoryChart;
