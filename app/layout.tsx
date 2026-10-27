import './globals.css'
export const metadata = { title: 'Альфа-Навигатор финансирования' }
export default function Root({ children }: { children: React.ReactNode }) {
  return <html lang="ru">
    <body>{children}</body>
  </html>
}
