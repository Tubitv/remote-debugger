/* eslint-disable */
/**
 * This file is copied from https://github.com/zalmoxisus/remote-redux-devtools/blob/master/src/devTools.js
 * I replace this socket logic with the remote debugger socket in this file.
 */
import { stringify, parse } from 'jsan';
import instrument from 'redux-devtools-instrument';
import { evalAction, getActionsArray } from 'redux-devtools-core/lib/utils';
import catchErrors from 'redux-devtools-core/lib/utils/catchErrors';
import {
  getLocalFilter,
  isFiltered,
  filterStagedActions,
  filterState
} from 'redux-devtools-core/lib/utils/filters';
import Cookie from 'js-cookie';

import { REDUX_MODE_NAMESPACE } from '../../utils/constant';
import { getRemoteDebuggerOption } from '../../utils/common';

function configureStore(next, subscriber, options) {
  return instrument(subscriber, options)(next);
}

function async(fn) {
  setTimeout(fn, 0);
}

function str2array(str) {
  return typeof str === 'string' ? [str] : str && str.length;
}

function getRandomId() {
  return Math.random().toString(36).substr(2);
}

export class DevToolsEnhancer {
  static setRemoteDebugger(remoteDebugger) {
    this.remoteDebugger = remoteDebugger;
  }

  get remoteDebugger() {
    return DevToolsEnhancer.remoteDebugger || window.remoteDebuggerLauncher.remoteDebugger;
  }

  constructor() {
    this.enhance.updateStore = newStore => {
      console.warn('devTools.updateStore is deprecated use composeWithDevTools instead: ' +
        'https://github.com/zalmoxisus/remote-redux-devtools#use-devtools-compose-helper');
      this.store = newStore;
    };
  }

  getLiftedStateRaw() {
    return this.store.liftedStore.getState();
  }

  getLiftedState() {
    return filterStagedActions(this.getLiftedStateRaw(), this.filters);
  }

