import {useEffect,useState} from 'react';
import {BrowserRouter,Routes,Route,NavLink,Link} from 'react-router-dom';
import {api,refresh,setAccess} from './api';import Home from './pages/Home';import Analyze from './pages/Analyze';import Compare from './pages/Compare';
import History from './pages/History';import About from './pages/About';import AuthPage from './pages/AuthPage';
import {Ctx} from './auth';
export default function App(){const[user,setUser]=useState(null);
const [restoring,setRestoring]=useState(true),[signingOut,setSigningOut]=useState(false),[logoutError,setLogoutError]=useState('');
useEffect(()=>{refresh().then(j=>setUser(j.email)).catch(()=>{}).finally(()=>setRestoring(false))},[]);
const out=async()=>{
  setSigningOut(true);
  setLogoutError('');
  try{
    await api('/auth/logout',{method:'POST'});
    setAccess(null);
    setUser(null);
  }catch{
    setLogoutError('Could not sign out. Check your connection and try again.');
  }finally{
    setSigningOut(false);
  }
};
return <Ctx.Provider value={{user,setUser,restoring}}><BrowserRouter>
<header><Link className="logo" to="/"><svg width="30" height="30" viewBox="0 0 30 30" fill="none"><circle cx="15" cy="15" r="13" stroke="#38BDF8" strokeWidth="2"/><path d="M3 16h6l3-8 5 14 3-6h7" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg><div>NEUROSCAN AI<small>AI-Powered EEG Analysis for Alzheimer’s Research</small></div></Link>
<nav>{[['/','Overview'],['/analyze','EEG Analysis'],['/compare','Models'],['/history','Reports'],['/about','About']].map(([p,l])=><NavLink key={p} to={p} end className={({isActive})=>isActive?'on':''}>{l}</NavLink>)}</nav>
{user?<button className="btn g" onClick={out} disabled={signingOut}>{signingOut?'Signing out…':'Sign out'}</button>:<Link className="btn p" to="/login">Sign in</Link>}</header>
<main>{logoutError&&<p className="pill bad" role="alert">{logoutError}</p>}
<Routes><Route path="/" element={<Home/>}/><Route path="/analyze" element={<Analyze/>}/><Route path="/compare" element={<Compare/>}/><Route path="/history" element={<History/>}/><Route path="/about" element={<About/>}/><Route path="/login" element={<AuthPage key="login"/>}/><Route path="/signup" element={<AuthPage key="signup" register/>}/></Routes>
</main>
</BrowserRouter></Ctx.Provider>}
