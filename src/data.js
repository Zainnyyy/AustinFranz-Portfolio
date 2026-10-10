// ⚠ Fill these two in: they were in your old data.js, which wasn't uploaded.
export const EMAIL = 'your-email@example.com'   // visitors' messages are sent here
export const FORM_URL = ''                      // optional Formspree-style endpoint; empty = open the visitor's email app

export const PROFILE = {
  full: 'Austin Franz Arabia',
  role: 'Beginner Developer / UI Designer',
  school: 'Western Institute of Technology',
  location: 'Iloilo, Philippines',
}

export const NAV = [
  ['Home', '#hero', 'hover:bg-gray-950 hover:text-white'],
  ['About', '#about', 'hover:bg-[#FF4D8D] hover:text-white'],
  ['Skill', '#skills', 'hover:bg-[#0038FF] hover:text-white'],
  ['Projects', '#works', 'hover:bg-[#FACC15] hover:text-gray-950'],
  ['Contact', '#contact', 'hover:bg-[#FF4D8D] hover:text-white'],
]

export const BABEL = [['HTML','<h1>Hello, World!</h1>'],['CSS','box-shadow: 4px 4px 0;'],['JS','console.log("Hello!");'],['REACT','const [dev] = useState("az");'],['PY','print("Hello, World!")'],['RUS','Привет, мир!'],['JPN','こんにちは、世界！'],['KOR','안녕하세요, 세계!'],['IDN','Halo dunia! 🚀'],['FIL','Kumusta, mundo!'],['HIL','Kamusta, kalibutan!'],['SH','$ npm run dev'],['GIT','$ git commit -m "ship it"'],['INF','while(alive) { code(); }'],['BUG','// works on my machine'],['KAOM','(づ｡◕‿‿◕｡)づ']]

const OK = 'text-green-400 font-bold'
export const TYPED = [
  [OK,'✓ '],['','Loading profile: Austin Franz Arabia\n'],
  [OK,'✓ '],['','Role: Beginner Developer / UI Designer.\n'],
  [OK,'✓ '],['','Location: Iloilo, Philippines.\n'],
  [OK,'✓ '],['','Studying BSIT @ Western Institute of Technology.\n'],
  [OK,'✓ '],['','Stack: HTML · CSS · JS · React · Python.\n'],
  [OK,'✓ '],['text-green-400 font-extrabold','Success! '],['text-slate-100 font-extrabold','Open to projects & collaboration.'],
]

export const ROW1 = [['HTML','#e34f26','MARKUP'],['CSS','#1572b6','STYLE'],['JavaScript','#d4b106','LANGUAGE'],['React','#087ea4','FRAMEWORK'],['Python','#3776ab','LANGUAGE']]
export const ROW2 = [...ROW1].reverse()

export const STATS = [[5,'','Featured Projects'],[3,'Year','BSIT Year Level']]
export const SERVICES = ['UI Design','Web Development','React Frontend']
export const TOOLS = {
  LANGUAGES: ['HTML','CSS','JavaScript','Python'],
  'FRAMEWORKS & LIBRARIES': ['React'],
  DESIGN: ['UI Design'],
}

export const PROJECTS = [
  { no:'01', kind:'Music Player UI', name:'Music Player Card', desc:'A Spotify-style player card for "Cry" by Cigarettes After Sex, with a progress bar, playback controls and quick actions over a rainy monochrome backdrop.', tags:['UI Design','Frontend'], host:'Figma design', url:'https://www.figma.com/design/1tzznhHjrMfQhQrFLORQdj/Untitled?node-id=0-1&t=flUlHeqNj9zYEvB1-1', img:'/img/project-music.png' },
  { no:'02', kind:'Web App Landing', name:'Classee', desc:'Landing screen for Classee, a classroom app with separate entry points for students and teachers.', tags:['UI Design','Web'], host:'Figma prototype', url:'https://www.figma.com/proto/5BCzxYrd9lSXYjdDwj9h5Z/Classee-Design?node-id=70-10&p=f&t=2q9R8AbTdXqdPpHO-1&scaling=scale-down-width&content-scaling=fixed&page-id=0%3A1&starting-point-node-id=70%3A10&show-proto-sidebar=1', img:'/img/project-classee.png' },
  { no:'03', kind:'Product Card UI', name:'Susanto-X Gaming Mouse', desc:'A product card for a gaming mouse with a wishlist heart, peso pricing and an Add to Cart button on a glowing magenta backdrop.', tags:['UI Design','Frontend'], host:'Figma design', url:'https://www.figma.com/design/Sw6XTRDWWOplZB9ys419m3/Untitled?node-id=2-2&t=4LquM2EzxyZ1UWXH-1', img:'/img/project-mouse.png' },
  { no:'04', kind:'Portfolio Website', name:'V1-Portfolio', desc:'A personal portfolio website built to showcase my work, UI experiments, and developer profile with a bold cyber-inspired aesthetic and responsive layout.', tags:['Portfolio','Web','Frontend'], host:'Live project', url:'https://portfolio-six-lemon-tb167hjq5h.vercel.app/?name=&email=&message=', img:'/img/project-v1-portfolio.png' },
  { no:'05', kind:'Skill Platform', name:'Skillbridge', desc:'A web app landing and login experience focused on course access, skill development, and a modern digital learning interface for students and creators.', tags:['Web App','UI Design','Frontend'], host:'Live project', url:'https://skillbridgeversion1.vercel.app/login', img:'/img/project-skillbridge.png' },
]
