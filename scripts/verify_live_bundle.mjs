import https from 'node:https';

https.get('https://gowma.vercel.app', (res) => {
  let html = '';
  res.on('data', chunk => html += chunk);
  res.on('end', () => {
    console.log('HTML status:', res.statusCode);
    const m = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
    if (m) {
      console.log('Main bundle URL:', m[1]);
      https.get('https://gowma.vercel.app' + m[1], (res2) => {
        let js = '';
        res2.on('data', c => js += c);
        res2.on('end', () => {
          console.log('JS Bundle status:', res2.statusCode, 'Length:', js.length);
          console.log('Contains Base64 data URI:', js.includes('data:image/jpeg;base64'));
          console.log('Contains Lakshmi:', js.includes('Lakshmi'));
          console.log('Contains Visakhapatnam:', js.includes('Visakhapatnam'));
        });
      });
    }
  });
});
