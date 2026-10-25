import assert from 'node:assert/strict';
import { createSecureServer, connect as connectHttp2 } from 'node:http2';
import { request } from 'node:https';
import { connect as connectTls } from 'node:tls';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const directory = await mkdtemp(join(tmpdir(), 'web-tls-'));
let server;
try {
  // 인증서와 키는 임시 폴더에만 만들고 실험 종료 시 삭제합니다.
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-sha256',
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost',
      '-keyout',
      join(directory, 'key.pem'),
      '-out',
      join(directory, 'cert.pem'),
    ],
    { stdio: 'ignore' },
  );
  const [key, cert] = await Promise.all([
    readFile(join(directory, 'key.pem')),
    readFile(join(directory, 'cert.pem')),
  ]);
  server = createSecureServer(
    {
      key,
      cert,
      allowHTTP1: true,
      minVersion: 'TLSv1.3',
      maxVersion: 'TLSv1.3',
    },
    (_req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('product:42');
    },
  );
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;

  const client = connectHttp2(`https://127.0.0.1:${port}`, {
    ca: cert,
    servername: 'localhost',
  });
  try {
    await once(client, 'connect');
    assert.equal(client.socket.getProtocol(), 'TLSv1.3');
    assert.equal(client.alpnProtocol, 'h2');
    assert.equal(client.socket.authorized, true);
    const stream = client.request({
      ':path': '/products/42',
      ':authority': 'localhost',
    });
    let body = '';
    let status;
    stream.setEncoding('utf8');
    stream.on('response', (headers) => {
      status = headers[':status'];
    });
    stream.on('data', (chunk) => {
      body += chunk;
    });
    stream.end();
    await once(stream, 'end');
    assert.equal(status, 200);
    assert.equal(body, 'product:42');
    console.log(
      'PASS trusted certificate + hostname: TLSv1.3, ALPN h2, HTTP/2 200',
    );
  } finally {
    client.destroy();
  }

  await new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/products/42',
        ca: cert,
        servername: 'localhost',
        ALPNProtocols: ['http/1.1'],
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            assert.equal(res.httpVersion, '1.1');
            assert.equal(res.statusCode, 200);
            assert.equal(body, 'product:42');
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
  console.log('PASS same server with ALPN http/1.1: HTTP/1.1 200');

  async function rejectedConnection(options) {
    const socket = connectTls({ host: '127.0.0.1', port, ...options });
    try {
      await assert.rejects(once(socket, 'secureConnect'), (error) => {
        if (options.ca) return error.code === 'ERR_TLS_CERT_ALTNAME_INVALID';
        return error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT';
      });
    } finally {
      socket.destroy();
    }
  }
  await rejectedConnection({ ca: cert, servername: 'wrong.example.com' });
  console.log('PASS hostname mismatch: ERR_TLS_CERT_ALTNAME_INVALID');
  await rejectedConnection({ servername: 'localhost' });
  console.log('PASS untrusted certificate: DEPTH_ZERO_SELF_SIGNED_CERT');
} finally {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