  send = () => {
    if (!this.instanceId) this.instanceId = this.socket && this.socket.id || getRandomId();
    try {
      fetch(this.sendTo, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          type: 'STATE',
          id: this.instanceId,
          name: this.instanceName,
          payload: stringify(this.getLiftedState())
        })
      }).catch(function (err) {
        console.log(err);
      });
    } catch (err) {
      console.log(err);
    }
  };

  relay(type, state, action, nextActionId) {
    const message = {
      type,
      name: this.instanceName,
      instanceId: this.appInstanceId,
    };
    if (state) {
      message.payload = type === 'ERROR' ? state :
        stringify(filterState(state, type, this.filters, this.stateSanitizer, this.actionSanitizer, nextActionId));
    }
    if (type === 'ACTION') {
      message.action = stringify(
        !this.actionSanitizer ? action : this.actionSanitizer(action.action, nextActionId - 1)
      );
      message.isExcess = this.isExcess;
      message.nextActionId = nextActionId;
    } else if (action) {
      message.action = action;
    }
    if (this.remoteDebugger && getRemoteDebuggerOption(REDUX_MODE_NAMESPACE)) {
      this.remoteDebugger.execute('Redux.reduxRelay', message);
    }
  }

  dispatchRemotely(action) {
    try {
      const result = evalAction(action, this.actionCreators);
      this.store.dispatch(result);
    } catch (e) {
      this.relay('ERROR', e.message);
    }
  }

  handleMessages = (message) => {
    if (
      message.type === 'IMPORT' || message.type === 'SYNC'
    ) {
      this.store.liftedStore.dispatch({
        type: 'IMPORT_STATE', nextLiftedState: parse(message.state)
      });
    } else if (message.type === 'UPDATE') {
      this.relay('STATE', this.getLiftedState());
    } else if (message.type === 'START') {
      this.isMonitored = true;
      if (typeof this.actionCreators === 'function') this.actionCreators = this.actionCreators();
      this.relay('STATE', this.getLiftedState(), this.actionCreators);
    } else if (message.type === 'STOP' || message.type === 'DISCONNECTED') {
      this.isMonitored = false;
      this.relay('STOP');
    } else if (message.type === 'ACTION') {
      this.dispatchRemotely(message.action);
    } else if (message.type === 'DISPATCH') {
      this.store.liftedStore.dispatch(message.action);
    }
  };

  sendError = (errorAction) => {
    // Prevent flooding
    if (errorAction.message && errorAction.message === this.lastErrorMsg) return;
    this.lastErrorMsg = errorAction.message;

    async(() => {
      this.store.dispatch(errorAction);
      if (!this.started) this.send();
    });
  };

  init(options) {
    this.instanceName = options.name;
    this.appInstanceId = getRandomId();
    const { blacklist, whitelist } = options.filters || {};
    this.filters = getLocalFilter({
      actionsBlacklist: blacklist || options.actionsBlacklist,
      actionsWhitelist: whitelist || options.actionsWhitelist
    });

    this.suppressConnectErrors = options.suppressConnectErrors !== undefined ? options.suppressConnectErrors : true;

    this.startOn = str2array(options.startOn);
    this.stopOn = str2array(options.stopOn);
    this.sendOn = str2array(options.sendOn);
    this.sendOnError = options.sendOnError;
    if (this.sendOn || this.sendOnError) {
      this.sendTo = options.sendTo ||
        `${this.socketOptions.secure ? 'https' : 'http'}://${this.socketOptions.hostname}:${this.socketOptions.port}`;
      this.instanceId = options.id;
    }
    if (this.sendOnError === 1) catchErrors(this.sendError);

    if (options.actionCreators) this.actionCreators = () => getActionsArray(options.actionCreators);
    this.stateSanitizer = options.stateSanitizer;
    this.actionSanitizer = options.actionSanitizer;
  }

  login() {
    this.started = true;
    this.isMonitored = true;
    this.relay('START');
  }

  stop = (keepConnected) => {
    this.started = false;
    this.isMonitored = false;
  };

  start = () => {
    if (this.started) {
      return;
    }
    this.login();
  };

  checkForReducerErrors = (liftedState = this.getLiftedStateRaw()) => {
    if (liftedState.computedStates[liftedState.currentStateIndex].error) {
      if (this.started) this.relay('STATE', filterStagedActions(liftedState, this.filters));
      else this.send();
      return true;
    }
    return false;
  };

  monitorReducer = (state = {}, action) => {
    this.lastAction = action.type;
    if (!this.started && this.sendOnError === 2 && this.store.liftedStore) async(this.checkForReducerErrors);
    else if (action.action) {
      if (this.startOn && !this.started && this.startOn.indexOf(action.action.type) !== -1) async(this.start);
      else if (this.stopOn && this.started && this.stopOn.indexOf(action.action.type) !== -1) async(this.stop);
      else if (this.sendOn && !this.started && this.sendOn.indexOf(action.action.type) !== -1) async(this.send);
    }
    return state;
  };

  handleChange(state, liftedState, maxAge) {
    if (this.checkForReducerErrors(liftedState)) return;

    if (this.lastAction === 'PERFORM_ACTION') {
      const nextActionId = liftedState.nextActionId;
      const liftedAction = liftedState.actionsById[nextActionId - 1];
      if (isFiltered(liftedAction.action, this.filters)) return;
      this.relay('ACTION', state, liftedAction, nextActionId);
      if (!this.isExcess && maxAge) this.isExcess = liftedState.stagedActionIds.length >= maxAge;
    } else {
      if (this.lastAction === 'JUMP_TO_STATE') return;
      if (this.lastAction === 'PAUSE_RECORDING') {
        this.paused = liftedState.isPaused;
      } else if (this.lastAction === 'LOCK_CHANGES') {
        this.locked = liftedState.isLocked;
      }
      if (this.paused || this.locked) {
        if (this.lastAction) this.lastAction = undefined;
        else return;
      }
      this.relay('STATE', filterStagedActions(liftedState, this.filters));
    }
  }

  enhance = (options = {}) => {
    this.init({
      ...options,
      hostname: 'localhost',
    });
    const realtime = true;
    if (!realtime && !(this.startOn || this.sendOn || this.sendOnError)) return f => f;

    const maxAge = options.maxAge || 30;
    return next => {
      return (reducer, initialState) => {
        this.store = configureStore(
          next, this.monitorReducer, {
            maxAge,
            trace: options.trace,
            traceLimit: options.traceLimit,
            shouldCatchErrors: !!this.sendOnError,
            shouldHotReload: options.shouldHotReload,
            shouldRecordChanges: options.shouldRecordChanges,
            shouldStartLocked: options.shouldStartLocked,
            pauseActionType: options.pauseActionType || '@@PAUSED'
          }
        )(reducer, initialState);

        if (realtime) this.start();
        this.store.subscribe(() => {
          if (this.isMonitored) this.handleChange(this.store.getState(), this.getLiftedStateRaw(), maxAge);
        });
        return this.store;
      };
    };
  }
}

export default (...args) => new DevToolsEnhancer().enhance(...args);

const compose = (options) => (...funcs) => (...args) => {
  const devToolsEnhancer = new DevToolsEnhancer();

  function preEnhancer(createStore) {
    return (reducer, preloadedState, enhancer) => {
      devToolsEnhancer.store = createStore(reducer, preloadedState, enhancer);
      return {
        ...devToolsEnhancer.store,
        dispatch: (action) => (
          devToolsEnhancer.locked ? action : devToolsEnhancer.store.dispatch(action)
        )
      };
    };
  }

  return [preEnhancer, ...funcs].reduceRight(
    (composed, f) => f(composed), devToolsEnhancer.enhance(options)(...args)
  );
};

export function composeWithDevTools(...funcs) {
  if (funcs.length === 0) {
    return new DevToolsEnhancer().enhance();
  }
  if (funcs.length === 1 && typeof funcs[0] === 'object') {
    return compose(funcs[0]);
  }
  return compose({})(...funcs);
}
