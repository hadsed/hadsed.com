// Apply before paint; the UI theme does not change the shot's lighting.
(()=>{
 const root=document.documentElement,media=matchMedia('(prefers-color-scheme: dark)');
 let mode='system';try{const saved=localStorage.getItem('sr71-ui-theme');if(['light','dark','system'].includes(saved))mode=saved}catch{}
 const apply=()=>{root.dataset.theme=mode==='system'?(media.matches?'dark':'light'):mode};
 apply();media.addEventListener('change',apply);
 addEventListener('DOMContentLoaded',()=>{const select=document.getElementById('theme');select.value=mode;select.onchange=()=>{mode=select.value;try{localStorage.setItem('sr71-ui-theme',mode)}catch{}apply()}});
})();
