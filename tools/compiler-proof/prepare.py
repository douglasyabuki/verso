"""Prepare the pinned, local-only browser compilation demonstration.

Run from the repository root through the Node launcher:
node tools/compiler-proof/prepare.mjs [--assets-only] [--if-needed]
Only this preparation step downloads third-party resources. Runtime compilation
does not resolve packages or fonts over the network. `npm run build` runs it with
--assets-only --if-needed so hosted builds (for example Vercel) generate the
gitignored public/compiler/ directory.
"""

import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import sys
import tarfile
import time
import urllib.request
import zipfile

try:
    import lzma  # noqa: F401  Required by tarfile for the locked .tar.xz archives.
except ImportError:
    sys.exit('Python was built without lzma support, which the compiler archives (.tar.xz) need. '
             'Install a Python 3 build with lzma (xz) support and retry.')

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
DEST = ROOT / '.cache/compiler-proof/assets'
CACHE = Path(os.environ.get('VERSO_COMPILER_CACHE') or ROOT / '.cache/compiler-proof/downloads')
PUBLIC = ROOT / 'public/compiler'
SOURCE_URL = 'https://github.com/douglasyabuki/verso'
SOURCE_NOTICE = f'''Verso browser PDF compiler assets

The SwiftLaTeX engine is licensed under AGPL-3.0 (see license-SwiftLaTeX-AGPL-3.0.txt).
swiftlatexxetex.js is modified to resolve TeX resources from a preloaded bundle instead
of the network. The corresponding source, the exact modification, the locked inputs,
and the script that reproduces every file here are available at:

{SOURCE_URL}
(tools/compiler-proof/prepare.py and tools/compiler-proof/resources.lock.json)
'''
TEMPLATE = {'id': 'yabuki-reference', 'version': '1.0.3'}


def digest(data):
    """Return the SHA-256 digest of binary asset data."""
    return hashlib.sha256(data).hexdigest()


def download(asset, attempts=3):
    """Fetch a locked archive once, retrying transient failures, and refuse bytes with a different digest."""
    path = CACHE / asset['name']
    if not path.exists():
        for attempt in range(1, attempts + 1):
            try:
                print('Downloading', asset['name'], flush=True)
                request = urllib.request.Request(asset['url'], headers={'User-Agent': 'Verso-compiler-proof/1'})
                data = urllib.request.urlopen(request, timeout=90).read()
                break
            except OSError as error:
                if attempt == attempts:
                    raise RuntimeError(f"Could not download {asset['name']} from {asset['url']}: {error}") from error
                time.sleep(2 ** attempt)
        if digest(data) != asset['sha256']:
            raise ValueError(f"Integrity mismatch for downloaded {asset['name']}; the upstream file changed")
        partial = path.with_name(path.name + '.part')
        partial.write_bytes(data)
        partial.replace(path)
    data = path.read_bytes()
    if digest(data) != asset['sha256']:
        raise ValueError(f"Integrity mismatch for {asset['name']}; remove {path} and retry")
    return data


def localize_worker(data):
    """Replace upstream package HTTP resolution with a preloaded MEMFS lookup."""
    text = data.decode('utf8')
    start = text.index('function kpse_find_file_impl(')
    end = text.index('var moduleOverrides=', start)
    text = text[:start] + '''function kpse_find_file_impl(nameptr,format,_mustexist){
const name=UTF8ToString(nameptr);
if(!name || name.includes("/") || name.includes("\\\\")) return 0;
const path="/tex/"+name;
if(!FS.analyzePath(path).exists){
  if(!self.missingResources)self.missingResources={};
  self.missingResources[name]=format;
  return 0;
}
return allocate(intArrayFromString(path),ALLOC_NORMAL);
}
''' + text[end:]
    text = text.replace('https://texlive2.swiftlatex.com/', '/disabled-package-endpoint/')
    # These documents have no bibliography. Upstream runs BibTeX unconditionally.
    text = text.replace('_compileBibtex();', '')
    text += '''
const upstreamMessage=self.onmessage;
self.onmessage=function(event){
  if(event.data.cmd==="bundle"){
    for(const [name,data] of event.data.files){FS.writeFile("/tex/"+name,new Uint8Array(data));}
    self.postMessage({cmd:"bundle",result:"ok"});
  }else{upstreamMessage(event);}
};
'''
    if 'new XMLHttpRequest' in text[:text.index('var moduleOverrides=')]:
        raise ValueError('Package networking was not fully removed')
    return text.encode('utf8')


