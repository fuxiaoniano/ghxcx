const readline = require('readline');

async function readInput() {
  const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    lines.close();
    return JSON.parse(line);
  }
  throw new Error('Missing login input');
}

async function main() {
  const login = await readInput();
  const loginResponse = await fetch('http://127.0.0.1:3000/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(login),
  });
  const loginPayload = await loginResponse.json();
  const token = loginPayload?.data?.token || loginPayload?.token;
  if (!token) throw new Error(loginPayload?.message || 'Admin login failed');
  const date = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const syncResponse = await fetch('http://127.0.0.1:3000/api/admin/operations/daily/sync', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ statDate: date, provider: 'TENCENT_ADS' }),
  });
  const syncPayload = await syncResponse.json();
  const result = syncPayload?.data || syncPayload;
  process.stdout.write(JSON.stringify({ date, httpStatus: syncResponse.status, result }));
}

main().catch((error) => {
  process.stderr.write(JSON.stringify({ error: error instanceof Error ? error.message : 'unknown error' }));
  process.exitCode = 1;
});
