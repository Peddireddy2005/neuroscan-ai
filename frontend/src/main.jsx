import {Component} from 'react';import {createRoot} from 'react-dom/client';import App from './App';import './styles.css';
class Boundary extends Component{state={e:null};static getDerivedStateFromError(e){return{e}}
render(){return this.state.e?<div style={{padding:32,fontFamily:'sans-serif'}}><h2>Something went wrong</h2><p>Please send this message to the developer:</p><pre style={{whiteSpace:'pre-wrap',background:'#fee',padding:12}}>{String(this.state.e.stack||this.state.e)}</pre></div>:this.props.children}}
createRoot(document.getElementById('root')).render(<Boundary><App/></Boundary>);
