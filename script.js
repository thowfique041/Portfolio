const header=document.querySelector('[data-header]'),button=document.querySelector('[data-menu-toggle]'),nav=document.querySelector('[data-nav]');
const closeMenu=()=>{nav.classList.remove('open');button.setAttribute('aria-expanded','false')};
button.addEventListener('click',()=>{const open=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!open));nav.classList.toggle('open',!open)});
nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMenu));
window.addEventListener('scroll',()=>header.classList.toggle('scrolled',scrollY>16),{passive:true});
const items=document.querySelectorAll('.reveal'),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
if(reduced||!('IntersectionObserver' in window))items.forEach(item=>item.classList.add('visible'));else{const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}}),{threshold:.12});items.forEach(item=>observer.observe(item))}
document.querySelector('[data-year]').textContent=new Date().getFullYear();
