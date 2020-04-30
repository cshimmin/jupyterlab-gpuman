import {
  ReactWidget,
  ToolbarButtonComponent
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

import * as React from 'react';

const RUNNING_CLASS = 'jp-RunningSessions';
const HEADER_CLASS = 'jp-RunningSessions-header';
const LIST_CLASS = 'jp-RunningSessions-sectionList';
const ITEM_CLASS = 'jp-RunningSessions-item';
const ITEM_LABEL_CLASS = 'jp-RunningSessions-itemLabel';
const SHUTDOWN_BUTTON_CLASS = 'jp-RunningSessions-itemShutdown';

function SessionComponent(props: {
  session: RunningSession
}) {
  const { session } = props;
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

function RunningSessionsComponent(props: {
  manager: SessionManager,
}) {
  //{toArray(props.manager.running()).map(item => new RunningSession(item)).map((item, i) => (
  //<{item.icon()}.react tag="span" stylesheet="runningItem" />
  const { manager } = props;
  const sessions = toArray(manager.running()).map(item => new RunningSession(item));
  return (
    <>
    <div className={HEADER_CLASS}>
    <ToolbarButtonComponent 
      tooltip="Refresh"
      icon={refreshIcon}
      onClick={() => props.manager.refreshRunning()}
    />
    </div>
    <ul className={LIST_CLASS}>
    {sessions.map((sess, i) => (
      <SessionComponent key={i} session={sess} />
    ))}
    </ul>
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
  constructor(sessions: SessionManager) {
    super();
    this._manager = sessions;
    this.addClass(RUNNING_CLASS);
  }

  render() {
    return <RunningSessionsComponent manager={this._manager} />;
  }

  private _manager: SessionManager;
}
