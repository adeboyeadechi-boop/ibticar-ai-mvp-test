export default function NotFound() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
      <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>404 - Not Found</h2>
      <p>The page you are looking for does not exist.</p>
      <a href="/" style={{ color: '#0070f3', textDecoration: 'underline', marginTop: '1rem', display: 'inline-block' }}>
        Return Home
      </a>
    </div>
  )
}
