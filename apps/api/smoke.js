const http = require('http');

function post(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: '127.0.0.1',
      port: 4000,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let out = '';
      res.on('data', (d) => (out += d));
      res.on('end', () => resolve({ statusCode: res.statusCode, body: out }));
    });
    req.on('error', (e) => reject(e));
    req.write(data);
    req.end();
  });
}

(async () => {
  const tests = [
    { userId: 'smoke1', message: 'What is 2+2?' },
    { userId: 'smoke2', message: 'Explain photosynthesis in two sentences.' },
    { userId: 'smoke3', message: 'Write a short JavaScript function to add two numbers.' },
  ];

  for (const t of tests) {
    try {
      console.log('--- REQUEST ---', JSON.stringify(t));
      const r = await post(t);
      console.log('STATUS', r.statusCode);
      console.log('BODY', r.body);
    } catch (e) {
      console.error('ERROR', e && e.stack ? e.stack : e);
    }
  }
})();