def verify_directory(directory):
    """Return the manifest when a prepared directory matches it and the current inputs; raise otherwise."""
    manifest = json.loads((directory / 'manifest.json').read_text(encoding='utf8'))
    if manifest['id'] != TEMPLATE['id'] or manifest['version'] != TEMPLATE['version']:
        raise ValueError('Unsupported existing template manifest; run full preparation')
    for name, expected in manifest['assets'].items():
        if Path(name).name != name or '/' in name or "\\" in name or name in ['.', '..', 'manifest.json']:
            raise ValueError('Invalid compiler asset path')
        data = (directory / name).read_bytes()
        if len(data) != expected['bytes'] or digest(data) != expected['sha256']:
            raise ValueError('Compiler asset integrity mismatch: ' + name)
    bundle = (directory / 'resources.bundle').read_bytes()
    if len(bundle) != manifest['bundleBytes'] or digest(bundle) != manifest['bundleSha256']:
        raise ValueError('Compiler bundle integrity mismatch; run full preparation')
    if (directory / 'compiler.mjs').read_bytes() != (HERE / 'compiler.mjs').read_bytes():
        raise ValueError('Compiler source changed; run full preparation')
    if (directory / 'resources.lock.json').read_bytes() != (HERE / 'resources.lock.json').read_bytes():
        raise ValueError('Compiler resources changed; run full preparation')
    return manifest


def current_public_assets():
    """Report, without writing, whether public/compiler matches the current sources."""
    try:
        verify_directory(PUBLIC)
        worker = ROOT / 'node_modules/pdfjs-dist/build/pdf.worker.mjs'
        if (PUBLIC / 'pdf.worker.mjs').read_bytes() != worker.read_bytes():
            raise ValueError('pdf.js worker changed')
        if (PUBLIC / 'SOURCE.txt').read_text(encoding='utf8') != SOURCE_NOTICE:
            raise ValueError('source notice changed')
        for license_file in (HERE / 'licenses').iterdir():
            if (PUBLIC / ('license-' + license_file.name)).read_bytes() != license_file.read_bytes():
                raise ValueError('license changed: ' + license_file.name)
    except (OSError, ValueError, KeyError) as error:
        print('Compiler assets need preparation:', error, flush=True)
        return False
    return True


def publish(source):
    """Replace public/compiler with a fully written copy so failures never leave a partial directory."""
    staging = PUBLIC.with_name('compiler.tmp')
    previous = PUBLIC.with_name('compiler.old')
    for directory in (staging, previous):
        if directory.exists():
            shutil.rmtree(directory)
    shutil.copytree(source, staging)
    if PUBLIC.exists():
        PUBLIC.replace(previous)
    staging.replace(PUBLIC)
    if previous.exists():
        shutil.rmtree(previous)


