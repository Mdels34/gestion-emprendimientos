"""Genera el dossier de producto a partir de la demo y sus capturas ficticias.

Requiere Python 3 y reportlab. No accede a servicios externos.
"""
from pathlib import Path
import argparse
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, Color
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=ROOT/'docs/Gestion_Emprendimientos_Presentacion_Fabian.pdf')
args = parser.parse_args()
args.output.parent.mkdir(parents=True, exist_ok=True)
fontroot=Path('/usr/share/fonts/truetype/dejavu')
for name,file in [('Body','DejaVuSans.ttf'),('Bold','DejaVuSans-Bold.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(fontroot/file)))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='Bold')
W,H=960,600
INK='#143E33'; LIME='#D5F58C'; BG='#F5F6F0'; GRAY='#53655E'; LINE='#DCE4DB'
c=canvas.Canvas(str(args.output),pagesize=(W,H),pageCompression=1)
c.setTitle('Gestión para emprendimientos | Presentación para Fabián')
c.setAuthor('Martín de los Santos')
c.setSubject('Producto demostrativo 0.4: inventario, clientes, pedidos, reparto y cobros')
c.setCreator('Dossier de producto - 22/11/2026')
page_no=0
layout=[]

def rect(x,y,w,h,fill,r=0,stroke=None):
    c.setFillColor(HexColor(fill))
    c.setStrokeColor(HexColor(stroke or fill))
    if r:c.roundRect(x,H-y-h,w,h,r,stroke=bool(stroke),fill=1)
    else:c.rect(x,H-y-h,w,h,stroke=bool(stroke),fill=1)

def text(s,x,y,size=14,color=INK,bold=False):
    c.setFillColor(HexColor(color));c.setFont('Bold' if bold else 'Body',size)
    c.drawString(x,H-y-size*.80,s)
    width=pdfmetrics.stringWidth(s,'Bold' if bold else 'Body',size)
    if x+width>W-24:raise ValueError(('text overflow',page_no,s,x+width))

def para(s,x,y,w,size=14,color=GRAY,bold=False,leading=None):
    style=ParagraphStyle('p',fontName='Bold' if bold else 'Body',fontSize=size,
                         leading=leading or size*1.38,textColor=HexColor(color),spaceAfter=0)
    p=Paragraph(s,style);pw,ph=p.wrap(w,H)
    p.drawOn(c,x,H-y-ph)
    layout.append((page_no,x,y,w,ph))
    if y+ph>H-38:raise ValueError(('paragraph overflow',page_no,s,y+ph))
    return ph

def tag(s,x,y,fill=LIME,color=INK):
    tw=pdfmetrics.stringWidth(s,'Bold',10)+24
    rect(x,y,tw,26,fill,13);text(s,x+12,y+8,10,color,True)
    return tw

def start(section,title=None,subtitle=None,dark=False):
    global page_no
    page_no+=1
    rect(0,0,W,H,INK if dark else BG)
    fg='#FFFFFF' if dark else INK
    text('GESTIÓN PARA EMPRENDIMIENTOS',42,27,10,fg,True)
    c.setFillColor(HexColor(LIME if dark else INK));c.circle(25,H-32,4,stroke=0,fill=1)
    text(section.upper(),650,27,10,LIME if dark else GRAY)
    if title:para(title,42,76,876,31,fg,True,37)
    if subtitle:para(subtitle,42,128,850,14,'#CEE0D6' if dark else GRAY)

def end(dark=False):
    color='#BCD0C3' if dark else GRAY
    text('Martín de los Santos  /  Para conversar con Fabián  /  22.11.2026',42,572,9,color)
    text(f'{page_no:02d} / 12',858,572,10,color,True)
    c.showPage()

def card(x,y,w,h,num,title,body,fill='#FFFFFF'):
    rect(x,y,w,h,fill,14)
    tag(num,x+18,y+18,INK,'#FFFFFF')
    para(title,x+18,y+61,w-36,18,INK,True,23)
    para(body,x+18,y+99,w-36,13,GRAY,False,18)

def picture(name,x,y,w,h,crop=None):
    im=Image.open(ROOT/'assets/capturas'/name)
    if crop:im=im.crop(crop)
    iw,ih=im.size;scale=min(w/iw,h/ih);dw,dh=iw*scale,ih*scale
    ix=x+(w-dw)/2;iy=y+(h-dh)/2
    rect(ix-5,iy-5,dw+10,dh+10,'#FFFFFF',12)
    c.drawImage(ImageReader(im),ix,H-iy-dh,width=dw,height=dh,mask='auto')
    return dh

def note(s,y=527,color=GRAY):para(s,42,y,876,11,color,leading=15)

# 01. Portada.
start('Presentación de producto',dark=True)
tag('DEMO FUNCIONAL 0.4',42,85)
para('Del stock<br/>a la entrega.',42,145,400,48,'#FFFFFF',True,53)
para('Un sistema para que un pequeño negocio vea qué tiene, qué debe preparar, quién retira y qué falta entregar o cobrar.',42,273,365,18,'#D6E3DC',leading=26)
picture('23-resumen-final.jpg',458,98,453,370)
text('Inventario · Clientes · Pedidos',42,429,13,LIME,True)
text('Repartos · Transporte · Cobros',42,454,13,LIME,True)
para('Propuesta de Martín de los Santos para desarrollar con Fabián.<br/>Nombre de trabajo y modelo comercial pendientes de definir.',42,503,850,12,'#C4D8CB')
end(True)

# 02. Cliente y necesidad.
start('01 / Oportunidad','Para negocios que venden y entregan productos.','Cliente propuesto: una unipersonal o emprendimiento que hoy coordina ventas, existencias y reparto en distintos lugares.')
card(42,185,280,236,'01','Tener visibilidad','Ver existencias reales, reservas y unidades que ya salieron a reparto.')
card(340,185,280,236,'02','Seguir cada pedido','Reunir cliente, productos, preparación, transporte y resultado de la entrega.')
card(638,185,280,236,'03','Controlar pendientes','Identificar pedidos por preparar, entregas con incidencia y saldos por cobrar.')
rect(42,444,876,67,INK,12)
para('Valor propuesto: una sola vista operativa para decidir y trabajar cada día.',64,464,830,18,'#FFFFFF',True)
note('Hipótesis de producto. La selección del primer negocio y la validación de demanda están pendientes.')
end()

# 03. Módulos.
start('02 / Producto','Seis vistas para una misma operación.','La aplicación reúne el recorrido comercial y logístico sin perder el vínculo entre cada registro.')
mods=[('01','Resumen','Disponible, pedidos en proceso, reparto y saldo por cobrar.'),
      ('02','Inventario','Productos, precios, ingresos, ajustes, reservas y stock mínimo.'),
      ('03','Clientes','Contactos, direcciones e historial. Alta dentro del pedido.'),
      ('04','Pedidos','Varias líneas, importes, preparación, estados y cobros.'),
      ('05','Repartos','Asignación de transporte, despacho, entrega, incidencia y retorno.'),
      ('06','Reportes','Entregas, stock y cobros. Descarga CSV y copia JSON.')]
for i,(n,t,b) in enumerate(mods):
    x=42+(i%3)*298;y=178+(i//3)*174
    rect(x,y,280,155,'#FFFFFF',12);tag(n,x+17,y+15)
    para(t,x+17,y+54,246,18,INK,True)
    para(b,x+17,y+86,246,12.5,GRAY,leading=18)
note('Los reportes describen actividad operativa. No calculan rentabilidad ni reemplazan la contabilidad.')
end()

# 04. Flujo.
start('03 / Recorrido','Un pedido pasa por pasos visibles.','Cada cambio de estado tiene un efecto concreto sobre la mercadería y queda registrado.')
steps=[('01','Pendiente','Reserva unidades disponibles.'),('02','En preparación','Conserva la reserva.'),
       ('03','Listo para repartir','Espera la salida física.'),('04','En reparto','Descuenta depósito y registra el retiro.'),
       ('05','Entregado','Confirma el resultado de la entrega.')]
for i,(n,t,b) in enumerate(steps):
    x=42+i*177
    rect(x,182,164,167,'#FFFFFF',12);tag(n,x+14,197)
    para(t,x+14,239,136,15,INK,True,20)
    para(b,x+14,288,136,11.5,GRAY,leading=16)
    if i<4:text('>',x+167,244,13,GRAY,True)
rect(42,374,430,128,INK,12)
para('La entrega y el cobro se registran por separado.',63,395,385,20,'#FFFFFF',True,26)
para('Un pedido puede estar entregado y todavía tener saldo pendiente.',63,454,385,13,'#D6E3DC')
rect(490,374,428,128,'#EAF0E4',12)
para('Si la entrega falla',511,395,385,18,INK,True)
para('La mercadería sigue fuera del depósito. Se puede reintentar o recibir el retorno físico con motivo.',511,432,385,14,GRAY)
note('La demo contempla entregas y retornos completos. Las devoluciones de pedidos ya entregados requieren desarrollo.')
end()

# 05. Stock.
start('04 / Inventario','Vender con stock disponible a la vista.','Ejemplo ficticio del tutorial: 20 termos en depósito y un pedido de 2 unidades.')
picture('07-stock-reservado.jpg',42,181,540,337,crop=(220,93,1335,640))
for y,val,title,body in [(184,'20','En depósito','Sigue igual al reservar.'),(294,'2','Reservadas','Comprometidas en el pedido.'),(404,'18','Disponibles','Libres para otros pedidos.')]:
    rect(610,y,308,96,'#FFFFFF',12)
    text(val,628,y+17,36,INK,True)
    para(title,712,y+16,184,15,INK,True)
    para(body,712,y+43,184,12,GRAY,leading=17)
note('Al despachar esas 2 unidades: depósito 18, reservas 0, disponible 18 y reparto 2. El reintento no descuenta nuevamente.')
end()

# 06. Clientes/pedidos.
start('05 / Clientes y pedidos','Registrar una venta sin perder el contexto.','Cliente, dirección, productos y entrega quedan asociados al mismo pedido.')
picture('05-cliente-y-pedido.jpg',42,181,485,339,crop=(360,40,1005,850))
items=[('Cliente desde el pedido','Elegir uno existente o darlo de alta en el mismo formulario.'),
       ('Varias líneas de producto','Agregar cantidades y consultar el importe del pedido en UYU.'),
       ('Validación de disponibilidad','El sistema rechaza cantidades que superan el stock libre.'),
       ('Seguimiento e historial','Consultar el estado, la actividad y los cobros asociados.')]
y=184
for title,body in items:
    text(title,561,y,16,INK,True);para(body,561,y+28,344,13,GRAY,leading=18);y+=86
note('Si un pedido nuevo falla por stock insuficiente, el alta conjunta no deja un cliente suelto ni un pedido incompleto.')
end()

# 07. Transporte.
start('06 / Transporte','Saber quién retiró cada pedido.','La asignación actual y la constancia del despacho se conservan por separado en el historial.')
picture('10-datos-transporte.jpg',555,180,363,345,crop=(350,100,1020,830))
fields=[('Empresa transportista','Quién realiza el reparto.'),('Matrícula del vehículo','Vehículo declarado al retirar.'),
        ('Conductor','Nombre completo de quien retira.'),('Documento','Tipo y número conservados como texto.')]
y=184
for i,(t,b) in enumerate(fields):
    tag(f'0{i+1}',42,y+2,INK,'#FFFFFF');text(t,98,y,17,INK,True)
    para(b,98,y+29,414,13,GRAY);y+=73
rect(42,490,470,38,'#EAF0E4',9)
para('Disponible al crear, asignar o despachar un pedido.',56,501,440,12,INK,True)
note('Son datos declarados de la demo. El registro no verifica identidad ni autenticidad documental.')
end()

# 08. Entrega y cobro.
start('07 / Entrega y cobros','Entregado y cobrado son dos controles distintos.','La salida de la mercadería, su recepción y el dinero registrado responden a eventos diferentes.')
picture('16-pedido-cobrado.jpg',42,181,440,340,crop=(362,48,1002,844))
rect(516,183,402,150,INK,12)
text('Pedido del ejemplo',538,204,13,'#CEE0D6',True)
text('2 termos × UYU 500',538,235,24,'#FFFFFF',True)
text('Total: UYU 1.000',538,280,21,LIME,True)
text('1. Confirmar entrega',516,357,18,INK,True)
para('Registra que el pedido llegó. El saldo permanece hasta anotar el cobro.',516,391,393,14,GRAY)
text('2. Registrar cobro',516,453,18,INK,True)
para('Anota el importe recibido y actualiza el saldo pendiente.',516,486,393,14,GRAY)
note('Registro manual de cobros. No procesa pagos. Los reintegros y la cancelación de pedidos con cobros siguen pendientes.')
end()

# 09. Reportes.
start('08 / Reportes','Cerrar el día sabiendo qué queda pendiente.','La información se consulta en pantalla y puede descargarse para revisión.')
picture('22-reportes.jpg',42,183,549,337,crop=(232,65,1345,780))
for y,title,body in [(184,'Operación','Entregas confirmadas, productos más entregados y situación del inventario.'),
                     (293,'Cobros','Importes entregados, cobros anotados y saldo pendiente.'),
                     (402,'Exportación','Pedidos en CSV y copia completa de los datos en JSON.')]:
    text(title,623,y,18,INK,True);para(body,623,y+35,282,14,GRAY,leading=20)
note('El JSON permite conservar una copia descargada. La restauración completa y el respaldo automático deben validarse en el piloto.')
end()

# 10. Modos.
start('09 / Funcionamiento','Dos formas de usar la misma interfaz.','La demo local sirve para explorar; la instalación de Google guarda los registros del negocio en su planilla.')
for x,title,body in [(42,'Demo autónoma','Un archivo HTML que se abre en un navegador. Las pruebas quedan en ese navegador; no se sincronizan solas entre dispositivos.'),
                     (490,'Instalación en Google','La aplicación web valida cada operación y la guarda en Google Sheets. El acceso requiere cuenta autorizada.')]:
    rect(x,183,428,173,'#FFFFFF',12);text(title,x+22,205,20,INK,True)
    para(body,x+22,246,384,15,GRAY,leading=22)
rect(42,380,876,121,INK,12)
para('Instalación privada probada el 20/11/2026',64,399,830,20,'#FFFFFF',True)
para('Lectura, escritura y persistencia al recargar verificadas con un producto ficticio. La prueba se retiró para dejar la plantilla vacía. El acceso actual documentado es solo del propietario.',64,437,830,14,'#D6E3DC',leading=21)
note('Cada negocio piloto requiere su propia planilla e instalación. Las hojas de consulta se actualizan desde la app.')
end()

# 11. Estado.
start('10 / Estado del producto','Base funcional para un primer negocio.','Corte de esta entrega: demo 0.4. Verificación de reglas repetida el 22/11/2026.')
rect(42,180,282,310,INK,12)
text('115',64,206,64,LIME,True)
para('comprobaciones automáticas aprobadas',64,287,238,20,'#FFFFFF',True,26)
para('Stock, reservas, pedidos, transporte, entregas, cobros y backend simulado de Sheets.',64,370,238,14,'#D6E3DC',leading=21)
text('Implementado',354,183,19,INK,True)
para('Seis vistas, flujo operativo, datos de transporte, reportes, exportación, interfaz adaptable y conector a Google Sheets.',354,222,550,15,GRAY,leading=22)
text('Por validar en un piloto',354,310,19,INK,True)
para('Uso diario, acceso de un segundo usuario, operación concurrente, rendimiento, respaldo y recuperación.',354,349,550,15,GRAY,leading=22)
text('Fuera del alcance actual',354,426,19,INK,True)
para('Roles separados de repartidor, GPS, rutas, entregas parciales, pagos en línea, facturación fiscal e integraciones automáticas.',354,465,550,13,GRAY,leading=19)
note('El paquete demostrativo limita el registro a 1.000 operaciones. No acredita capacidad comercial ni uso ilimitado.')
end()

# 12. Propuesta y entrega.
start('11 / Siguiente paso','Convertir la demo en un piloto acordado.','Propuesta de trabajo para Martín y Fabián; responsabilidades y condiciones aún por definir.')
for i,(title,body) in enumerate([('Elegir un negocio','Relevar productos, pedidos, entregas y quiénes van a operar.'),
                                ('Definir la primera versión','Acordar alcance, permisos, instalación, soporte y recuperación.'),
                                ('Repartir responsabilidades','Asignar análisis, desarrollo, pruebas, ventas y atención.'),
                                ('Validar y decidir','Completar el recorrido real y evaluar una oferta comercial.')]):
    y=180+i*67;tag(f'0{i+1}',42,y+1)
    text(title,102,y,17,INK,True);para(body,102,y+27,795,13,GRAY)
rect(42,463,876,77,INK,12)
para('Entrega para revisar y compartir',62,478,830,17,'#FFFFFF',True)
para('Presentación PDF, demo HTML, código fuente, instalador de Apps Script, plantilla, tutorial y guías. Repositorio del producto separado de la memoria personal.',62,507,830,12,'#D6E3DC',leading=17)
end()
c.save()
assert page_no==12
print(f'PDF generado: {args.output} | {page_no} páginas | {args.output.stat().st_size} bytes')
