# Every internal link, image, stylesheet url() and in-page anchor of the site must point at something that exists.
# External links are only listed (no network access); the hosts are printed so a new one is noticed.
import glob, os, re, sys
from html.parser import HTMLParser
from urllib.parse import urlparse, unquote
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'docs')
root = os.path.normpath(root)
class P(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids=set(); self.refs=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if 'id' in a: self.ids.add(a['id'])
        for k in ('href','src'):
            if k in a and a[k] is not None:
                self.refs.append((tag,k,a[k]))
        if a.get('srcset'):
            for part in a['srcset'].split(','):
                if part.strip(): self.refs.append((tag,'srcset',part.strip().split()[0]))
        if tag=='meta' and (a.get('property') or '').endswith(':image') and a.get('content'):
            self.refs.append((tag,'content',a['content']))
        if tag=='link' and a.get('rel')=='preload' and 'href' in a: pass
pages={}
for f in sorted(glob.glob(root+'/*.html')):
    p=P(); p.feed(open(f,encoding='utf-8').read()); pages[os.path.basename(f)]=p
bad=0; ext={}
for name,p in pages.items():
    for tag,k,v in p.refs:
        if v.startswith(('http://','https://')):
            ext.setdefault(v,set()).add(name); continue
        if v.startswith(('tel:','mailto:')): continue
        if v=='#' : continue
        u=urlparse(v)
        target=u.path or name
        frag=unquote(u.fragment)
        path=os.path.join(root,target)
        if not os.path.exists(path):
            print('MISSING FILE',name,v); bad+=1; continue
        if frag and target.endswith('.html'):
            if frag not in pages[os.path.basename(target)].ids:
                print('MISSING ANCHOR',name,v); bad+=1
# url(...) references inside the stylesheet (fonts, images), resolved from the css file's folder
css=open(root+'/assets/css/style.css',encoding='utf-8').read()
for m in re.finditer(r'url\(\s*["\']?([^)"\']+)["\']?\s*\)',css):
    v=m.group(1)
    if v.startswith(('data:','http://','https://','#')): continue
    if not os.path.exists(os.path.normpath(os.path.join(root,'assets/css',v))):
        print('MISSING CSS FILE',v); bad+=1
print('internal problems:',bad)
print('\nexternal links (%d unique):'%len(ext))
for u in sorted(ext): 
    host=urlparse(u).netloc
    print(' ',host.ljust(24),u[:110],'| pages:',len(ext[u]))
hosts=sorted({urlparse(u).netloc for u in ext})
print('\nhosts:',hosts)
sys.exit(1 if bad else 0)
