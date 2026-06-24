(function(){
  var p=new URLSearchParams(location.search);
  if(p.get('optin')==='1')return;
  var deadline = window.__countdownDeadline || '2026-06-25T12:00:00+02:00';
  var redirect = window.__countdownRedirect || 'https://try.onetake.ai/bootcamps/mav/le-cercle/';
  if(new Date()>new Date(deadline)){
    location.replace(redirect);
  }
})();
