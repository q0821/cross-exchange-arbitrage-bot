'use client';

/**
 * TimeBasisSelector Component
 *
 * Allows users to select their preferred time basis for normalized funding rates.
 * Choices: 1 hour, 8 hours, or 24 hours
 *
 * Feature: 012-specify-scripts-bash (User Story 1)
 */

import { useState, useEffect } from 'react';

export type TimeBasis = 1 | 8 | 24;

interface TimeBasisSelectorProps {
  value?: TimeBasis;
  onChange: (timeBasis: TimeBasis) => void;
  className?: string;
}

const TIME_BASIS_OPTIONS: Array<{ value: TimeBasis; label: string }> = [
  { value: 1, label: '1 小時' },
  { value: 8, label: '8 小時' },
  { value: 24, label: '24 小時' },
];

// LocalStorage key
const STORAGE_KEY = 'market-monitor-time-basis';

export function TimeBasisSelector({
  value,
  onChange,
  className = '',
}: TimeBasisSelectorProps) {
  const [selectedBasis, setSelectedBasis] = useState<TimeBasis>(value ?? 8);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if ([1, 8, 24].includes(parsed)) {
          setSelectedBasis(parsed as TimeBasis);
          onChange(parsed as TimeBasis);
        }
      }
    }
  }, []);

  const handleChange = (timeBasis: TimeBasis) => {
    setSelectedBasis(timeBasis);
    onChange(timeBasis);

    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, timeBasis.toString());
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        時間基準:
      </label>
      <div className="flex gap-1 rounded-md border border-gray-300 dark:border-gray-600 p-1">
        {TIME_BASIS_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => handleChange(option.value)}
            className={`
              px-3 py-1 text-sm font-medium rounded transition-colors
              ${
                selectedBasis === option.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }
            `}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Hook to get/set time basis with localStorage persistence
 */
export function useTimeBasis(): [TimeBasis, (basis: TimeBasis) => void] {
  const [timeBasis, setTimeBasis] = useState<TimeBasis>(8);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if ([1, 8, 24].includes(parsed)) {
          setTimeBasis(parsed as TimeBasis);
        }
      }
    }
  }, []);

  const updateTimeBasis = (basis: TimeBasis) => {
    setTimeBasis(basis);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, basis.toString());
    }
  };

  return [timeBasis, updateTimeBasis];
}
