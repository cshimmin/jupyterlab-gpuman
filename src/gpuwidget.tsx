import {
  ReactWidget,
  ToolbarButtonComponent,
  UseSignal
} from '@jupyterlab/apputils';

import {
  Session,
  SessionManager
} from '@jupyterlab/services';

import {
  refreshIcon,
  notebookIcon,
  consoleIcon,
  fileIcon
} from '@jupyterlab/ui-components';

import {
  PathExt
} from '@jupyterlab/coreutils';

import {
  toArray
} from '@lumino/algorithm';

import {
  GPUKernelManager, APIKernel
} from './jupyterlab-gpuman';

import * as React from 'react';

const RUNNING_CLASS = 'jp-RunningSessions';
const HEADER_CLASS = 'jp-RunningSessions-header';
const LIST_CLASS = 'jp-RunningSessions-sectionList';
const ITEM_CLASS = 'jp-RunningSessions-item';
const ITEM_LABEL_CLASS = 'jp-RunningSessions-itemLabel';
const SHUTDOWN_BUTTON_CLASS = 'jp-RunningSessions-itemShutdown';

function SessionComponent(props: {
  session: Session.IModel
}) {
  const session = new RunningSession(props.session);
  const icon = session.icon();

  return (
    <li className={ITEM_CLASS}>
    <icon.react stylesheet="runningItem" />
    <span className={ITEM_LABEL_CLASS}>
    { session.path() }
    </span>
    <button
      className={`${SHUTDOWN_BUTTON_CLASS} jp-mod-styled`}
    >
    SHUT&nbsp;DOWN
    </button>
    </li>
  );
}

function SessList(props: {
  runningSessions: Session.IModel[],
  gpuKernels: Map<string, APIKernel> 
  gpu: number
}) {
  const { runningSessions, gpuKernels, gpu } = props;
  return (
    <>
    <ul className={LIST_CLASS}>
    {runningSessions.filter(sess => (gpuKernels.has(sess.kernel.id) && gpuKernels.get(sess.kernel.id).gpu === gpu)).map((sess, i) => (
      <SessionComponent key={100*i+gpu} session={sess} />
    ))}
    </ul>
    </>
  );
}

function LoopGPU(props: {
  smanager: SessionManager,
  kmanager: GPUKernelManager
}) {
  const { smanager, kmanager } = props;
  const gpulist = [0, 1, 2, 3, 4];
  return (
    <>
    {gpulist.map(igpu => (
      <>
      <b>GPU {igpu}</b>
      <SessList runningSessions={toArray(smanager.running())} gpuKernels={kmanager.kernels()} gpu={igpu} />
      </>
    ))}
    </>
  );
}

function RunningSessionsComponent(props: {
  smanager: SessionManager,
  kmanager: GPUKernelManager
}) {
  const { smanager, kmanager } = props;
  return (
    <>
    <div className={HEADER_CLASS}>
    <ToolbarButtonComponent 
      tooltip="Refresh"
      icon={refreshIcon}
      onClick={() => {
        smanager.refreshRunning();
        kmanager.refresh();
      }}
    />
    </div>
    <UseSignal signal={smanager.runningChanged}>
    {() =>
    <UseSignal signal={kmanager.kernelsChanged}>
    {() =>
      <LoopGPU smanager={smanager} kmanager={kmanager} />
    }
    </UseSignal>
    }
    </UseSignal>
    </>
  );
}

class RunningSession {
  constructor(session: Session.IModel) {
    this._session = session;
  }

  private _session: Session.IModel;

  icon() {
    const {name, path, type } = this._session;
    if ((name || PathExt.basename(path)).indexOf('.ipynb') !== -1) {
      return notebookIcon;
    } else if (type.toLowerCase() === 'console') {
      return consoleIcon;
    } else {
      return fileIcon;
    }
  }

  path() {
    return this._session.path;
  }
}

export class GPUWidget extends ReactWidget {
  constructor(sessions: SessionManager, kernels: GPUKernelManager) {
    super();
    this._smanager = sessions;
    this._kmanager = kernels;
    this.addClass(RUNNING_CLASS);
  }

  render() {
    return <RunningSessionsComponent smanager={this._smanager} kmanager={this._kmanager}/>;
  }

  private _smanager: SessionManager;
  private _kmanager: GPUKernelManager;
}
