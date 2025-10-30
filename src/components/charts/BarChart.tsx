'use client';

import { useEffect, useRef } from 'react';

interface BarChartProps {
  data: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor: string;
      borderColor: string;
    }[];
  };
  height?: number;
  showLabels?: boolean;
}

export default function BarChart({ data, height = 200, showLabels = true }: BarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.labels.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = height + 'px';

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, height);

    // Chart dimensions with extra space for rotated labels
    const padding = 40;
    const labelHeight = 60; // Extra space for rotated labels
    const chartWidth = rect.width - (padding * 2);
    const chartHeight = height - (padding * 2) - labelHeight;
    const maxValue = Math.max(...data.datasets.flatMap(dataset => dataset.data));

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + chartWidth, y);
      ctx.stroke();
    }

    // Calculate dynamic bar width and spacing based on data length
    const maxBars = Math.min(data.labels.length, 12); // Limit to 12 bars for readability
    const dynamicBarSpacing = data.labels.length > 6 ? 4 : 8;
    const barWidth = Math.max(20, (chartWidth - (dynamicBarSpacing * (maxBars - 1))) / maxBars);
    
    data.datasets.forEach((dataset) => {
      dataset.data.slice(0, maxBars).forEach((value, index) => {
        const barHeight = (value / maxValue) * chartHeight;
        const x = padding + index * (barWidth + dynamicBarSpacing);
        const y = padding + chartHeight - barHeight;

        // Draw bar
        ctx.fillStyle = dataset.backgroundColor;
        ctx.fillRect(x, y, barWidth, barHeight);

        // Draw border
        ctx.strokeStyle = dataset.borderColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, barWidth, barHeight);
      });
    });

    // Draw labels with rotation to prevent overlapping
    if (showLabels) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      
      data.labels.slice(0, maxBars).forEach((label, index) => {
        const x = padding + index * (barWidth + dynamicBarSpacing) + barWidth / 2;
        const y = height - 10; // Position labels at bottom
        
        // For many labels, use rotation; for few labels, use horizontal
        if (data.labels.length > 6) {
          // Save context state for rotation
          ctx.save();
          
          // Move to label position and rotate
          ctx.translate(x, y);
          ctx.rotate(-Math.PI / 6); // 30 degree rotation
          
          // Draw rotated text with shadow for better visibility
          ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
          ctx.shadowBlur = 3;
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 1;
          ctx.fillText(label, 0, 0);
          
          // Restore context state
          ctx.restore();
        } else {
          // Draw horizontal labels for fewer items
          ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
          ctx.shadowBlur = 3;
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 1;
          ctx.fillText(label, x, y);
        }
      });
    }

    // Draw value labels on bars
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    
    data.datasets.forEach((dataset) => {
      dataset.data.slice(0, maxBars).forEach((value, index) => {
        if (value > 0) {
          const barHeight = (value / maxValue) * chartHeight;
          const x = padding + index * (barWidth + dynamicBarSpacing) + barWidth / 2;
          const y = padding + chartHeight - barHeight - 5;
          
          // Format value
          const formattedValue = value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString();
          ctx.fillText(formattedValue, x, y);
        }
      });
    });

  }, [data, height, showLabels]);

  return (
    <div className="w-full">
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: `${height}px` }}
      />
      {/* Fallback labels below chart for better visibility */}
      {showLabels && data.labels.length > 0 && (
        <div className="flex justify-between mt-2 px-4">
          {data.labels.slice(0, Math.min(data.labels.length, 12)).map((label, index) => (
            <div key={index} className="text-xs text-slate-400 text-center flex-1">
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
