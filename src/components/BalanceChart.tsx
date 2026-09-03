import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Card } from "@/components/ui/card";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface BalanceChartProps {
  labels: string[];
  data: number[];
}

export const BalanceChart = ({ labels, data }: BalanceChartProps) => {
  const chartData = {
    labels,
    datasets: [
      {
        label: 'Saldo Devedor',
        data,
        borderColor: 'hsl(112, 78%, 50%)', // Secondary color
        backgroundColor: 'hsl(112, 78%, 50%, 0.1)',
        tension: 0.3,
        fill: true,
        pointBackgroundColor: 'hsl(112, 78%, 50%)',
        pointBorderColor: 'hsl(112, 78%, 50%)',
        pointHoverBackgroundColor: 'hsl(280, 100%, 53%)', // Primary color
        pointHoverBorderColor: 'hsl(280, 100%, 53%)',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: 'hsl(222.2, 84%, 4.9%)',
          font: {
            size: 14,
            weight: 'bold' as const,
          }
        }
      },
      title: {
        display: true,
        text: 'Evolução do Saldo Devedor',
        color: 'hsl(280, 100%, 53%)',
        font: {
          size: 18,
          weight: 'bold' as const,
        }
      },
      tooltip: {
        backgroundColor: 'hsl(0, 0%, 100%)',
        titleColor: 'hsl(280, 100%, 53%)',
        bodyColor: 'hsl(222.2, 84%, 4.9%)',
        borderColor: 'hsl(280, 100%, 53%)',
        borderWidth: 1,
        callbacks: {
          label: function(context: any) {
            return `${context.dataset.label}: R$ ${context.parsed.y.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: 'hsl(222.2, 84%, 4.9%)',
          callback: function(value: any) {
            return 'R$ ' + value.toLocaleString('pt-BR');
          }
        },
        grid: {
          color: 'hsl(214.3, 31.8%, 91.4%)',
        }
      },
      x: {
        ticks: {
          color: 'hsl(222.2, 84%, 4.9%)',
        },
        grid: {
          color: 'hsl(214.3, 31.8%, 91.4%)',
        }
      }
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto p-6">
      <div className="h-96">
        <Line data={chartData} options={options} />
      </div>
    </Card>
  );
};