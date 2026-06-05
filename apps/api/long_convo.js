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
  const userId = 'stress-user';
  const conversationId = 'stress-1';
  const base = 'Explain quick sort to me at increasing depth, step';

  console.log('Starting 20-turn stress test...');
  for (let i = 1; i <= 20; i++) {
    const message = `${base} ${i}. Keep each reply concise and then ask a follow-up question.`;
    const start = Date.now();
    try {
      const r = await post({ userId, conversationId, message });
      const took = Date.now() - start;
      console.log(`TURN ${i} - status=${r.statusCode} time=${took}ms`);
      try {
        const j = JSON.parse(r.body);
        // print a short excerpt of formatted text if present
        const excerpt = (j.formatted && j.formatted.text) ? j.formatted.text.slice(0, 300).replace(/\n/g, ' ') : (j.text || '').slice(0, 300).replace(/\n/g, ' ');
        console.log('  excerpt:', excerpt);
      } catch (e) {
        console.log('  raw body:', r.body.slice(0, 400));
      }

      // small pause between turns
      await new Promise(res => setTimeout(res, 150));
    } catch (e) {
      console.error('TURN', i, 'ERROR', e && e.stack ? e.stack : e);
      break;
    }
  }
  console.log('Stress test complete.');
})();
