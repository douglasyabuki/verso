"""Prepare the pinned, local-only browser compilation demonstration.

Run from the repository root: python tools/compiler-proof/prepare.py
Only this preparation step downloads third-party resources. Runtime compilation
does not resolve packages or fonts over the network.
"""

import base64
import gzip
import hashlib
import io
import json
from pathlib import Path
import shutil
import tarfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
DEST = ROOT / '.cache/compiler-proof/assets'
CACHE = ROOT / '.cache/compiler-proof/downloads'


def digest(data):
    """Return the SHA-256 digest of binary asset data."""
    return hashlib.sha256(data).hexdigest()


def download(asset):
    """Fetch a locked archive once and refuse bytes with a different digest."""
    path = CACHE / asset['name']
    if not path.exists():
        print('Downloading', asset['name'], flush=True)
        request = urllib.request.Request(asset['url'], headers={'User-Agent': 'Verso-compiler-proof/1'})
        path.write_bytes(urllib.request.urlopen(request, timeout=90).read())
    data = path.read_bytes()
    if digest(data) != asset['sha256']:
        raise ValueError(f"Integrity mismatch for {asset['name']}; remove this cached download and retry")
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


def main():
    """Build the complete bundle and extract only the supplied reference inputs."""
    DEST.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    lock = json.loads((HERE / 'resources.lock.json').read_text(encoding='utf8'))
    archives = {asset['name']: download(asset) for asset in lock['archives']}
    contents = {}
    for name, data in archives.items():
        wanted = [resource for resource in lock['resources'] if resource['archive'] == name]
        if not wanted:
            continue
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
    manifest = {
        'id': 'yabuki-reference', 'version': '1.0.0-proof.2',
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
    public = ROOT / 'public/compiler'
    public.mkdir(exist_ok=True, parents=True)
    for file in DEST.iterdir():
        shutil.copyfile(file, public / file.name)
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
    main()
