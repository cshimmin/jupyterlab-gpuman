import { URLExt } from '@jupyterlab/coreutils';

import { ServerConnection } from '@jupyterlab/services';

import {
  Signal,
  ISignal
} from '@lumino/signaling';

import {
  Poll
} from '@lumino/polling';

export class GPUKernelManager {
  constructor() {
    this._pollGPUs = new Poll({
      auto: false,
      factory: () => this.requestKernels(),
      frequency: {
        interval: 10 * 1000,
        backoff: true,
        max: 300 * 1000
      },
      name: 'jupyterlab-gpuman/services:GPUKernelManager',
      standby: 'when-hidden'
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
    let kinfo = await requestAPI<APIResult>('get');

    let newkernels = new Map<string, APIKernel>();
    for (let k of kinfo.gpu_kernels) {
      newkernels.set(k.kernel, k);
    }

    this._kernels = newkernels;
    this._kernelsChanged.emit(newkernels);
  }

  kernels(): Map<string, APIKernel> {
    return this._kernels;
  }

  async refresh(): Promise<void> {
    await this._pollGPUs.refresh();
    await this._pollGPUs.tick;
  }

  get kernelsChanged(): ISignal<this, Map<string, APIKernel>> {
    return this._kernelsChanged;
  }

  private _kernels = new Map<string, APIKernel>();
  private _pollGPUs: Poll;
  private _kernelsChanged = new Signal<this, Map<string, APIKernel>>(this);
  private _isReady = false;
  private _ready: Promise<void>;
}

export interface APIKernel {
  kernel: string;
  uid: number;
  gpu: number;
}

export interface APIResult {
  gpu_kernels: APIKernel[];
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
