const fs = require('fs');
const path = require('path');

(async function(){
  try {
    const envPath = path.resolve(__dirname, '..', '.env');
    let apiKey = process.env.GEMINI_API_KEY || '';
    if (fs.existsSync(envPath)) {
      const env = fs.readFileSync(envPath, 'utf8');
      const m = env.match(/GEMINI_API_KEY=(.*)/);
      if (m && m[1]) apiKey = apiKey || m[1].trim();
    }

    if (!apiKey) {
      console.error('No GEMINI_API_KEY found in .env or environment.');
      process.exit(1);
    }

    const bases = [
      'https://generativelanguage.googleapis.com/v1',
      'https://generativelanguage.googleapis.com/v1beta2',
      'https://us-generative.googleapis.com/v1'
    ];

    const models = [
      'gemini-1.5-pro',
      'gemini-1.5-pro-latest',
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'models/gemini-1.5-pro',
      'models/gemini-1.5-flash'
    ];

    // Use global fetch if available (Node18+). If not, exit with message.
    if (typeof fetch !== 'function') {
      console.error('Global fetch is not available in this Node runtime. Node 18+ is required.');
      process.exit(1);
    }

    for (const base of bases) {
      for (const model of models) {
        const url = `${base}/models/${encodeURIComponent(model)}:generateText?key=${encodeURIComponent(apiKey)}`;
        const body = JSON.stringify({ prompt: { text: `Availability check for ${model} at ${base}` }, temperature: 0.0, maxOutputTokens: 1 });
        console.log('---- Testing', model, '@', base, '----');
        try {
          const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, timeout: 30000 });
          const status = res.status;
          const text = await res.text();
          console.log('STATUS:', status);
          const out = text.length > 800 ? text.slice(0,800) + '\n...[truncated]' : text;
          console.log(out);
        } catch (err) {
          console.log('FETCH ERROR:', err && err.message ? err.message : String(err));
        }
        await new Promise(r => setTimeout(r, 200));
      }
    }

  } catch (err) {
    console.error('Script error:', err && err.message ? err.message : String(err));
    process.exit(1);
  }
})();
