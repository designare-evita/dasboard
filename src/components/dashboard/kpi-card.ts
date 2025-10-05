'use client';

interface KpiCardProps {
  title: string;
  value: string | number;
  description: string;
}

export default function KpiCard({ title, value, description }: KpiCardProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </div>
  );
}
