class ReduxModel extends SDK.SDKModel {	
  static Events = {	
    ReduxRelay: Symbol('ReduxRelay'),	
  };	

  constructor(target) {	
    super(target);	
    target.registerReduxDispatcher(new ReduxDispatcher(this));	
  }	

  reduxRelay(action, instanceId, isExcess, name, nextActionId, payload, type) {	
    this.dispatchEventToListeners(ReduxModel.Events.ReduxRelay, { action: JSON.parse(action || '{}'), instanceId, isExcess, name, nextActionId, payload: JSON.parse(payload || '{}'), type });	
  }	
}	

class ReduxDispatcher {	
  constructor(reduxModel) {	
    this._reduxModel = reduxModel;	
  }	

  reduxRelay(...args) {	
    this._reduxModel.reduxRelay(...args);	
  }	
}	

SDK.SDKModel.register(ReduxModel, SDK.Target.Capability.Log, true);	

SDK.ReduxModel = ReduxModel;

/**
 * @unrestricted
 */
window.RemoteDebugReduxView = class extends UI.VBox {
  /**
   * @param {!RemoteDebug.RemoteDebugPanel} panel
   */
  constructor(panel) {
    super(true);
    this.registerRequiredCSS('remote_debug/remoteDebug.css');

    this.setMinimumSize(200, 100);

    this.contentElement.classList.add('remote-debug-panel');
    this._panel = panel;
    this.ReduxModePanel = this.contentElement.createChild('div', 'redux-mode-panel');
    this._renderReduxModePanel();

    this._stateContainer = createElementWithClass('div', 'remote-debug-redux-state');
    this._getStateButton = UI.createTextButton(Common.UIString('Get latest redux state'), this._handleReduxState.bind(this), '', true);
    this._clearStateButton = UI.createTextButton(Common.UIString('Clear'), this._clearReduxState.bind(this));
    this._jsonViewContainer = createElementWithClass('div', 'remote-debug-redux-json-view');

    this._clearStateButton.style.display = 'none';
    this._stateContainer.appendChild(this._getStateButton);
    this._stateContainer.appendChild(this._clearStateButton);
    this._stateContainer.appendChild(this._jsonViewContainer);
    this.contentElement.appendChild(this._stateContainer);
    const reduxCheckText = createElementWithClass('div', 'support-redux-text');
    if (window.__REDUX_DEVTOOLS_EXTENSION__) {
      reduxCheckText.innerText = 'You have installed redux devTools extension. Just open the devTools and use that extension to inspect redux on the target side.'
    } else {
      reduxCheckText.innerHTML = 'You have not installed redux devTools extension, please follow the tips <a href="https://github.com/zalmoxisus/redux-devtools-extension#installation" target="_blank" rel="noopener norefferrer">here</a> to install.';
    }
    this.contentElement.appendChild(reduxCheckText);
    const script = document.createElement('script');
    script.src = '/scripts/redux-devtools.js';
    document.body.append(script);
  }

  _renderReduxModePanel() {
    this.ReduxModePanel.innerHTML = '<span>Redux Mode   </span>';
    const selectId = 'ReduxMode';

    const label = createElement('label');
    label.setAttribute('for', selectId);
    this.contentElement.appendChild(label);

    const select = createElement('select');
    select.className = 'chrome-select';
    select.id = selectId;

    ['enable', 'disable'].forEach(name => {
      const option = createElement('option');
      option.setAttribute('value', name);
      option.innerHTML = name;
      select.appendChild(option);
    });
    this.ReduxModePanel.appendChild(select);
    select.addEventListener('change', this._toggleReduxMode);
  }

  wasShown() {
    callDebugBridge('Redux', 'getStatus').then((result) => {
      const value = result ? 'enable' : 'disable';
      this.ReduxModePanel.querySelector(`[value=${value}]`).selected = true;
    });
  }

  async _toggleReduxMode() {
    const { value } = this;
    try {
      await callDebugBridge('Redux', value);
    } catch (ex) {
      UI.MessageDialog.show(Common.UIString('Toggle Redux mode failed'));
    }
  }

  async _handleReduxState() {
    this.disabled = true;
    try {
      const reduxState = await callDebugBridge('Redux', 'getState');
      this._displayReduxState(reduxState);
    } catch (ex) {
      UI.MessageDialog.show(Common.UIString('Get latest redux state failed:\n%s.', ex.message));
    }
    this.disabled = false;
  }

  _displayReduxState(state) {
    this._clearReduxState();
    this._jsonView = SourceFrame.JSONView.createViewSync(state);
    this._jsonView.show(this._jsonViewContainer);
    this._clearStateButton.style.display = '';
  }

  _clearReduxState() {
    this._jsonView && this._jsonView.detach();
  }
}
