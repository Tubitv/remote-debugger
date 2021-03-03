const sweetAlert = window.Swal;

const BASE_TOAST_CONFIG = {
    position: 'top-end',
    animation: false,
    toast: true,
    timerProgressBar: true,
    timer: 3000,
};

/**
 * Remote Debug Panel
 * NOTE refer lots of code from SecurityPanel
 * @link https://github.com/ChromeDevTools/devtools-frontend/blob/master/front_end/security/SecurityPanel.js
 */
RemoteDebug.RemoteDebugPanel = class extends UI.PanelWithSidebar {
  constructor() {
    super('remote_debug');

    // create views and corresponding sidebar items
    this._overviewView = new RemoteDebug.RemoteDebugOverviewView(this);
    this._sidebarOverviewViewElement = this._createSidebarTreeElement('Overview', this._overviewView);

    this._networkView = new window.RemoteDebugNetworkView(this);
    this._sidebarNetworkViewElement = this._createSidebarTreeElement('Network', this._networkView);

    this._reduxView = new window.RemoteDebugReduxView(this);
    this._sidebarReduxViewElement = this._createSidebarTreeElement('Redux', this._reduxView);

    this._sidebarTree = new RemoteDebug.RemoteDebugPanelSidebarTree();
    this._sidebarTree.appendChild(this._sidebarOverviewViewElement);
    this._sidebarTree.appendChild(this._sidebarNetworkViewElement);
    this._sidebarTree.appendChild(this._sidebarReduxViewElement);

    this.panelSidebarElement().appendChild(this._sidebarTree.element);
  }

  /**
   * @return {!RemoteDebug.RemoteDebugPanel}
   */
  static _instance() {
    return /** @type {!RemoteDebug.RemoteDebugPanel} */ (self.runtime.sharedInstance(RemoteDebug.RemoteDebugPanel));
  }

  /**
   * @override
   */
  focus() {
    this._sidebarTree.focus();
  }

  /**
   * @override
   */
  wasShown() {
    super.wasShown();
    if (!this._visibleView) {
      this._sidebarOverviewViewElement.select(true);
    }
  }

  /**
   * @param {!UI.VBox} view
   */
  _setVisibleView(view) {
    if (this._visibleView === view)
      return;

    if (this._visibleView)
      this._visibleView.detach();

    this._visibleView = view;

    if (view)
      this.splitWidget().setMainWidget(view);
  }

  _createSidebarTreeElement(title, view) {
    const titleElement = createElementWithClass('span', 'title');
    titleElement.textContent = Common.UIString(title);
    return new RemoteDebug.RemoteDebugPanelSidebarTreeElement(
      titleElement,
      this._setVisibleView.bind(this, view),
      'remote-debug-sidebar-tree-item',
    );
  }
};

/**
 * @unrestricted
 */
RemoteDebug.RemoteDebugPanelSidebarTreeElement = class extends UI.TreeElement {
  /**
   * @param {!Element} textElement
   * @param {function()} selectCallback
   * @param {string} className
   */
  constructor(textElement, selectCallback, className) {
    super('', false);
    this._selectCallback = selectCallback;
    this.listItemElement.classList.add(className);
    this.listItemElement.appendChild(textElement);
  }

  /**
   * @override
   * @return {boolean}
   */
  onselect() {
    this._selectCallback();
    return true;
  }
};

/**
 * @unrestricted
 */
RemoteDebug.RemoteDebugPanelSidebarTree = class extends UI.TreeOutlineInShadow {
  /**
   * @param {!RemoteDebug.RemoteDebugPanelSidebarTreeElement} mainViewElement
   */
  constructor() {
    super();
    this.registerRequiredCSS('remote_debug/sidebar.css');
  }
}

/**
 * @unrestricted
 */
RemoteDebug.RemoteDebugOverviewView = class extends UI.VBox {
  /**
   * @param {!RemoteDebug.RemoteDebugPanel} panel
   */
  constructor(panel) {
    super(true);
    this.registerRequiredCSS('remote_debug/remoteDebug.css');

    this.setMinimumSize(200, 100);

    this.contentElement.classList.add('remote-debug-panel');
    this.contentElement.id = 'overview-view';
    this._panel = panel;

    const usage = createElementWithClass('div', 'remote-debug-overview-usage');
    usage.innerHTML = `
      <p>Welcome to use RemoteDebug panel! It aims to facilitate debugging and testing on remote devices.</p>
      <p>Features:</p>
      <ul>
        <li>
          <h5>Network</h5>
          <p>It allows mocking any network requests by a given pattern, make it possible to forcibly show or skip ads, return 404 or 500, etc.</p>
        </li>
      </ul>
      <p>More to come~</p>
    `;

    this.contentElement.appendChild(usage);
  }
}

