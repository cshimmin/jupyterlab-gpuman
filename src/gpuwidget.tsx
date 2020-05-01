import {
  LabIcon,
  notebookIcon,
  consoleIcon,
  fileIcon,
  refreshIcon
} from '@jupyterlab/ui-components';

import {
  ReactWidget,
  ToolbarButtonComponent,
  UseSignal
} from '@jupyterlab/apputils';

import { JupyterFrontEnd } from '@jupyterlab/application';

import { Session, SessionManager } from '@jupyterlab/services';

import { PathExt } from '@jupyterlab/coreutils';

import { GPUManager, IGPUStats } from './jupyterlab-gpuman';

import { Signal, ISignal } from '@lumino/signaling';

import * as React from 'react';

//const RUNNING_CLASS = 'jp-RunningSessions';
const HEADER_CLASS = 'jp-RunningSessions-header';
const LIST_CLASS = 'jp-RunningSessions-sectionList';
const ITEM_CLASS = 'jp-RunningSessions-item';
const ITEM_LABEL_CLASS = 'jp-RunningSessions-itemLabel';
const SHUTDOWN_BUTTON_CLASS = 'jp-RunningSessions-itemShutdown';

function GPUSession(props: { session: IGPUSession }) {
  const { session } = props;
  const icon = session.icon();
  return (
    <li className={ITEM_CLASS}>
      <icon.react stylesheet="runningItem" />
      <span className={ITEM_LABEL_CLASS} onClick={() => session.open()}>
        {session.path()}
      </span>
      <button
        className={`${SHUTDOWN_BUTTON_CLASS} jp-mod-styled`}
        onClick={() => session.shutdown()}
      >
        SHUT&nbsp;DOWN
      </button>
    </li>
  );
}

function GPUSessions(props: { gpu: number; gpuManager: IGPUManager }) {
  const { gpu, gpuManager } = props;
  const stats = gpuManager.stats(gpu);
  const sessions = gpuManager.sessions(gpu);
  if (sessions.length === 0) {
    return <></>;
  }
  return (
    <>
      <b>
        Sessions running on GPU {gpu} [{stats.name}]:
      </b>
      <ul className={LIST_CLASS}>
        {sessions.map((sess, i) => (
          <GPUSession key={i} session={sess} />
        ))}
      </ul>
    </>
  );
}

function GPUSessionsList(props: { gpuManager: IGPUManager }) {
  const { gpuManager } = props;
  const arr = [...Array(gpuManager.nGPUs()).keys()];
  return (
    <>
      {arr.map(i => (
        <GPUSessions key={i} gpu={i} gpuManager={gpuManager} />
      ))}
    </>
  );
}

export interface IGPUSession {
  open: () => void;
  shutdown: () => void;
  icon: () => LabIcon;
  path: () => string;
}

interface IGPUManager {
  refresh: () => void;
  nGPUs: () => number;
  stats: (gpu: number) => IGPUStats;
  statsAll: () => IGPUStats[];
  sessions: (gpu: number) => IGPUSession[];
  //kernelsChanged: ISignal<any, any>;
}

function GPUStatPanel(props: { gpu: number; stats: IGPUStats }) {
  const { gpu, stats } = props;
  return (
    <div>
      <h3>
        GPU {gpu} [{stats.name}]
      </h3>
      <br />
      <span>
        Memory: {stats.mem_used.toFixed()} / {stats.mem_total.toFixed()}{' '}
        {stats.mem_unit}
      </span>
      <br />
      <span>GPU Utilization: {stats.gpu_util}%</span>
      <br />
      <br />
    </div>
  );
}

function GPUStatsPanel(props: { gpuManager: IGPUManager }) {
  const { gpuManager } = props;
  return (
    <>
      {gpuManager.statsAll().map((stats, i) => (
        <GPUStatPanel key={i} gpu={i} stats={stats} />
      ))}
    </>
  );
}

export class GPUWidget extends ReactWidget {
  constructor(app: JupyterFrontEnd, gpuManager: GPUManager) {
    super();
    this._sessionManager = app.serviceManager.sessions;

    class RunningSession implements IGPUSession {
      constructor(model: Session.IModel) {
        this._model = model;
      }

      private _model: Session.IModel;

      open(): void {
        const { path, type } = this._model;
        if (type.toLowerCase() === 'console') {
          void app.commands.execute('console:open', { path });
        } else {
          void app.commands.execute('docmanager:open', { path });
        }
      }

      shutdown(): void {
        void app.serviceManager.sessions.shutdown(this._model.id);
      }

      icon(): LabIcon {
        const { name, path, type } = this._model;
        if ((name || PathExt.basename(path)).indexOf('.ipynb') !== -1) {
          return notebookIcon;
        } else if (type.toLowerCase() === 'console') {
          return consoleIcon;
        }
        return fileIcon;
      }

      path(): string {
        return this._model.path;
      }
    }

    this._gpuManager = {
      refresh: () => gpuManager.refresh(),
      nGPUs: () => gpuManager.nGPUs(),
      stats: (gpu: number) => gpuManager.stats(gpu),
      statsAll: () => gpuManager.statsAll(),
      //kernelsChanged: gpuManager.kernelsChanged,
      sessions: (gpu: number) => {
        const sessies = gpuManager
          .sessions(gpu)
          .map(sess => new RunningSession(sess));
        return sessies;
      }
    };

    this._sessionManager.runningChanged.connect(this.onSessChanged, this);
    //this._sessionManager.runningChanged.connect(this._gpuManager.refresh, this);
    gpuManager.kernelsChanged.connect(this.onGPUKernelsChanged, this);
    this._updateReceived = gpuManager.updateReceived;
  }

  onSessChanged(): void {
    this._gpuManager.refresh();
  }

  onGPUKernelsChanged(): void {
    this._somethingChanged.emit();
  }

  private _sessionManager: SessionManager;
  private _gpuManager: IGPUManager;
  private _somethingChanged = new Signal<this, void>(this);
  private _updateReceived: ISignal<any, void>;

  render() {
    return (
      <>
        <div className={HEADER_CLASS}>
          <ToolbarButtonComponent
            tooltip="Refresh"
            icon={refreshIcon}
            onClick={() => {
              this._sessionManager.refreshRunning();
              this._gpuManager.refresh();
            }}
          />
        </div>
        <UseSignal signal={this._updateReceived}>
          {() => <GPUStatsPanel gpuManager={this._gpuManager} />}
        </UseSignal>
        <UseSignal signal={this._somethingChanged}>
          {() => <GPUSessionsList gpuManager={this._gpuManager} />}
        </UseSignal>
      </>
    );
  }
}
