"""Publish participant ZIPs from the checked-in current participant sources."""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(__file__).with_name('participant_packages')
NAMES = {'classification': 'wujie-classification-dev.zip',
         'world': 'wujie-world-starter.zip', 'arm': 'wujie-arm-starter.zip'}
REMOVED = {'pack.py', 'pack_agent.py', 'prepare_classification_submission.py',
           'build_classification_package.py', 'upload_classification_weights.py',
           'check_classification_submission.py',
           'run.sh', 'run.ps1', 'submission-files.json'}


def build(output=None):
    output = Path(output or ROOT / 'public/downloads')
    output.mkdir(parents=True, exist_ok=True)
    archives = []
    for kind, filename in NAMES.items():
        directory = SOURCE / kind
        entries = {}
        for path in sorted(directory.rglob('*')):
            if not path.is_file() or '__pycache__' in path.parts or path.suffix == '.pyc':
                continue
            if path.suffix.lower() in {'.md', '.markdown'} or path.name in REMOVED:
                raise ValueError(f'Participant archive contains a removed file: {path}')
            if path.name != 'code-manifest.json':
                entries[path.relative_to(directory).as_posix()] = path.read_bytes()
        entry = 'inference.py' if kind == 'classification' else 'agent.py'
        if not {entry, 'config.json'} <= entries.keys():
            raise ValueError(f'Missing {kind} entry point/configuration')
        manifest = {name: hashlib.sha256(content).hexdigest() for name, content in entries.items()}
        entries['code-manifest.json'] = json.dumps(manifest, indent=2).encode('utf-8')
        archive_path = output / filename
        with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as archive:
            for name, content in sorted(entries.items()):
                info = zipfile.ZipInfo(name, date_time=(2026, 10, 19, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                archive.writestr(info, content)
        if kind == 'classification':
            shutil.copyfile(archive_path, output / 'wujie-classification-starter.zip')
        archives.append(archive_path)
    return archives


if __name__ == '__main__':
    for path in build():
        print(path)
