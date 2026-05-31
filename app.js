const site = document.getElementById('site');
const content = document.getElementById('content');
const statusbar = document.getElementById('statusbar');
const taskItems = document.querySelectorAll('.task-item');

const templates = {
  home: document.getElementById('tmpl-home').content,
  about: document.getElementById('tmpl-about').content,
  contact: document.getElementById('tmpl-contact').content
};

function setActiveTask(route){
  taskItems.forEach(t=>{
    t.classList.toggle('active', t.dataset.route === route);
  });
}

function render(route){
  route = route || '#/home';
  setActiveTask(route);
  let key = route.replace('#/','') || 'home';
  if(!templates[key]) key = 'home';
  content.innerHTML = '';
  content.appendChild(templates[key].cloneNode(true));
  // update status only (no OS window title)
  statusbar.textContent = `Viewing: ${key.charAt(0).toUpperCase() + key.slice(1)}`;
  wirePage(key);
}

function wirePage(key){
  // links
  content.querySelectorAll('a.link').forEach(a=>{
    a.addEventListener('click', e=>{
      e.preventDefault();
      const href = a.getAttribute('href');
      location.hash = href;
    });
  });




}



// init routing
window.addEventListener('hashchange', ()=> render(location.hash));
document.querySelectorAll('.task-item').forEach(t=>{
  t.addEventListener('click', ()=> location.hash = t.dataset.route);
});

/* Removed window/start button controls — site is a simple page now */

// simple keyboard navigation: 1-3 switch pages
window.addEventListener('keydown', (e)=>{
  if(e.key === '1') location.hash = '#/home';
  if(e.key === '2') location.hash = '#/about';
  if(e.key === '3') location.hash = '#/contact';
});

// initial render
if(!location.hash) location.hash = '#/home';
render(location.hash);