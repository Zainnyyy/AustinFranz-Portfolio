import { useState, useEffect, useRef } from 'react'
import useTheme from './hooks/useTheme'
import { Navbar, Hero, About, TechStack, SkillMatrix, Projects, Contact, Footer } from './components/AllComponents'

function CustomCursor() {
  const cursorRef = useRef(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouseMove = (e) => {
      setPosition({ x: e.clientX, y: e.clientY })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <div
      ref={cursorRef}
      className="pointer-events-none fixed w-4 h-4 bg-[#FF4D8D] rounded-full shadow-lg z-[10000]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -50%)',
        boxShadow: '0 0 20px rgba(255, 77, 141, 0.8), 0 0 40px rgba(255, 77, 141, 0.4)',
      }}
    />
  )
}

function LoadingScreen({ isVisible }) {
  return (
    <div className={`fixed inset-0 bg-gray-950 z-[9999] flex flex-col items-center justify-center gap-6 transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 border-4 border-transparent border-t-[#0038FF] border-r-[#22C55E] rounded-full animate-spin"></div>
        <div className="absolute inset-2 border-4 border-transparent border-b-[#FF4D8D] rounded-full animate-spin" style={{ animationDirection: 'reverse' }}></div>
      </div>
      <div className="text-center space-y-2">
        <h1 className="font-oswald text-2xl font-bold uppercase text-white tracking-widest">AZ</h1>
        <div className="flex gap-1 justify-center">
          <span className="w-2 h-2 bg-[#0038FF] rounded-full animate-bounce"></span>
          <span className="w-2 h-2 bg-[#22C55E] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
          <span className="w-2 h-2 bg-[#FF4D8D] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [dark, toggleTheme] = useTheme()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      <CustomCursor />
      <LoadingScreen isVisible={isLoading} />
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
