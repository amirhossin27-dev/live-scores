// Push handlers appended to the generated sw.js (see vite.config.ts). They show notifications only; nothing is cached.
export const swPushSource = `
self.addEventListener('push',e=>{let d={};try{d=e.data?e.data.json():{}}catch(_){d={}} const title=typeof d.title==='string'&&d.title?d.title:'Live Scores';
 e.waitUntil(self.registration.showNotification(title,{body:typeof d.body==='string'?d.body:'',tag:typeof d.tag==='string'?d.tag:undefined,icon:'icons/icon-192.png',data:{url:typeof d.url==='string'?d.url:'./'}}))});
self.addEventListener('notificationclick',e=>{e.notification.close(); const scope=self.registration.scope; let url=new URL('./',scope).href;
 try{const u=new URL((e.notification.data&&e.notification.data.url)||'./',scope); if(u.href.startsWith(scope))url=u.href}catch(_){}
 e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{const c=cs.find(c=>c.url.startsWith(scope)); return c?c.focus():self.clients.openWindow(url)}))});
`
