import json

from notebook.base.handlers import APIHandler
from notebook.utils import url_path_join, maybe_future
from tornado import gen, web

from pynvml.smi import nvidia_smi
import os

class GPUKernels(APIHandler):
    def __init__(self, *args, **kwargs):
        super(GPUKernels, self).__init__(*args, **kwargs)

        self.nvsmi = nvidia_smi.getInstance()
        
    # The following decorator should be present on all verb methods (head, get, post, 
    # patch, put, delete, options) to ensure only authorized user can request the 
    # Jupyter server
    @web.authenticated
    @gen.coroutine
    def get(self):
        sessions = yield maybe_future(self.settings['session_manager'].list_sessions())

        sessions_by_kernel = {}
        for s in sessions:
            try:
                kid = s['kernel']['id']
            except KeyError:
                continue
            sessions_by_kernel.setdefault(kid, []).append(s)

        gpusers = self.nvsmi.DeviceQuery('compute-apps')['gpu']

        #result = {'gpu_sessions': []}
        result = []
        for gid, gpu in enumerate(gpusers):
            result.append({'kernels': []})
            if gpu['processes'] is None: continue
            for p in gpu['processes']:
                pinfo = {}
                with open('/proc/%d/cmdline'%p['pid'], 'r') as ftmp:
                    cmdline = ftmp.read().strip()
                with open('/proc/%d/loginuid'%p['pid'], 'r') as ftmp:
                    pinfo['uid'] = int(ftmp.read().strip())
                if 'ipykernel_launcher' in cmdline:
                    items = cmdline.split('\u0000')
                    kfile = os.path.basename(items[items.index('-f')+1])
                    if kfile.startswith('kernel-') and kfile.endswith('.json'):
                        pinfo['id'] = kfile[len('kernel-'):-len('.json')]
                try:
                    pinfo['sessions'] = sessions_by_kernel[pinfo['id']]
                except KeyError:
                    continue
                pinfo['used_memory'] = p['used_memory']
                pinfo['pid'] = p['pid']
                pinfo['gpu'] = gid
                pinfo['cmdline'] = cmdline.replace('\u0000',' ')
                result[-1]['kernels'].append(pinfo)

        gpstats = self.nvsmi.DeviceQuery('name,utilization.gpu,utilization.memory,memory.free,memory.used,memory.total')['gpu']
        for gid, stats in enumerate(gpstats):
            result[gid]['stats'] = {
                    'name': stats['product_name'],
                    'brand': stats['product_brand'],
                    'mem_total': stats['fb_memory_usage']['total'],
                    'mem_free': stats['fb_memory_usage']['free'],
                    'mem_used': stats['fb_memory_usage']['used'],
                    'mem_unit': stats['fb_memory_usage']['unit'],
                    'mem_util': stats['utilization']['memory_util'],
                    'gpu_util': stats['utilization']['gpu_util'],
                    }
        self.finish(json.dumps(result))

'''
class GPUStatus(APIHandler):
    def __init__(self, *args, **kwargs):
        super(GPUStatus, self).__init__(*args, **kwargs)

        self.nvsmi = nvidia_smi.getInstance()

    @web.authenticated
    def get(self):
        gpstats = self.nvsmi.DeviceQuery
'''

def setup_handlers(web_app):
    host_pattern = ".*$"
    
    base_url = web_app.settings["base_url"]
    route_pattern = url_path_join(base_url, "jupyterlab-gpuman", "get")
    handlers = [(route_pattern, GPUKernels)]
    web_app.add_handlers(host_pattern, handlers)
