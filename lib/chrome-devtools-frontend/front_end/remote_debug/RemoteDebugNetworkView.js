const sweetAlert = window.Swal;
const BASE_TOAST_CONFIG = {
  position: 'top-end',
  animation: false,
  toast: true,
  timerProgressBar: true,
  timer: 3000,
};

/**
 * this test requires the URL to have a protocol.
 * https://mathiasbynens.be/demo/url-regex
 */
function isUrl(str) {
  return typeof str === 'string' && !!str.match(/^((https?|ftp|rtsp|mms):\/\/)(([0-9a-z_!~*'().&=+$%-]+: )?[0-9a-z_!~*'().&=+$%-]+@)?(([0-9]{1,3}\.){3}[0-9]{1,3}|([0-9a-z_!~*'()-]+\.)*([0-9a-z][0-9a-z-]{0,61})?[0-9a-z]\.[a-z]{2,6}|localhost)(:[0-9]{1,4})?((\/?)|(\/[0-9a-z_!~*'().;?:@&=+$,%#-]+)+\/?)$/i);
}

const DATA_GRID_COLUMN_CONFIG = [
  {
    id: 'index',
    title: Common.UIString('Index'),
    sortable: true,
  },
  {
    id: 'enable',
    title: Common.UIString('Enable'),
    sortable: false,
    checkbox: true,
    editable: true,
  },
  {
    id: 'ruleName',
    title: Common.UIString('Name'),
    sortable: true,
    editable: true,
  },
  {
    id: 'mapFrom',
    title: Common.UIString('From'),
    sortable: true,
    editable: true,
    tooltip: 'You can add a string to match the URL such as "google.com"',
  },
  {
    id: 'mapTo',
    title: Common.UIString('To'),
    sortable: true,
    editable: true,
    tooltip: 'You can add a mock URL here like "http://www.mocky.io/v2/5d8dca2a310000b6032b5060"',
  },
];

const INPUT_AREA_BUTTONS = [
  'Add',
  'Sync',
  'Reset',
  'Import',
  'Export',
];

const TOOLBAR_BUTTONS = [
  {
    name: 'Add',
    tooltip: 'Add a new rule',
    icon: 'largeicon-add',
  },
  {
    name: 'Sync',
    tooltip: 'Sync the rules manually',
    icon: 'largeicon-refresh',
  },
  {
    name: 'Reset',
    tooltip: 'Reset all the rules',
    icon: 'largeicon-clear',
  },
  {
    name: 'Import',
    tooltip: 'Import other\'s config',
    icon: 'largeicon-load',
  },
  {
    name: 'Export',
    tooltip: 'Export all the rules',
    icon: 'largeicon-download',
  }
];

const LOCAL_STORAGE_KEY = 'tubidebug.network.mockMap';

function generateKeyForRule(rule) {
  const [ mapFrom, mapTo ] = rule;
  return `${mapFrom.stringSlice}-${mapTo.url}-${!mapFrom.disabled}`;
}

function removeDuplicateRules(rules) {
  const set = new Set();
  return rules
    .reverse()
    .filter((rule) => {
      const key = generateKeyForRule(rule);
      const firstOne = !set.has(key);
      set.add(key);
      return firstOne;
    })
    .reverse();
}

/**
 * @unrestricted
 */
window.RemoteDebugNetworkView = class extends UI.VBox {
  /**
   * @param {!RemoteDebug.RemoteDebugPanel} panel
   */
  constructor(panel) {
    super(true);
    this.registerRequiredCSS('remote_debug/remoteDebugNetworkView.css');
    this.setMinimumSize(200, 100);

    this.contentElement.classList.add('remote-debug-network-view');
    this._panel = panel;
    this.buttons = {};

    const mockArrayInLocalStorage = localStorage.getItem(LOCAL_STORAGE_KEY);
    this.mockArray = mockArrayInLocalStorage ? JSON.parse(mockArrayInLocalStorage) : [];

    this.renderButtons();

    this._dataGrid = new DataGrid.DataGrid(DATA_GRID_COLUMN_CONFIG, this.editCallback, this.deleteCallback);
    const dataGridWidget = this._dataGrid.asWidget();
    dataGridWidget.show(this.contentElement);
    this.renderTooltipsForTable();
    this.renderTable();

    this.bindListener();
    this.refreshMockMap();
    // We need to refresh the mock map when the user refresh the page
    SDK.targetManager.addModelListener(
      SDK.RuntimeModel, SDK.RuntimeModel.Events.ExecutionContextCreated, this.refreshMockMap);
  }

  addRule = () => {
    this.mockArray.push([{ stringSlice: '', ruleName: '' }, { url: '' }]);
    this.refreshMockMap();
    this.renderTable();
    const { scrollContainer } = this._dataGrid;
    scrollContainer.scroll(0, scrollContainer.scrollHeight);
    const { children } = this._dataGrid.rootNode();
    this._dataGrid.startEditingNextEditableColumnOfDataGridNode(children[children.length - 1], DATA_GRID_COLUMN_CONFIG[1].id);
  }

  bindListener() {
    this.buttons.add.addEventListener(UI.ToolbarButton.Events.Click, this.addRule);
    this.buttons.sync.addEventListener(UI.ToolbarButton.Events.Click, this.refreshMockMap);
    this.buttons.reset.addEventListener(UI.ToolbarButton.Events.Click, this.resetMockMap);
    this.buttons.export.addEventListener(UI.ToolbarButton.Events.Click, this.exportMockMap);
    this.buttons.import.addEventListener(UI.ToolbarButton.Events.Click, this.importMockMap);
  }

  deleteCallback = (node) => {
    const index = node._data.index;
    this.mockArray.splice(index, 1);
    this.refreshMockMap();
    this.renderTable();
  }

  editCallback = (node, id, oldValue, newValue) => {
    if (id === 'mapTo' && !isUrl(newValue)) {
      sweetAlert.fire({
        ...BASE_TOAST_CONFIG,
        icon: 'warning',
        text: `${newValue} for "To" column is not a valid URL.`,
      });
    }
    const index = node._data.index;
    const rule = this.mockArray[index];
    switch(id) {
      case 'mapFrom':
        rule[0].stringSlice = newValue;
        break;
      case 'mapTo':
        rule[1].url = newValue;
        break;
      case 'enable':
        rule[0].disabled = !newValue;
        break;
      case 'ruleName':
        rule[0].ruleName = newValue;
        break;
      default:
        break;
    }
    this.refreshMockMap();
  }

  exportMockMap = () => {
    navigator.clipboard.writeText(JSON.stringify(this.mockArray, undefined, 4));
    sweetAlert.fire({
      ...BASE_TOAST_CONFIG,
      text: 'Rule config copied to the clipboard as JSON',
    });
  }

  importMockMap = async () => {
    const { dismiss, value } = await sweetAlert.fire({
      title: 'Import mock configuration',
      footer: 'The imported rules will be merged with the existing rules. They will not replace them.',
      input: 'textarea',
      inputMessage: 'Paste the config JSON here',
      inputAttributes: {
        'aria-label': 'Rule config as JSON for import'
      },
      inputValidator(value) {
        let newConfig = null;
        try {
          newConfig = JSON.parse(value);
        } catch(error) {
          return 'The import config should be JSON.';
        }
        if (!Array.isArray(newConfig)) {
          return 'The import config should be an Array.';
        }
      },
      showCancelButton: true
    });
    if (dismiss) return;
    const newConfig = JSON.parse(value);
    const oldArrayLength = this.mockArray.length;
    const newConfigLength = newConfig.length;
    const totalRulesNumber = newConfigLength + oldArrayLength;
    this.mockArray = removeDuplicateRules(this.mockArray.concat(newConfig));
    const duplicateRulesNumber = totalRulesNumber - this.mockArray.length;
    this.refreshMockMap();
    this.renderTable();
    sweetAlert.fire({
      ...BASE_TOAST_CONFIG,
      text: [
        `Merged ${newConfigLength} `,
        newConfigLength > 1 ? 'rules' : 'rule',
        duplicateRulesNumber > 0 ? `, ignoring ${duplicateRulesNumber} duplicate` : null,
        duplicateRulesNumber > 1 ? 's' : null,
        '.',
      ].filter(Boolean).join(''),
    });
  }

  refreshMockMap = (event = null) => {
    callDebugBridge('MockMap', 'refresh', { mockArray: this.mockArray });
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.mockArray));
    if (event) {
      sweetAlert.fire({
        ...BASE_TOAST_CONFIG,
        text: 'Synced',
      });
    }
  }

  renderButtons() {
    const toolbarContainer = this.element.createChild('div', 'toolbar-container');
    this.contentElement.appendChild(toolbarContainer);
    this._toolbar = new UI.Toolbar('toolbar', toolbarContainer);

    TOOLBAR_BUTTONS.forEach(({ name, tooltip, icon }) => {
      const button = new UI.ToolbarButton(Common.UIString(tooltip), icon);
      this._toolbar.appendToolbarItem(button);
      this.buttons[name.toLowerCase()] = button;
    });
  }

  renderTable() {
    this._dataGrid.rootNode().removeChildren();
    this.mockArray.forEach(([ mapFrom, mapTo ], index) => {
      const node = new DataGrid.DataGridNode({
        index,
        enable: !mapFrom.disabled,
        ruleName: mapFrom.ruleName,
        mapFrom: mapFrom.stringSlice,
        mapTo: mapTo.url
      }, false);
      this._dataGrid.rootNode().appendChild(node);
    });
  }

  renderTooltipsForTable() {
    DATA_GRID_COLUMN_CONFIG.forEach(({ id, tooltip }) => {
      if (!tooltip) return;
      UI.Tooltip.install(this._dataGrid.headerTableHeader(id), tooltip, id);
    });
  }

  resetMockMap = async () => {
    const { value, dismiss } = await sweetAlert.fire({
      title: 'Are you sure you want to delete all rules?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, delete them!'
    });
    if (dismiss || !value) {
      return;
    }
    this.mockArray = [];
    this.renderTable();
    this.refreshMockMap();
    sweetAlert.fire('Deleted!', 'Your rules have been deleted.', 'success');
  }
}