def refresh_manifests():
    """Verify existing payloads before refreshing only template identity metadata."""
    directories = [DEST, PUBLIC]
    manifests = []
    for directory in directories:
        manifest = verify_directory(directory)
        resources = json.loads(gzip.decompress((directory / 'resources.bundle').read_bytes()))
        if len(resources) != manifest['resourceCount'] or sum(len(base64.b64decode(data)) for _, data in resources) != manifest['uncompressedResourceBytes']:
            raise ValueError('Compiler resource metadata mismatch; run full preparation')
        manifests.append(manifest)
    if manifests[0]['assets'] != manifests[1]['assets'] or manifests[0]['bundleSha256'] != manifests[1]['bundleSha256']:
        raise ValueError('Prepared and public compiler assets differ; run full preparation')
    # Validate both locations before writing either manifest. Payloads remain untouched.
    for directory, manifest in zip(directories, manifests):
        manifest.update(TEMPLATE)
        (directory / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf8')
    print('Updated template manifests only: ' + TEMPLATE['version'])
    print('Unchanged bundle SHA-256: ' + manifests[0]['bundleSha256'])


def main(assets_only=False):
    """Build the complete bundle and, unless assets_only, extract the supplied reference inputs."""
    if DEST.exists():
        shutil.rmtree(DEST)
    DEST.mkdir(parents=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    print('Python', sys.version.split()[0], '- download cache:', CACHE, flush=True)
    lock = json.loads((HERE / 'resources.lock.json').read_text(encoding='utf8'))
    with ThreadPoolExecutor(max_workers=6) as pool:
        names = [asset['name'] for asset in lock['archives']]
        archives = dict(zip(names, pool.map(download, lock['archives'])))
    contents = {}
    for name, data in archives.items():
        wanted = [resource for resource in lock['resources'] if resource['archive'] == name]
        if not wanted:
            continue
        if name.endswith('.zip'):
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                for resource in wanted:
                    contents[resource['name']] = archive.read(resource['member'])
        else:
            with tarfile.open(fileobj=io.BytesIO(data)) as archive:
                for resource in wanted:
                    contents[resource['name']] = archive.extractfile(resource['member']).read()
    resources = []
    for resource in lock['resources']:
        data = contents[resource['name']]
        if digest(data) != resource['sha256']:
            raise ValueError('Resource integrity mismatch: ' + resource['name'])
        resources.append([resource['name'], base64.b64encode(data).decode('ascii')])
    format_data = gzip.decompress((HERE / 'format.fmt.gz').read_bytes())
    if digest(format_data) != lock['format']['sha256']:
        raise ValueError('Generated format integrity mismatch')
    resources.append(['swiftlatexxetex.fmt', base64.b64encode(format_data).decode('ascii')])
    bundle = gzip.compress(json.dumps(resources, separators=(',', ':')).encode('utf8'), mtime=0)
    (DEST / 'resources.bundle').write_bytes(bundle)
    with zipfile.ZipFile(io.BytesIO(archives[lock['engine']['archive']])) as archive:
        for name in lock['engine']['files']:
            data = archive.read(name)
            if name.endswith('.js'):
                data = localize_worker(data)
            (DEST / name).write_bytes(data)
    (DEST / 'compiler.mjs').write_bytes((HERE / 'compiler.mjs').read_bytes())
    (DEST / 'resources.lock.json').write_bytes((HERE / 'resources.lock.json').read_bytes())
    (DEST / 'pdf.worker.mjs').write_bytes((ROOT / 'node_modules/pdfjs-dist/build/pdf.worker.mjs').read_bytes())
    for license_file in (HERE / 'licenses').iterdir():
        (DEST / ('license-' + license_file.name)).write_bytes(license_file.read_bytes())
    (DEST / 'SOURCE.txt').write_text(SOURCE_NOTICE, encoding='utf8')
    manifest = {
        **TEMPLATE,
        'engine': lock['engine']['version'],
        'bundleBytes': len(bundle),
        'bundleSha256': digest(bundle),
        'resourceCount': len(resources),
        'uncompressedResourceBytes': sum(len(base64.b64decode(data)) for _, data in resources),
        'assets': {
            file.name: {'bytes': file.stat().st_size, 'sha256': digest(file.read_bytes())}
            for file in sorted(DEST.iterdir()) if file.name != 'manifest.json'
        },
    }
    (DEST / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf8')
    publish(DEST)
    print('Prepared compiler assets: bundle SHA-256 ' + manifest['bundleSha256'], flush=True)
    if assets_only:
        return
    inputs = ROOT / '.cache/compiler-proof/inputs'
    inputs.mkdir(exist_ok=True)
    references = [('en-US', 'DOUGLAS_YABUKI_RESUME'), ('pt-BR', 'DOUGLAS_YABUKI_CV')]
    available = [(ROOT / 'temp' / (name + extension)).exists() for _, name in references for extension in ['.zip', '.pdf']]
    if not any(available):
        print('Reference inputs absent: workspace assets are ready; supply the Overleaf ZIP/PDF pairs to run the independent reference proof.')
        print(json.dumps(manifest, indent=2))
        return
    if not all(available):
        raise ValueError('The reference proof needs both English and Portuguese ZIP/PDF pairs under temp/. Workspace assets have been prepared.')
    for locale, name in references:
        with zipfile.ZipFile(ROOT / 'temp' / (name + '.zip')) as archive:
            files = [f for f in archive.infolist() if f.filename.endswith('.tex')]
            if len(files) != 1 or files[0].file_size > 1_000_000:
                raise ValueError('Expected one reference .tex file under 1 MB in ' + name)
            (inputs / (locale + '.tex')).write_bytes(archive.read(files[0]))
        (inputs / (locale + '.pdf')).write_bytes((ROOT / 'temp' / (name + '.pdf')).read_bytes())
    print(json.dumps(manifest, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest-only', action='store_true', help='Verify existing payloads and update template identity without rebuilding assets')
    parser.add_argument('--assets-only', action='store_true', help='Prepare public/compiler only; skip the reference-proof inputs')
    parser.add_argument('--if-needed', action='store_true', help='Skip preparation when public/compiler already matches the current sources')
    args = parser.parse_args()
    if args.manifest_only:
        refresh_manifests()
    elif args.if_needed and current_public_assets():
        print('Compiler assets verified; skipping preparation.')
    else:
        main(assets_only=args.assets_only)
