"""Safely extract only the user-supplied boss archive and its nested source ZIP."""
from pathlib import Path
import zipfile,json
root=Path(__file__).resolve().parent.parent;out=root/'.local-tools/model-sources/spaceship-boss'
def expand(source,target):
 target.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(source) as z:
  if len(z.infolist())>10000 or sum(i.file_size for i in z.infolist())>1024**3:raise ValueError('Archive budget')
  for entry in z.infolist():
   p=(target/entry.filename).resolve()
   if not p.is_relative_to(target.resolve()) or (entry.external_attr>>16)&0xF000==0xA000:raise ValueError('Unsafe archive path/link')
   if entry.file_size>500*1024**2:raise ValueError('Entry budget')
   if entry.is_dir():p.mkdir(parents=True,exist_ok=True);continue
   p.parent.mkdir(parents=True,exist_ok=True)
   if not p.exists():p.write_bytes(z.read(entry))
expand(root/'assets-source/spaceship boss.zip',out)
expand(out/'source/SpaceShip.zip',out/'source/expanded')
print(json.dumps([{'file':str(p.relative_to(out)),'bytes':p.stat().st_size} for p in out.rglob('*') if p.is_file()]))
