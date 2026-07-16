import TrainerBottomNavigation from './[token]/TrainerBottomNavigation'

export default function TrainerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
      <TrainerBottomNavigation />
    </>
  )
}
