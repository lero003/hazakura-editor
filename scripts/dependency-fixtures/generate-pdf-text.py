from pathlib import Path
import json,zlib,hashlib,sys
# Self-authored test PDFs using PDF Base14 fonts; no embedded font asset.
# Generated files are temporary test inputs, not redistributed third-party PDFs.
base=Path(sys.argv[1]);base.mkdir(parents=True,exist_ok=True)
def pdf(name,pages,font='Helvetica',encoding='WinAnsiEncoding',rotation=0,compress=False,corrupt=None):
 objs=[b'',b'',(f'<< /Type /Font /Subtype /Type1 /BaseFont /{font}' + (f' /Encoding /{encoding}' if encoding else '') + ' >>').encode()]; kids=[]
 for content in pages:
  pageidx=len(objs)+1; streamidx=pageidx+1; kids.append(f'{pageidx} 0 R')
  objs.append(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Rotate {rotation} /Resources << /Font << /F1 3 0 R >> >> /Contents {streamidx} 0 R >>'.encode())
  raw=content.encode('latin1'); data=zlib.compress(raw) if compress else raw
  objs.append(f'<< /Length {len(data)} '.encode()+(b'/Filter /FlateDecode ' if compress else b'')+b'>>\nstream\n'+data+b'\nendstream')
 objs[0]=b'<< /Type /Catalog /Pages 2 0 R >>'; objs[1]=f'<< /Type /Pages /Kids [{" ".join(kids)}] /Count {len(kids)} >>'.encode()
 out=b'%PDF-1.4\n'; offsets=[0]
 for i,obj in enumerate(objs,1): offsets.append(len(out));out+=f'{i} 0 obj\n'.encode()+obj+b'\nendobj\n'
 xref=len(out);out+=f'xref\n0 {len(objs)+1}\n0000000000 65535 f \n'.encode()
 out+=b''.join(f'{offset:010d} 00000 n \n'.encode() for offset in offsets[1:]);out+=f'trailer\n<< /Size {len(objs)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()
 if corrupt=='xref':out=out.replace(f'startxref\n{xref}'.encode(),b'startxref\n1')
 if corrupt=='truncated':out=out[:xref]
 p=base/(name+'.pdf');p.write_bytes(out)
 return {'name':name,'pageCount':len(pages),'sha256':hashlib.sha256(out).hexdigest()}
def lines(values):return 'BT /F1 18 Tf '+''.join(f'1 0 0 1 50 {740-i*30} Tm ({v}) Tj ' for i,v in enumerate(values))+'ET'
manifest=[]
manifest.append(pdf('latin_base14',[lines(['ASCII text 123.', 'Punctuation: comma, colon; period.'])]))
manifest.append(pdf('latin_winansi',[lines(['Caf\xe9 d\xe9j\xe0 vu. \x80 euro \x96 dash.'])]))
manifest.append(pdf('latin_macroman',[lines(['Caf\x8e r\x8esum\x8e.'])],encoding='MacRomanEncoding'))
manifest.append(pdf('symbol',[lines(['abgdpSW'])],font='Symbol',encoding='StandardEncoding'))
manifest.append(pdf('two_columns',['BT /F1 18 Tf 1 0 0 1 50 740 Tm (LEFT ONE) Tj 1 0 0 1 50 710 Tm (LEFT TWO) Tj 1 0 0 1 330 740 Tm (RIGHT ONE) Tj 1 0 0 1 330 710 Tm (RIGHT TWO) Tj ET']))
manifest.append(pdf('rotation_90',[lines(['Rotated page 90 degrees.'])],rotation=90))
manifest.append(pdf('three_pages_blank_middle',[lines(['PAGE ONE']), '',lines(['PAGE THREE'])]))
manifest.append(pdf('compressed_stream',[lines(['Compressed text remains readable.'])],compress=True))
manifest.append(pdf('long_41_pages',[lines([f'Page {i+1} text']) for i in range(41)]))
manifest.append(pdf('broken_startxref',[lines(['Recoverable malformed xref.'])],corrupt='xref'))
manifest.append(pdf('truncated_xref',[lines(['Truncated before xref.'])],corrupt='truncated'))
manifest.append(pdf('helvetica_standard',[lines(['Helvetica standard encoding.'])],encoding='StandardEncoding'))
manifest.append(pdf('symbol_default',[lines(['abgdpSW'])],font='Symbol',encoding=None))
(base/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Generated',len(manifest),'self-authored fixtures using base14 fonts, no embedded font asset')
