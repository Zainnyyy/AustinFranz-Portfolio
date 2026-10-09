import useTheme from './hooks/useTheme'
import { Navbar, Hero, About, TechStack, SkillMatrix, Projects, Contact, Footer } from './components/AllComponents'

export default function App() {
  const [dark, toggleTheme] = useTheme()
  return (
    <>
      <Navbar dark={dark} onToggleTheme={toggleTheme} />
      <main>
        <Hero />
        <About />
        <TechStack />
        <SkillMatrix />
        <Projects />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
