import {
  LabIcon,
  notebookIcon,
  consoleIcon,
  fileIcon,
  refreshIcon,
  closeIcon
} from '@jupyterlab/ui-components';

import {
  ReactWidget,
  ToolbarButtonComponent,
  UseSignal
} from '@jupyterlab/apputils';

import { JupyterFrontEnd } from '@jupyterlab/application';

import { SessionManager } from '@jupyterlab/services';

import { PathExt } from '@jupyterlab/coreutils';

import { GPUManager, IGPUStats, IGPUSession } from './jupyterlab-gpuman';

import { Signal, ISignal } from '@lumino/signaling';

import * as React from 'react';

function PercentIndicator(props: { val: number; label?: string }) {
  const { val, label } = props;
  const innerStyle = {
    width: val + '%'
  };
  return (
    <div className="jp-GPUSessions-percentIndicator">
      <div className="jp-GPUSessions-percentIndicator-container">
        <div
          className="jp-GPUSessions-percentIndicator-bar"
          style={innerStyle}
        />
      </div>
      <div className="jp-GPUSessions-percentIndicator-label">{label}</div>
    </div>
  );
}

function GPUSession(props: { session: IGPURunningSession }) {
  const { session } = props;
  const icon = session.icon();
  const memFrac = (100 * session.memUsed()) / session.memTotal();
  const memLabel =
    session.memUsed().toFixed() + ' / ' + session.memTotal().toFixed();
  return (
    <li className="jp-GPUSessions-item">
      <icon.react stylesheet="runningItem" />
      <div
        className="jp-GPUSessions-sessionPanel"
        onClick={() => session.open()}
      >
        <span className="jp-GPUSessions-sessionLabel">{session.path()}</span>
        <span className="jp-GPUSessions-sessionMemory">
          <PercentIndicator val={memFrac} label={memLabel} />
        </span>
      </div>
      <ToolbarButtonComponent
        icon={closeIcon}
        tooltip={'Shut down this session'}
        onClick={() => session.shutdown()}
      />
    </li>
  );
}

function GPUSessions(props: { sessions: IGPURunningSession[] }) {
  const { sessions } = props;
  if (sessions.length === 0) {
    return <></>;
  }
  const stats = sessions[0].gpuStats();
  sessions.sort((n1, n2) => n2.memUsed() - n1.memUsed());
  return (
    <>
      <div className="jp-GPUSessions-gpuLabel">
        GPU {stats.index} [{stats.name}]
      </div>
      <ul className="jp-GPUSessions-sessionList">
        {sessions.map((sess, i) => (
          <GPUSession key={i} session={sess} />
        ))}
      </ul>
    </>
  );
}

function GPUSessionsList(props: { gpuManager: IGPUManager }) {
  const { gpuManager } = props;
  const arr = [...Array(gpuManager.nGPUs()).keys()]
    .map(i => gpuManager.sessions(i))
    .filter(sessions => sessions.length > 0);
  return (
    <>
      {arr.map((sessions, i) => (
        <GPUSessions key={i} sessions={sessions} />
      ))}
    </>
  );
}

export interface IGPURunningSession {
  open: () => void;
  shutdown: () => void;
  icon: () => LabIcon;
  path: () => string;
  memUsed: () => number;
  memTotal: () => number;
  gpuStats: () => IGPUStats;
}

interface IGPUManager {
  refresh: () => void;
  nGPUs: () => number;
  stats: (gpu: number) => IGPUStats;
  statsAll: () => IGPUStats[];
  sessions: (gpu: number) => IGPURunningSession[];
  //kernelsChanged: ISignal<any, any>;
}

/*
function PercentageIndicator(props: { val: number, height: string }) {
  const { val, height } = props;
  const innerStyle = {
    width: val + '%'
  };
  const outerStyle = {
    padding: '5px',
    height: height
  };
  return (
    <div style={outerStyle}>
      <div className="pctind">
        <div className="pctind-left" style={innerStyle} />
      </div>
    </div>
  );
}
*/

