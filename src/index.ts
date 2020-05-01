import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  ILayoutRestorer
} from '@jupyterlab/application';

import {
  MainAreaWidget,
  WidgetTracker
} from '@jupyterlab/apputils';

import {
  IMainMenu
} from '@jupyterlab/mainmenu';

import {
  ILauncher
} from '@jupyterlab/launcher';

import {
  kernelIcon
} from '@jupyterlab/ui-components';

import { GPUWidget } from './gpuwidget';
import { requestAPI, APIResult, GPUKernelManager } from './jupyterlab-gpuman';

function activate(app: JupyterFrontEnd, mainMenu: IMainMenu, launcher: ILauncher, restorer: ILayoutRestorer) {
  console.log('JupyterLab extension jupyterlab-gpuman is activated!');

  let widget: GPUWidget;
  let mainArea: MainAreaWidget<GPUWidget>;
  let gman: GPUKernelManager;

  let tracker = new WidgetTracker<MainAreaWidget<GPUWidget>>({
    namespace: 'gpuman'
  });

  const command: string = 'gpuman:open';

  app.commands.addCommand(command, {
    label: 'GPU Manager',
    caption: 'Open the GPU Manager',
    //icon: args => (args['isPalette'] ? '' : kernelIcon),
    icon: kernelIcon,
    execute: () => {
      if (!gman) {
        gman = new GPUKernelManager();
      }
      if (!widget) {
        widget = new GPUWidget(app.serviceManager.sessions, gman);
      }
      if (!mainArea || mainArea.isDisposed) {
        mainArea = new MainAreaWidget({content: widget});
        mainArea.id = 'jupyterlab-gpuman';
        mainArea.title.label = 'GPU Manager';
        mainArea.title.closable = true;
      }

      if (!tracker.has(mainArea)) {
        tracker.add(mainArea);
      }

      if (!mainArea.isAttached) {
        app.shell.add(mainArea, 'main');
      }

      mainArea.content.update();

      app.shell.activateById(mainArea.id);

      requestAPI<APIResult>('get').then(data => {
        console.log('got data (eventually):', data.gpu_kernels);
      });
    }
  });

  mainMenu.fileMenu.newMenu.addGroup([{command: command}]);

  launcher.add({
    command: command,
    category: 'Other'
  });

  restorer.restore(tracker, {
    command,
    name: () => 'gpuman'
  });
}

/**
 * Initialization data for the jupyterlab-gpuman extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-gpuman',
  autoStart: true,
  requires: [IMainMenu, ILauncher, ILayoutRestorer],
  activate: activate
};

export default extension;
