import json

from notebook.base.handlers import APIHandler
from notebook.utils import url_path_join
import tornado

from pynvml.smi import nvidia_smi
import os

class RouteHandler(APIHandler):
    def __init__(self, *args, **kwargs):
        super(RouteHandler, self).__init__(*args, **kwargs)

        self.nvsmi = nvidia_smi.getInstance()
        
    # The following decorator should be present on all verb methods (head, get, post, 
    # patch, put, delete, options) to ensure only authorized user can request the 
    # Jupyter server
    @tornado.web.authenticated
    def get(self):
        gpusers = self.nvsmi.DeviceQuery('compute-apps')['gpu']

        result = {'gpu_kernels': []}
        for gid, gpu in enumerate(gpusers):
            if gpu['processes'] is None: continue
            for p in gpu['processes']:
                pinfo = {'kernel': None}
                with open('/proc/%d/cmdline'%p['pid'], 'r') as ftmp:
                    cmdline = ftmp.read().strip()
                with open('/proc/%d/loginuid'%p['pid'], 'r') as ftmp:
                    pinfo['uid'] = int(ftmp.read().strip())
                if 'ipykernel_launcher' in cmdline:
                    items = cmdline.split('\u0000')
                    kfile = os.path.basename(items[items.index('-f')+1])
                    if kfile.startswith('kernel-') and kfile.endswith('.json'):
                        pinfo['kernel'] = kfile[len('kernel-'):-len('.json')]
                if pinfo['kernel'] is None:
                    continue
                pinfo['used_memory'] = p['used_memory']
                pinfo['pid'] = p['pid']
                pinfo['gpu'] = gid
                pinfo['cmdline'] = cmdline.replace('\u0000',' ')
                result['gpu_kernels'].append(pinfo)

        self.finish(json.dumps(result))

def setup_handlers(web_app):
    host_pattern = ".*$"
    
    base_url = web_app.settings["base_url"]
    route_pattern = url_path_join(base_url, "jupyterlab-gpuman", "get")
    handlers = [(route_pattern, RouteHandler)]
    web_app.add_handlers(host_pattern, handlers)
