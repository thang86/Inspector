// Custom React Hooks for Inspector Dashboard
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useDebounce - Debounce a value to reduce API calls
 */
export const useDebounce = (value, delay = 500) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * usePagination - Handle pagination logic
 */
export const usePagination = (items, itemsPerPage = 10) => {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = items.slice(startIndex, endIndex);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const nextPage = () => goToPage(currentPage + 1);
  const prevPage = () => goToPage(currentPage - 1);

  // Reset to page 1 when items change
  useEffect(() => {
    setCurrentPage(1);
  }, [items.length]);

  return {
    currentItems,
    currentPage,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1,
  };
};

/**
 * useSort - Handle table sorting logic
 */
export const useSort = (items, initialField = null) => {
  const [sortField, setSortField] = useState(initialField);
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'

  const sortedItems = [...items].sort((a, b) => {
    if (!sortField) return 0;

    const aValue = a[sortField];
    const bValue = b[sortField];

    // Handle null/undefined
    if (aValue == null) return 1;
    if (bValue == null) return -1;

    // Handle different types
    if (typeof aValue === 'string') {
      const comparison = aValue.localeCompare(bValue);
      return sortDirection === 'asc' ? comparison : -comparison;
    }

    if (typeof aValue === 'number') {
      const comparison = aValue - bValue;
      return sortDirection === 'asc' ? comparison : -comparison;
    }

    // Handle dates
    if (aValue instanceof Date || bValue instanceof Date) {
      const comparison = new Date(aValue) - new Date(bValue);
      return sortDirection === 'asc' ? comparison : -comparison;
    }

    return 0;
  });

  const handleSort = (field) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return {
    sortedItems,
    sortField,
    sortDirection,
    handleSort,
  };
};

/**
 * useLocalStorage - Persist state in localStorage
 */
export const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  };

  return [storedValue, setValue];
};

/**
 * useInterval - Declarative interval hook
 */
export const useInterval = (callback, delay) => {
  const savedCallback = useRef();

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay !== null) {
      const tick = () => savedCallback.current();
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
};

/**
 * useKeyboardShortcut - Handle keyboard shortcuts
 */
export const useKeyboardShortcut = (keys, callback) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      const { key, ctrlKey, shiftKey, altKey } = event;

      const match = keys.every(k => {
        if (k === 'ctrl') return ctrlKey;
        if (k === 'shift') return shiftKey;
        if (k === 'alt') return altKey;
        return key.toLowerCase() === k.toLowerCase();
      });

      if (match) {
        event.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keys, callback]);
};

/**
 * useOnClickOutside - Detect clicks outside an element
 */
export const useOnClickOutside = (ref, handler) => {
  useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) {
        return;
      }
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
};

/**
 * useAsync - Handle async operations with loading and error states
 */
export const useAsync = (asyncFunction) => {
  const [state, setState] = useState({
    loading: false,
    error: null,
    data: null,
  });

  const execute = useCallback(async (...params) => {
    setState({ loading: true, error: null, data: null });
    try {
      const data = await asyncFunction(...params);
      setState({ loading: false, error: null, data });
      return data;
    } catch (error) {
      setState({ loading: false, error: error.message, data: null });
      throw error;
    }
  }, [asyncFunction]);

  return { ...state, execute };
};

/**
 * useToast - Toast notification hook
 */
export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
    const toast = { id, message, type, duration };

    setToasts(prev => [...prev, toast]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return {
    toasts,
    addToast,
    removeToast,
    success: (msg, duration) => addToast(msg, 'success', duration),
    error: (msg, duration) => addToast(msg, 'error', duration),
    warning: (msg, duration) => addToast(msg, 'warning', duration),
    info: (msg, duration) => addToast(msg, 'info', duration),
  };
};
