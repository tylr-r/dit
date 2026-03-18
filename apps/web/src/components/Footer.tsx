import './Footer.css'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="app-footer">
      <span>© {currentYear} Tylr</span>
      <span>| </span>
      <a href="/privacy">Privacy</a>
      <span>| </span>
      <a href="/terms">Terms</a>
      <span>| </span>
      <a href="/support">Support</a>
    </footer>
  )
}
