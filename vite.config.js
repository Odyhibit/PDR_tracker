import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import os from 'node:os'
import forge from 'node-forge'

// The self-signed dev cert needs the machine's actual LAN IPs as *IP Address*
// SAN entries (not DNS entries — browsers only accept IP-typed SANs when
// connecting to an IP literal), or a phone hitting the Network URL fails the
// TLS handshake before Safari even shows the "not private" warning.
function devHttpsCert() {
  const lanIps = Object.values(os.networkInterfaces())
    .flat()
    .filter(i => i && i.family === 'IPv4' && !i.internal)
    .map(i => i.address)

  const keys = forge.pki.rsa.generateKeyPair(2048)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = '01'
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1)

  const attrs = [{ name: 'commonName', value: 'localhost' }]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.setExtensions([
    // No basicConstraints here on purpose — this is a leaf/server cert, not a
    // CA. Marking it CA:true is invalid for TLS server auth and iOS Safari's
    // stricter TLS stack will hard-close the connection over it instead of
    // showing the usual "untrusted certificate" warning.
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
    { name: 'extKeyUsage', serverAuth: true },
    {
      name: 'subjectAltName',
      altNames: [
        { type: 2, value: 'localhost' },      // DNS
        { type: 7, ip: '127.0.0.1' },         // IP
        { type: 7, ip: '::1' },               // IP
        ...lanIps.map(ip => ({ type: 7, ip })),
      ],
    },
  ])
  cert.sign(keys.privateKey, forge.md.sha256.create())

  return {
    cert: forge.pki.certificateToPem(cert),
    key: forge.pki.privateKeyToPem(keys.privateKey),
  }
}

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: '/PDR_tracker/',
  server: {
    host: true,
    // Camera access (getUserMedia) requires a secure context on a phone
    // hitting the dev server over LAN — dev-only, not used for `vite build`.
    https: command === 'serve' ? devHttpsCert() : undefined,
  },
}))
