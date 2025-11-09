export default function Home() {
  return (
    <div style={{
      padding: '2rem',
      fontFamily: 'system-ui, sans-serif',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
        Ibticar.AI API
      </h1>
      <p style={{ marginBottom: '2rem', color: '#666' }}>
        Backend services for Ibticar.AI vehicle dealership platform
      </p>

      <div style={{
        padding: '1.5rem',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        marginBottom: '1rem'
      }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>API Endpoints</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={{ marginBottom: '0.5rem' }}>
            <code style={{ backgroundColor: '#fff', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
              /api/auth/*
            </code> - Authentication
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <code style={{ backgroundColor: '#fff', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
              /api/vehicles/*
            </code> - Vehicle management
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <code style={{ backgroundColor: '#fff', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
              /api/customers/*
            </code> - Customer management
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <code style={{ backgroundColor: '#fff', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
              /api/ai/*
            </code> - AI services (pricing, rotation, recommendations)
          </li>
        </ul>
      </div>

      <p style={{ fontSize: '0.875rem', color: '#999' }}>
        Version: 1.0.0 | Environment: {process.env.NODE_ENV || 'development'}
      </p>
    </div>
  );
}
