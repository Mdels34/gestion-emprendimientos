from pathlib import Path
import json,zipfile,shutil
root=Path(__file__).parent
html=(root/'ui.html').read_text().replace('/*__MODEL__*/',(root/'model.js').read_text()).replace('/*__APP__*/',(root/'app.js').read_text())
(root/'site/dist').mkdir(parents=True,exist_ok=True)
(root/'site/dist/index.html').write_text(html)
(root/'demo.html').write_text(html)
out=root/'entrega'
out.mkdir(exist_ok=True)
(out/'Gestion_Emprendimientos_Demo.html').write_text(html)
gas=out/'Google_Apps_Script'
gas.mkdir(exist_ok=True)
(gas/'Index.html').write_text(html)
(gas/'Code.gs').write_text((root/'model.js').read_text()+'\n'+(root/'backend.gs').read_text())
(gas/'appsscript.json').write_text(json.dumps({'timeZone':'America/Montevideo','dependencies':{},'exceptionLogging':'STACKDRIVER','runtimeVersion':'V8','oauthScopes':['https://www.googleapis.com/auth/spreadsheets','https://www.googleapis.com/auth/userinfo.email']},ensure_ascii=False,indent=2))
if (root/'LEEME.md').exists():shutil.copy(root/'LEEME.md',out/'LEEME.md')
with zipfile.ZipFile(out/'Gestion_Emprendimientos_Demo_Paquete.zip','w',zipfile.ZIP_DEFLATED) as z:
 for f in sorted(out.rglob('*')):
  if f.is_file() and f.suffix!='.zip':z.write(f,f.relative_to(out))
project_files=['README.md','CONTINUIDAD.md','AGENTS.md','.gitignore','LEEME.md','model.js','app.js','ui.html','backend.gs','build.py','demo.html','qa/checks.js','docs/PRESENTACION.md','docs/ARQUITECTURA.md','docs/PLANTILLA_DRIVE.md','docs/INSTALACION_GOOGLE.md','tools/build_template.mjs','qa/evidencia-sheets-20261120.json']
project_files+=['qa/sheets-mock.js','qa/fixtures.js','qa/benchmark.js','qa/benchmark-fase1.json','docs/ALCANCE.md','docs/FASE_1.md']
with zipfile.ZipFile(out/'Gestion_Emprendimientos_Proyecto_GitHub.zip','w',zipfile.ZIP_DEFLATED) as z:
 for relative in project_files:
  if (root/relative).is_file():z.write(root/relative,relative)
 for f in sorted(gas.iterdir()):
  if f.is_file():z.write(f,'Google_Apps_Script/'+f.name)
print(json.dumps({'html':str(out/'Gestion_Emprendimientos_Demo.html'),'zip':str(out/'Gestion_Emprendimientos_Demo_Paquete.zip'),'project_zip':str(out/'Gestion_Emprendimientos_Proyecto_GitHub.zip'),'html_bytes':len(html.encode())}))
