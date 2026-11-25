import * as THREE from 'three';
export default function initBrain(box,tipEl){const $=()=>tipEl;let dead=false;const R=new THREE.WebGLRenderer({antialias:true,alpha:true});R.setPixelRatio(Math.min(devicePixelRatio,2));box.prepend(R.domElement);
const S=new THREE.Scene(),C=new THREE.PerspectiveCamera(40,1,.1,50);let zoom=4.4;S.add(new THREE.AmbientLight(0x8899cc,.7));const L=new THREE.DirectionalLight(0xffffff,1.1);L.position.set(3,4,5);S.add(L);const L2=new THREE.PointLight(0x38BDF8,1.2,20);L2.position.set(-4,-1,2);S.add(L2);
const G=new THREE.Group();S.add(G);const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.6,metalness:0});
function hemi(sx){const g=new THREE.SphereGeometry(1,96,72),p=g.attributes.position;for(let i=0;i<p.count;i++){let x=p.getX(i),y=p.getY(i),z=p.getZ(i);const f=Math.sin(x*9+y*5)*Math.cos(z*8-y*4)+Math.sin(z*11+x*6)*.6;let r=1+.035*f;
const nx=x*.72,ny=y*.68,nz=z*1.12;let X=nx*r,Y=ny*r,Z=nz*r;if(Y<-.15)Y*=.8;if(Z>.5&&Y<0)Y-=.08*(Z-.5);p.setXYZ(i,X*sx*1+sx*.0,Y,Z)}g.computeVertexNormals();const m=new THREE.Mesh(g,mat);m.position.x=sx*.42;m.scale.x=sx;return m}
const H=(x,y,z)=>{const s=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453;return s-Math.floor(s)},sm=t=>t*t*(3-2*t),cl=t=>Math.min(1,Math.max(0,t));
const vn=(x,y,z)=>{const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z),xf=sm(x-xi),yf=sm(y-yi),zf=sm(z-zi);let r=0;for(let i=0;i<2;i++)for(let j=0;j<2;j++)for(let k=0;k<2;k++)r+=H(xi+i,yi+j,zi+k)*(i?xf:1-xf)*(j?yf:1-yf)*(k?zf:1-zf);return r};
function brain(seed){const g=new THREE.SphereGeometry(1,200,150),p=g.attributes.position,col=new Float32Array(p.count*3);
for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
let X=(x<0?x*.1:x)*.56+.06,Y=y*.7*(y<0?.74:1),Z=z*1.05;
const tb=Math.exp(-((y+.55)**2/.08+(z-.1)**2/.3));if(x>0){X+=tb*.07;Y-=tb*.05}
X*=1-.3*cl((z-.55)*2);X*=1-.2*cl((-z-.55)*2);
const sy=x>0?Math.exp(-((y+.12+.18*z)**2)/.006)*cl(z+.4)*cl(.8-z):0;
const a=x*2.3+seed,b=y*2.3,c=z*2.3,w=(vn(a*.8+7,b*.8,c*.8)-.5)*1.1;
const q=vn(a+w,b+w,c+w),g1=1-sm(cl(Math.abs(q-.5)/.085)),q2=vn(a*2.1+w+9,b*2.1+w,c*2.1+w),g2=1-sm(cl(Math.abs(q2-.5)/.07));
const gr=cl(g1+g2*.55),d=-.07*gr-.07*sy+.03*(q-.5);
p.setXYZ(i,X+x*d,Y+y*d,Z+z*d);
const sh=.82+.18*(1-gr),k=gr*.8;col.set([(.95-.38*k)*sh,(.74-.46*k)*sh,(.72-.4*k)*sh],i*3)}
g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeVertexNormals();return g}
const a=new THREE.Mesh(brain(0),mat),b=new THREE.Mesh(brain(3.7),mat);b.scale.x=-1;G.add(a,b);
const cg=new THREE.SphereGeometry(1,90,60),cp=cg.attributes.position,cc=new Float32Array(cp.count*3);for(let i=0;i<cp.count;i++){const x=cp.getX(i),y=cp.getY(i),z=cp.getZ(i),r=Math.abs(Math.sin(y*34+vn(x*3,y*2,z*3)*3)),d=-.035*(1-r)**2;cp.setXYZ(i,x*.6*(1+d),y*.34*(1+d),z*.5*(1+d));const s=.75+.25*r;cc.set([.78*s,.56*s,.52*s],i*3)}
cg.setAttribute('color',new THREE.BufferAttribute(cc,3));cg.computeVertexNormals();const cb=new THREE.Mesh(cg,mat);cb.position.set(0,-.62,-.78);G.add(cb);
const st=new THREE.Mesh(new THREE.CylinderGeometry(.13,.09,.7,24),new THREE.MeshStandardMaterial({color:0xd9a89f,roughness:.7}));st.position.set(0,-.95,-.4);st.rotation.x=-.25;G.add(st);
const marks=[],mk=(n,d,x,y,z)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(.07,16,12),new THREE.MeshBasicMaterial({color:0x14B8A6,depthTest:false,transparent:true,opacity:.95}));m.position.set(x,y,z);m.userData={n,d};G.add(m);marks.push(m)};
const info='Often discussed in Alzheimer’s research. Not a model output.';[1,-1].forEach(s=>{mk('Hippocampus',info+' Memory formation; among earliest regions affected.',s*.36,-.3,-.05);mk('Temporal lobe',info,s*.6,-.42,.3)});
const N=260,pg=new THREE.BufferGeometry(),pa=new Float32Array(N*3);for(let i=0;i<N;i++){const r=1.9+Math.random()*.9,t=Math.random()*6.28,u=Math.acos(2*Math.random()-1);pa.set([r*Math.sin(u)*Math.cos(t),r*Math.cos(u),r*Math.sin(u)*Math.sin(t)],i*3)}
pg.setAttribute('position',new THREE.BufferAttribute(pa,3));const pts=new THREE.Points(pg,new THREE.PointsMaterial({color:0x38BDF8,size:.025,transparent:true,opacity:.7}));S.add(pts);
let rx=.2,ry=-.6,drag=false,lx=0,ly=0,auto=true;const el=R.domElement,ray=new THREE.Raycaster(),mv=new THREE.Vector2();
el.onpointerdown=e=>{drag=true;auto=false;lx=e.clientX;ly=e.clientY;box.style.cursor='grabbing'};addEventListener('pointerup',()=>{drag=false;box.style.cursor='grab'});
el.onpointermove=e=>{const r=el.getBoundingClientRect();if(drag){ry+=(e.clientX-lx)*.008;rx+=(e.clientY-ly)*.008;lx=e.clientX;ly=e.clientY}
mv.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(mv,C);const h=ray.intersectObjects(marks)[0];$('#tip').innerHTML=h?`<b>${h.object.userData.n}</b><br>${h.object.userData.d}`:'Drag to rotate · scroll to zoom · hover the teal markers. Regions shown are anatomical reference points, not model outputs.'};
el.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.min(8,Math.max(2.6,zoom+e.deltaY*.004))},{passive:false});
function size(){const w=box.clientWidth,h=box.clientHeight;if(w&&h){R.setSize(w,h);C.aspect=w/h;C.updateProjectionMatrix()}}
let t=0;(function loop(){if(dead)return;requestAnimationFrame(loop);if(!box.offsetParent)return;size();t+=.01;if(auto)ry+=.003;G.rotation.set(rx,ry,0);G.position.y=Math.sin(t)*.03;C.position.set(0,0,zoom);pts.rotation.y=t*.05;
marks.forEach((m,i)=>m.scale.setScalar(1+.25*Math.sin(t*3+i)));R.render(S,C)})();return()=>{dead=true;R.dispose();R.domElement.remove()}}