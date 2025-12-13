'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, X } from 'react-bootstrap-icons';

interface Props {
  keywords: string[];
  onChange: (keywords: string[]) => void;
}

export function ManualKeywordInput({ keywords, onChange }: Props) {
  const [input, setInput] = useState('');

  const add = () => {
    if (input.trim() && !keywords.includes(input.trim())) {
      onChange([...keywords, input.trim()]);
      setInput('');
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Keywords (Manuell)</label>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Keyword eingeben..."
          className="flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <Button onClick={add} size="sm" type="button" variant="outline">
          <PlusCircle className="mr-2" /> Add
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {keywords.map((kw, i) => (
          <span key={i} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md text-xs font-medium border border-indigo-100">
            {kw}
            <button onClick={() => onChange(keywords.filter((_, idx) => idx !== i))} className="hover:text-red-500">
              <X />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
