import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('cert_sync', Path(__file__).with_name('fnos-ssls-sync.py'))
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


class CertificateSyncTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.root = root / 'certificates'
        self.root.mkdir()
        (self.root / 'old').mkdir()
        (self.root / 'old' / 'fullchain.pem').write_text('previous certificate')
        (self.root / 'current').symlink_to('old')
        self.state = root / 'applied.json'
        self.state.write_text(json.dumps({'version': 'old', 'fingerprint': 'old'}))
        self.config = {'certificate': '*.wujialei.com', 'site_host': 'drawing.wujialei.com', 'site_port': 8080}
        self.entry = {'name': '*.wujialei.com', 'available': True, 'version': 'new', 'fingerprint': 'ab' * 32}
        self.bundle = dict(self.entry, fullchain_pem='invalid certificate', private_key_pem='invalid key')
        for name, value in [('ROOT', self.root), ('STATE', self.state), ('BACKOFF', root / 'retry-after')]:
            manager = patch.object(sync, name, value)
            manager.start()
            self.addCleanup(manager.stop)

    def assert_previous(self):
        self.assertEqual(os.readlink(self.root / 'current'), 'old')
        self.assertEqual(json.loads(self.state.read_text())['version'], 'old')
        self.assertEqual((self.root / 'current' / 'fullchain.pem').read_text(), 'previous certificate')

    def test_source_failure_keeps_previous(self):
        with patch.object(sync, 'request', side_effect=RuntimeError('source unavailable')):
            with self.assertRaises(RuntimeError):
                sync.sync(self.config)
        self.assert_previous()

    def test_invalid_pem_keeps_previous(self):
        with patch.object(sync, 'request', side_effect=[{'certificates': [self.entry]}, self.bundle]):
            with self.assertRaises(RuntimeError):
                sync.sync(self.config)
        self.assert_previous()
        self.assertEqual(list((self.root / 'versions').iterdir()), [])

    def test_reload_failure_restores_link_and_retries(self):
        reloads = []

        def command(args, data=None):
            if args[0].endswith('systemctl'):
                reloads.append(args)
                if len(reloads) == 1:
                    raise RuntimeError('reload failed')
            return b''

        with patch.object(sync, 'request', side_effect=[{'certificates': [self.entry]}, self.bundle]), \
                patch.object(sync, 'validate'), patch.object(sync, 'run', side_effect=command):
            with self.assertRaises(RuntimeError):
                sync.sync(self.config)
        self.assert_previous()
        self.assertEqual(len(reloads), 2)

    def test_applied_unchanged_certificate_does_not_download_or_reload(self):
        self.state.write_text(json.dumps({'version': 'new', 'fingerprint': self.entry['fingerprint']}))
        with patch.object(sync, 'request', return_value={'certificates': [self.entry]}) as request, \
                patch.object(sync, 'fingerprint', return_value=self.entry['fingerprint']), \
                patch.object(sync, 'served_fingerprint', return_value=self.entry['fingerprint']), \
                patch.object(sync, 'run') as command:
            sync.sync(self.config)
        self.assertEqual(request.call_count, 1)
        command.assert_not_called()


if __name__ == '__main__':
    unittest.main()
