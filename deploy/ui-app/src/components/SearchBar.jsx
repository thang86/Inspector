// SearchBar Component with debouncing
import React, { useState, useEffect } from 'react';
import { useDebounce } from '../hooks';
import './SearchBar.css';

const SearchBar = ({
  value = '',
  onChange,
  onSearch,
  placeholder = 'Search...',
  debounceDelay = 300,
  showClearButton = true,
  autoFocus = false,
  className = ''
}) => {
  const [localValue, setLocalValue] = useState(value);
  const debouncedValue = useDebounce(localValue, debounceDelay);

  // Update parent when debounced value changes
  useEffect(() => {
    if (onChange) {
      onChange(debouncedValue);
    }
    if (onSearch) {
      onSearch(debouncedValue);
    }
  }, [debouncedValue, onChange, onSearch]);

  // Sync with external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleClear = () => {
    setLocalValue('');
    if (onChange) {
      onChange('');
    }
    if (onSearch) {
      onSearch('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleClear();
    }
    if (e.key === 'Enter' && onSearch) {
      onSearch(localValue);
    }
  };

  return (
    <div className={`search-bar ${className}`}>
      <div className="search-icon">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M7 12C9.76142 12 12 9.76142 12 7C12 4.23858 9.76142 2 7 2C4.23858 2 2 4.23858 2 7C2 9.76142 4.23858 12 7 12Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M10.5 10.5L14 14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <input
        type="text"
        className="search-input"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label="Search"
      />

      {showClearButton && localValue && (
        <button
          className="search-clear"
          onClick={handleClear}
          aria-label="Clear search"
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path
              d="M1 1L13 13M13 1L1 13"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}

      {localValue && localValue !== debouncedValue && (
        <div className="search-loading">
          <div className="search-spinner"></div>
        </div>
      )}
    </div>
  );
};

// Advanced search with filters
export const AdvancedSearchBar = ({
  value,
  onChange,
  filters,
  onFilterChange,
  placeholder = 'Search...'
}) => {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="advanced-search">
      <SearchBar
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />

      <button
        className="filter-toggle-btn"
        onClick={() => setShowFilters(!showFilters)}
        aria-label="Toggle filters"
        aria-expanded={showFilters}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M2 4H14M4 8H12M6 12H10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        Filters {filters && Object.keys(filters).length > 0 && (
          <span className="filter-count">{Object.keys(filters).length}</span>
        )}
      </button>

      {showFilters && (
        <div className="filter-panel">
          {/* Render custom filter controls */}
          {onFilterChange && (
            <div className="filter-controls">
              {/* This can be customized based on your filter needs */}
              <button
                className="btn btn-small"
                onClick={() => onFilterChange({})}
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
