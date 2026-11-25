import {useEffect,useRef,useState} from 'react';import initBrain from './brainScene';
export default function Brain(){const b=useRef(),t=useRef(),[bad,setBad]=useState(false);
useEffect(()=>{let stop;try{t.current.textContent='Drag to rotate · scroll to zoom · hover the teal markers. Regions are anatomical reference points, not model outputs.';stop=initBrain(b.current,t.current)}catch(e){console.warn('3D brain disabled:',e);setBad(true)}return()=>stop&&stop()},[]);
return <div id="brain" ref={b}>{bad&&<div className="sub" style={{padding:24}}>3D brain preview unavailable (WebGL is turned off in this browser). The rest of the site works normally.</div>}<div id="tip" ref={t}/></div>}
