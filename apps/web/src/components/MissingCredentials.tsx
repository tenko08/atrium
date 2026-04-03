export function MissingCredentials() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'monospace',
      padding: '2rem',
    }}>
      <div style={{ maxWidth: '480px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Canvas Not Configured</h1>
        <p style={{ marginBottom: '1rem', color: '#666' }}>
          Add the following variables to <code>apps/api/.env</code> to connect your Canvas account:
        </p>
        <div style={{
          background: '#f4f4f4',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          textAlign: 'left',
        }}>
          <code>CANVAS_API_TOKEN=your_token_here</code><br />
          <code>CANVAS_BASE_URL=https://your-school.instructure.com</code>
        </div>
        <p style={{ color: '#666', fontSize: '0.875rem' }}>
          Then restart the dev server and refresh this page.
        </p>
      </div>
    </div>
  )
}
