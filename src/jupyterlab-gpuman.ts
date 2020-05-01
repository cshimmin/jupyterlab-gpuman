import { URLExt } from '@jupyterlab/coreutils';

import { Session } from '@jupyterlab/services';

import { ServerConnection } from '@jupyterlab/services';

import { Signal, ISignal } from '@lumino/signaling';

import { Poll } from '@lumino/polling';

function eqSet(a: Set<any>, b: Set<any>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const v of a) {
    if (!b.has(v)) {
      return false;
    }
  }
  return true;
}

export class GPUManager {
  constructor() {
    this._pollGPUs = new Poll({
      auto: false,
      factory: () => this.requestKernels(),
      frequency: {
        interval: 5 * 1000,
        backoff: false
        //max: 300 * 1000
      },
      name: 'jupyterlab-gpuman/services:GPUManager'
      //standby: 'when-hidden'
    });

    this._ready = (async () => {
      await this._pollGPUs.start();
      await this._pollGPUs.tick;
      this._isReady = true;
    })();
  }

  get isReady(): boolean {
    return this._isReady;
  }

  get ready(): Promise<void> {
    return this._ready;
  }

  protected async requestKernels(): Promise<void> {
    const gpus = (await requestAPI('get')) as IGPUInfo[];

    this._gpus = gpus;

    const gpuKernels = new Set<string>();

    for (const g of gpus) {
      for (const k of g.kernels) {
        gpuKernels.add(k.id + k.gpu + k.used_memory);
      }
    }

    if (!eqSet(this._knownKernels, gpuKernels)) {
      this._knownKernels = gpuKernels;
      this._kernelsChanged.emit();
    }

    this._updateReceived.emit();
  }

  sessions(gpu: number): Session.IModel[] {
    let arr: Session.IModel[] = [];
    for (const k of this._gpus[gpu].kernels) {
      arr = arr.concat(k.sessions);
    }
    return arr;
  }

  kernels(gpu: number): IGPUKernel[] {
    return this._gpus[gpu].kernels;
  }

  kernelsFlat(): IGPUKernel[] {
    let arr: IGPUKernel[];
    for (const g of this._gpus) {
      arr = arr.concat(g.kernels);
    }
    return arr;
  }

  stats(gpu: number): IGPUStats {
    return this._gpus[gpu].stats;
  }

  statsAll(): IGPUStats[] {
    return this._gpus.map(gpu => gpu.stats);
  }

  nGPUs(): number {
    return this._gpus.length;
  }

  async refresh(): Promise<void> {
    await this._pollGPUs.refresh();
    await this._pollGPUs.tick;
  }

  get kernelsChanged(): ISignal<this, void> {
    return this._kernelsChanged;
  }

  get updateReceived(): ISignal<this, void> {
    return this._updateReceived;
  }

  private _gpus = new Array<IGPUInfo>();
  private _pollGPUs: Poll;
  private _knownKernels = new Set<string>();
  private _kernelsChanged = new Signal<this, void>(this);
  private _updateReceived = new Signal<this, void>(this);
  private _isReady = false;
  private _ready: Promise<void>;
}

export interface IGPUKernel {
  id: string;
  uid: number;
  gpu: number;
  used_memory: number;
  sessions: Session.IModel;
}

export interface IGPUStats {
  name: string;
  brand: string;
  gpu_util: number;
  mem_total: number;
  mem_free: number;
  mem_used: number;
  mem_unit: string;
  mem_util: number;
}

export interface IGPUInfo {
  kernels: IGPUKernel[];
  stats: IGPUStats;
}

/**
 * Call the API extension
 *
 * @param endPoint API REST end point for the extension
 * @param init Initial values for the request
 * @returns The response body interpreted as JSON
 */
export async function requestAPI<T>(
  endPoint = '',
  init: RequestInit = {}
): Promise<T> {
  // Make request to Jupyter API
  const settings = ServerConnection.makeSettings();
  const requestUrl = URLExt.join(
    settings.baseUrl,
    'jupyterlab-gpuman', // API Namespace
    endPoint
  );

  let response: Response;
  try {
    response = await ServerConnection.makeRequest(requestUrl, init, settings);
  } catch (error) {
    throw new ServerConnection.NetworkError(error);
  }

  const data = await response.json();

  if (!response.ok) {
    throw new ServerConnection.ResponseError(response, data.message);
  }

  return data as Promise<T>;
}
