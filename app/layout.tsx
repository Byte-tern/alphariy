import './globals.css'
export const metadata = { title: 'Альфа-Капитал · учебное демо' }
export default function Root({ children }: { children: React.ReactNode }) {
  return <html lang="ru"><body>{children}</body></html>
}
