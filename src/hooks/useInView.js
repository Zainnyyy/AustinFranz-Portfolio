import { useEffect, useRef, useState } from 'react'

export default function useInView(threshold = 0.12) {
  const ref = useRef(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setSeen(true); io.disconnect() }
    }, { threshold })
    io.observe(el)
    const t = setTimeout(() => setSeen(true), 4000)
    return () => { io.disconnect(); clearTimeout(t) }
  }, [threshold])
  return [ref, seen]
}
