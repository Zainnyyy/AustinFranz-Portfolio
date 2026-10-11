import { useState, useEffect, useRef } from 'react'
import useTheme from './hooks/useTheme'
import { Navbar, Hero, About, TechStack, SkillMatrix, Projects, Contact, Footer } from './components/AllComponents'

function CustomCursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [particles, setParticles] = useState([])
  const particleIdRef = useRef(0)

  useEffect(() => {
    const handleMouseMove = (e) => {
      setPosition({ x: e.clientX, y: e.clientY })

      // Create particles randomly
      if (Math.random() > 0.7) {
        const newParticle = {
          id: particleIdRef.current++,
          x: e.clientX,
          y: e.clientY,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4,
        }
        setParticles((prev) => [...prev, newParticle])
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.15,
            opacity: 1 - (Date.now() % 500) / 500,
          }))
          .filter((p) => (Date.now() - 0 < 500))
      )
    }, 16)

    return () => clearInterval(interval)
  }, [])

  return (
    <>
      {/* Glow cursor */}
      <div
        className="fixed w-6 h-6 pointer-events-none z-50 mix-blend-screen"
        style={{
          left: position.x - 12,
          top: position.y - 12,
          opacity: 0.8,
        }}
      >
        <div className="absolute inset-0 border-2 border-[#0038FF] rounded-full animate-pulse"></div>
        <div className="absolute inset-1 border border-[#FF4D8D] rounded-full"></div>
        <div className="absolute w-1 h-1 bg-[#22C55E] rounded-full top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 shadow-lg shadow-[#22C55E]"></div>
      </div>

      {/* Outer glow */}
      <div
        className="fixed w-12 h-12 pointer-events-none z-40"
        style={{
          left: position.x - 24,
          top: position.y - 24,
          background: 'radial-gradient(circle, rgba(0,56,255,0.1) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(8px)',
        }}
      ></div>

      {/* Particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="fixed w-1 h-1 pointer-events-none z-30"
          style={{
            left: p.x,
            top: p.y,
            background: ['#0038FF', '#FF4D8D', '#22C55E'][Math.floor(Math.random() * 3)],
            borderRadius: '50%',
            opacity: p.opacity || 0,
            boxShadow: `0 0 4px currentColor`,
          }}
        ></div>
      ))}
    </>
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
