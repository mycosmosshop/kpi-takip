
import React from 'react';

interface TrendlineProps {
    data: (number | null)[];
}

const Trendline: React.FC<TrendlineProps> = ({ data }) => {
    const width = 100;
    const height = 25;
    const strokeWidth = 1.5;

    const numbers = data.filter(d => typeof d === 'number') as number[];

    if (numbers.length < 2) {
        return <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs italic">N/A</div>;
    }

    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    const range = max - min;

    // Add some padding to the top and bottom to prevent clipping
    const yPadding = strokeWidth;
    const effectiveHeight = height - (2 * yPadding);

    const points = numbers.map((d, i) => {
        const x = (i / (numbers.length - 1)) * width;
        // Invert Y axis for SVG coordinates, apply padding and scale to effective height
        const y = yPadding + effectiveHeight - ((d - min) / (range || 1)) * effectiveHeight;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
    });

    const pathData = `M ${points.join(' L ')}`;

    return (
        <div className="px-2 py-1 h-full flex items-center">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="none">
                <path 
                    d={pathData} 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth={strokeWidth} 
                    strokeLinejoin="round" 
                    strokeLinecap="round" 
                />
            </svg>
        </div>
    );
};

export default Trendline;
