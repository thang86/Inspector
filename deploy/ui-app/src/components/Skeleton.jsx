// Loading Skeleton Components
import React from 'react';
import './Skeleton.css';

// Generic Skeleton Component
export const Skeleton = ({ width = '100%', height = '20px', borderRadius = '4px', className = '' }) => (
  <div
    className={`skeleton ${className}`}
    style={{ width, height, borderRadius }}
  />
);

// Table Skeleton
export const TableSkeleton = ({ rows = 5, columns = 5 }) => (
  <div className="skeleton-table">
    <div className="skeleton-table-header">
      {Array(columns).fill(0).map((_, i) => (
        <Skeleton key={i} height="40px" />
      ))}
    </div>
    <div className="skeleton-table-body">
      {Array(rows).fill(0).map((_, rowIndex) => (
        <div key={rowIndex} className="skeleton-table-row">
          {Array(columns).fill(0).map((_, colIndex) => (
            <Skeleton key={colIndex} height="50px" />
          ))}
        </div>
      ))}
    </div>
  </div>
);

// Card Skeleton
export const CardSkeleton = () => (
  <div className="skeleton-card">
    <Skeleton height="40px" className="skeleton-card-title" />
    <Skeleton height="20px" width="70%" className="skeleton-card-subtitle" />
    <div className="skeleton-card-content">
      <Skeleton height="15px" width="90%" />
      <Skeleton height="15px" width="60%" />
      <Skeleton height="15px" width="80%" />
    </div>
    <div className="skeleton-card-actions">
      <Skeleton height="36px" width="100px" borderRadius="6px" />
      <Skeleton height="36px" width="100px" borderRadius="6px" />
    </div>
  </div>
);

// KPI Card Skeleton
export const KPISkeleton = () => (
  <div className="skeleton-kpi">
    <Skeleton height="20px" width="60%" />
    <Skeleton height="48px" width="80px" className="skeleton-kpi-value" />
  </div>
);

// Chart Skeleton
export const ChartSkeleton = ({ height = '300px' }) => (
  <div className="skeleton-chart" style={{ height }}>
    <Skeleton height="30px" width="200px" className="skeleton-chart-title" />
    <div className="skeleton-chart-bars">
      {Array(6).fill(0).map((_, i) => (
        <Skeleton
          key={i}
          height={`${Math.random() * 60 + 40}%`}
          width="40px"
        />
      ))}
    </div>
  </div>
);

// Input Form Skeleton
export const FormSkeleton = ({ fields = 5 }) => (
  <div className="skeleton-form">
    {Array(fields).fill(0).map((_, i) => (
      <div key={i} className="skeleton-form-field">
        <Skeleton height="18px" width="120px" className="skeleton-form-label" />
        <Skeleton height="42px" borderRadius="6px" />
      </div>
    ))}
    <div className="skeleton-form-actions">
      <Skeleton height="42px" width="120px" borderRadius="6px" />
      <Skeleton height="42px" width="120px" borderRadius="6px" />
    </div>
  </div>
);

// Grid Skeleton (for channel cards)
export const GridSkeleton = ({ items = 6, columns = 3 }) => (
  <div className="skeleton-grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
    {Array(items).fill(0).map((_, i) => (
      <CardSkeleton key={i} />
    ))}
  </div>
);

// Alert Row Skeleton
export const AlertRowSkeleton = () => (
  <div className="skeleton-alert-row">
    <Skeleton height="16px" width="100px" />
    <Skeleton height="16px" width="120px" />
    <Skeleton height="16px" width="80px" />
    <Skeleton height="24px" width="70px" borderRadius="12px" />
    <Skeleton height="16px" width="60%" />
    <Skeleton height="32px" width="100px" borderRadius="6px" />
  </div>
);

// Page Skeleton (combines multiple components)
export const PageSkeleton = ({ type }) => {
  switch (type) {
    case 'overview':
      return (
        <div className="skeleton-page">
          <div className="skeleton-kpi-grid">
            {Array(4).fill(0).map((_, i) => <KPISkeleton key={i} />)}
          </div>
          <div className="skeleton-charts">
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
        </div>
      );

    case 'table':
      return <TableSkeleton rows={10} columns={8} />;

    case 'grid':
      return <GridSkeleton items={9} columns={3} />;

    default:
      return <Skeleton height="400px" />;
  }
};

export default Skeleton;
