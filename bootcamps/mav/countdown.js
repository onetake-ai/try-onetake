(function(){
  var p=new URLSearchParams(location.search);
  if(p.get('optin')==='1')return;
  if(new Date()>new Date('2026-06-25T12:00:00+02:00')){
    location.replace('https://try.onetake.ai/bootcamps/mav/le-cercle/');
  }
})();
