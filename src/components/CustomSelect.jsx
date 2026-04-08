import { useState, useEffect, useRef } from 'react';

export default function CustomSelect({ options, value, onChange, placeholder = 'Select...' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={`w-4 h-4 ml-2 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <ul
          className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto"
          role="listbox"
        >
          {options.map(opt => (
            <li
              key={opt.value}
              onClick={() => {
                if (!opt.disabled) {
                  onChange(opt.value);
                  setIsOpen(false);
                }
              }}
              className={`px-4 py-2 cursor-pointer flex items-center justify-between ${
                value === opt.value
                  ? 'bg-emerald-100 text-emerald-700 font-medium'
                  : opt.disabled
                  ? 'opacity-50 cursor-not-allowed bg-gray-100'
                  : 'hover:bg-emerald-50 text-gray-900'
              }`}
              role="option"
              aria-selected={value === opt.value}
              aria-disabled={opt.disabled}
            >
              <span>{opt.label}</span>
              {opt.disabled && (
                <span className="text-xs text-gray-500 border border-gray-300 rounded px-1">Soon</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
