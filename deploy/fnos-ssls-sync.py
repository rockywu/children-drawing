#!/usr/bin/env python3
"""Pull the authorized wildcard certificate and safely reload the native Nginx."""

import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import ssl
import subprocess
import sys
import tempfile
import time
from urllib.parse import urlencode

CONFIG = Path('/etc/fnos-ssls-sync')
ROOT = Path('/etc/nginx/ssl/wildcard.wujialei.com')
STATE = CONFIG / 'applied.json'
BACKOFF = CONFIG / 'retry-after'


def run(args, data=None):
    result = subprocess.run(args, input=data, capture_output=True)
    if result.returncode:
        raise RuntimeError(f'{Path(args[0]).name} validation or reload failed')
    return result.stdout


def request(config, endpoint):
    result = subprocess.run([
        'curl', '--fail', '--silent', '--show-error', '--proto', '=https',
        '--connect-timeout', '10', '--max-time', '45',
        '--resolve', config['resolve'], '--header', f'@{CONFIG}/auth.header',
        '--write-out', '\n%{http_code}', config['service_url'] + endpoint,
    ], capture_output=True)
    body, _, status = result.stdout.rpartition(b'\n')
    if result.returncode or status != b'200':
        if status == b'429':
            BACKOFF.write_text(str(time.time() + 300))
        code = status.decode('ascii', errors='replace')
        raise RuntimeError(f'certificate source HTTP {code}; old certificate retained')
    try:
        return json.loads(body)
    except (ValueError, UnicodeError):
        raise RuntimeError('invalid certificate source response') from None


def fingerprint(cert):
    return hashlib.sha256(run([
        'openssl', 'x509', '-in', str(cert), '-outform', 'DER',
    ])).hexdigest()


def served_fingerprint(config):
    context = ssl.create_default_context()
    with socket.create_connection(('127.0.0.1', config['site_port']), timeout=5) as connection:
        with context.wrap_socket(connection, server_hostname=config['site_host']) as tls:
            return hashlib.sha256(tls.getpeercert(binary_form=True)).hexdigest()


def switch_link(target):
    current = ROOT / 'current'
    if target is None:
        current.unlink(missing_ok=True)
        return
    temporary = ROOT / f'.current-{os.getpid()}'
    temporary.unlink(missing_ok=True)
    temporary.symlink_to(target)
    os.replace(temporary, current)


def validate(directory, host, expected):
    certificate = directory / 'fullchain.pem'
    key = directory / 'privkey.pem'
    leaf = directory / 'leaf.pem'
    run(['openssl', 'x509', '-in', str(certificate), '-out', str(leaf)])
    run(['openssl', 'verify', '-purpose', 'sslserver', '-CApath', '/etc/ssl/certs',
         '-untrusted', str(certificate), str(leaf)])
    run(['openssl', 'x509', '-in', str(certificate), '-checkhost', host, '-noout'])
    public_cert = run(['openssl', 'x509', '-in', str(certificate), '-pubkey', '-noout'])
    public_key = run(['openssl', 'pkey', '-in', str(key), '-pubout'])
    if public_cert != public_key or fingerprint(certificate) != expected:
        raise RuntimeError('certificate fingerprint or private key mismatch')
    leaf.unlink()


def sync(config):
    if BACKOFF.exists() and time.time() < float(BACKOFF.read_text()):
        return
    certificates = request(config, '/v1/certificates')['certificates']
    entry = next((item for item in certificates if item.get('name') == config['certificate']), None)
    if not entry or entry.get('available') is not True:
        raise RuntimeError('authorized certificate is unavailable; old certificate retained')
    version = str(entry['version'])
    expected = entry['fingerprint'].replace(':', '').lower()
    current = ROOT / 'current'
    try:
        state = json.loads(STATE.read_text())
    except (FileNotFoundError, ValueError):
        state = {}
    if state.get('version') == version and state.get('fingerprint') == expected:
        try:
            if fingerprint(current / 'fullchain.pem') == expected and served_fingerprint(config) == expected:
                return
        except (OSError, RuntimeError):
            pass

    bundle = request(config, '/v1/certificates/bundle?' + urlencode({'name': config['certificate']}))
    if (bundle.get('name') != config['certificate'] or str(bundle.get('version')) != version
            or bundle.get('fingerprint', '').replace(':', '').lower() != expected):
        raise RuntimeError('certificate version changed during download; retry next run')
    versions = ROOT / 'versions'
    versions.mkdir(parents=True, exist_ok=True, mode=0o700)
    directory = Path(tempfile.mkdtemp(prefix=hashlib.sha256(version.encode()).hexdigest()[:12] + '-', dir=versions))
    previous = os.readlink(current) if current.is_symlink() else None
    switched = False
    try:
        (directory / 'fullchain.pem').write_text(bundle['fullchain_pem'])
        (directory / 'privkey.pem').write_text(bundle['private_key_pem'])
        os.chmod(directory / 'fullchain.pem', 0o644)
        os.chmod(directory / 'privkey.pem', 0o600)
        validate(directory, config['site_host'], expected)
        switch_link(str(directory.relative_to(ROOT)))
        switched = True
        run(['/usr/sbin/nginx', '-t'])
        run(['/usr/bin/systemctl', 'reload', 'nginx'])
        for attempt in range(10):
            try:
                if served_fingerprint(config) == expected:
                    break
            except OSError:
                pass
            if attempt == 9:
                raise RuntimeError('live TLS certificate did not match the new certificate')
            time.sleep(0.2)
        applied = STATE.with_suffix('.tmp')
        applied.write_text(json.dumps({'version': version, 'fingerprint': expected,
                                       'applied_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}) + '\n')
        os.replace(applied, STATE)
        BACKOFF.unlink(missing_ok=True)
        print(time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'certificate applied', version)
    except Exception:
        if switched:
            switch_link(previous)
            try:
                run(['/usr/sbin/nginx', '-t'])
                run(['/usr/bin/systemctl', 'reload', 'nginx'])
            except RuntimeError:
                print('rollback needs attention; current Nginx process was not stopped', file=sys.stderr)
        shutil.rmtree(directory)
        raise


def main():
    os.umask(0o077)
    with open('/run/lock/fnos-ssls-sync.lock', 'a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        sync(json.loads((CONFIG / 'config.json').read_text()))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Responses contain private key material; never print response bodies or tracebacks.
        message = str(error) if isinstance(error, RuntimeError) else type(error).__name__
        print(time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'sync failed:', message, file=sys.stderr)
        sys.exit(1)
