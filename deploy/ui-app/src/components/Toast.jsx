// Toast Notification Component
import React from 'react';
import './Toast.css';

const Toast = ({ toasts, onRemove }) => {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type}`}
          onClick={() => onRemove(toast.id)}
        >
          <div className="toast-icon">
            {getIcon(toast.type)}
          </div>
          <div className="toast-content">
            <div className="toast-message">{toast.message}</div>
          </div>
          <button
            className="toast-close"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(toast.id);
            }}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

const getIcon = (type) => {
  switch (type) {
    case 'success':
      return '✓';
    case 'error':
      return '✕';
    case 'warning':
      return '⚠';
    case 'info':
    default:
      return 'ℹ';
  }
};

export default Toast;
