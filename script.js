(function(){
  var root=document.documentElement, btn=document.getElementById('theme');
  btn.addEventListener('click',function(){
    var dark=root.getAttribute('data-theme')!=='light';
    root.setAttribute('data-theme',dark?'light':'dark');
  });
})();