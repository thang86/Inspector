// Pagination Component
import React from 'react';
import './Pagination.css';

const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  showPageNumbers = true,
  showFirstLast = true,
  maxPageButtons = 5
}) => {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);

    // Adjust start if we're near the end
    if (endPage - startPage + 1 < maxPageButtons) {
      startPage = Math.max(1, endPage - maxPageButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  };

  const pageNumbers = showPageNumbers ? getPageNumbers() : [];

  return (
    <div className="pagination">
      <div className="pagination-info">
        Page {currentPage} of {totalPages}
      </div>

      <div className="pagination-controls">
        {/* First Page */}
        {showFirstLast && currentPage > 1 && (
          <button
            className="pagination-btn pagination-btn-first"
            onClick={() => onPageChange(1)}
            aria-label="First page"
          >
            «
          </button>
        )}

        {/* Previous Page */}
        <button
          className="pagination-btn pagination-btn-prev"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          ‹
        </button>

        {/* Page Numbers */}
        {showPageNumbers && (
          <div className="pagination-numbers">
            {pageNumbers[0] > 1 && (
              <>
                <button
                  className="pagination-btn"
                  onClick={() => onPageChange(1)}
                >
                  1
                </button>
                {pageNumbers[0] > 2 && (
                  <span className="pagination-ellipsis">...</span>
                )}
              </>
            )}

            {pageNumbers.map(page => (
              <button
                key={page}
                className={`pagination-btn ${page === currentPage ? 'active' : ''}`}
                onClick={() => onPageChange(page)}
                aria-label={`Page ${page}`}
                aria-current={page === currentPage ? 'page' : undefined}
              >
                {page}
              </button>
            ))}

            {pageNumbers[pageNumbers.length - 1] < totalPages && (
              <>
                {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                  <span className="pagination-ellipsis">...</span>
                )}
                <button
                  className="pagination-btn"
                  onClick={() => onPageChange(totalPages)}
                >
                  {totalPages}
                </button>
              </>
            )}
          </div>
        )}

        {/* Next Page */}
        <button
          className="pagination-btn pagination-btn-next"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          ›
        </button>

        {/* Last Page */}
        {showFirstLast && currentPage < totalPages && (
          <button
            className="pagination-btn pagination-btn-last"
            onClick={() => onPageChange(totalPages)}
            aria-label="Last page"
          >
            »
          </button>
        )}
      </div>
    </div>
  );
};

// Compact pagination (for smaller spaces)
export const CompactPagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  return (
    <div className="pagination pagination-compact">
      <button
        className="pagination-btn"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Previous page"
      >
        ‹ Previous
      </button>

      <span className="pagination-compact-info">
        {currentPage} / {totalPages}
      </span>

      <button
        className="pagination-btn"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
      >
        Next ›
      </button>
    </div>
  );
};

// Page size selector
export const PageSizeSelector = ({ pageSize, onPageSizeChange, options = [10, 20, 50, 100] }) => {
  return (
    <div className="page-size-selector">
      <label htmlFor="page-size">Items per page:</label>
      <select
        id="page-size"
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
        className="page-size-select"
      >
        {options.map(size => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </div>
  );
};

export default Pagination;