function GPUStatPanel(props: { gpu: number; stats: IGPUStats }) {
  const { stats } = props;
  const memLabel =
    stats.mem_used.toFixed() +
    ' / ' +
    stats.mem_total.toFixed() +
    ' ' +
    stats.mem_unit;
  const gpuLabel = stats.gpu_util + '%';
  const bwLabel = stats.mem_util + '%';
  return (
    <div className="gpuStatPanel">
      <span className="gpuStatPanel-title">
        GPU {stats.index} [{stats.name}]
      </span>
      <div className="gpuStatPanel-indicators">
        <div className="gpuStatPanel-indicatorWidget gpuStatPanel-memoryIndicator">
          <div className="gpuStatPanel-indicatorTitle">Memory</div>
          <div className="gpuStatPanel-indicator">
            <PercentIndicator
              val={(stats.mem_used / stats.mem_total) * 100}
              label={memLabel}
            />
          </div>
        </div>
        <div className="gpuStatPanel-indicatorWidget gpuStatPanel-gpuIndicator">
          <div className="gpuStatPanel-indicatorTitle">GPU</div>
          <div className="gpuStatPanel-indicator">
            <PercentIndicator val={stats.gpu_util} label={gpuLabel} />
          </div>
        </div>
        <div className="gpuStatPanel-indicatorWidget gpuStatPanel-bwIndicator">
          <div className="gpuStatPanel-indicatorTitle">I/O</div>
          <div className="gpuStatPanel-indicator">
            <PercentIndicator val={stats.mem_util} label={bwLabel} />
          </div>
        </div>
      </div>
    </div>
  );
}

function GPUStatsPanel(props: { gpuManager: IGPUManager }) {
  const { gpuManager } = props;
  return (
    <>
      <div>
        {gpuManager.statsAll().map((stats, i) => (
          <GPUStatPanel key={i} gpu={i} stats={stats} />
        ))}
      </div>
    </>
  );
}

export class GPUWidget extends ReactWidget {
  constructor(app: JupyterFrontEnd, gpuManager: GPUManager) {
    super();
    this.addClass('jp-GPUWidget');

    this._sessionManager = app.serviceManager.sessions;

    class RunningSession implements IGPURunningSession {
      constructor(session: IGPUSession) {
        this._session = session;
      }

      private _session: IGPUSession;

      open(): void {
        const { path, type } = this._session;
        if (type.toLowerCase() === 'console') {
          void app.commands.execute('console:open', { path });
        } else {
          void app.commands.execute('docmanager:open', { path });
        }
      }

      shutdown(): void {
        void app.serviceManager.sessions.shutdown(this._session.id);
      }

      icon(): LabIcon {
        const { name, path, type } = this._session;
        if ((name || PathExt.basename(path)).indexOf('.ipynb') !== -1) {
          return notebookIcon;
        } else if (type.toLowerCase() === 'console') {
          return consoleIcon;
        }
        return fileIcon;
      }

      path(): string {
        return this._session.path;
      }

      memUsed(): number {
        return this._session.gpuKernel.used_memory;
      }

      memTotal(): number {
        return this._session.gpuStats.mem_total;
      }

      gpuStats(): IGPUStats {
        return this._session.gpuStats;
      }
    }

    this._gpuManager = {
      refresh: () => gpuManager.refresh(),
      nGPUs: () => gpuManager.nGPUs(),
      stats: (gpu: number) => gpuManager.stats(gpu),
      statsAll: () => gpuManager.statsAll(),
      //kernelsChanged: gpuManager.kernelsChanged,
      sessions: (gpu: number) => {
        const sessions = gpuManager
          .sessions(gpu)
          .map(kernel => new RunningSession(kernel));
        return sessions;
      }
    };

    this._sessionManager.runningChanged.connect(this.onSessChanged, this);
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
        <div className=".jp-GPUSessions-header">
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
        <br />
        <div className="gpuSessionsPanel">
          <UseSignal signal={this._somethingChanged}>
            {() => <GPUSessionsList gpuManager={this._gpuManager} />}
          </UseSignal>
        </div>
      </>
    );
  }
}
