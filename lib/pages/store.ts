import {
  CombinedState,
  combineReducers,
  createStore,
  Store,
} from 'redux';
import { get } from 'lodash';

export type TextState = { title?: string };

// actions.js
export const activateText = (text: TextState): {
  type: 'ACTIVATE_TEXT';
  text: TextState;
} => ({
  type: 'ACTIVATE_TEXT',
  text,
});

export const closeText = (): {
  type: 'CLOSE_TEXT';
} => ({
  type: 'CLOSE_TEXT',
});

// reducers.js
export const text = (state = {}, action: {
  type: 'ACTIVATE_TEXT';
  text: TextState;
} | {
  type: 'CLOSE_TEXT';
}): TextState => {
  switch (action.type) {
  case 'ACTIVATE_TEXT':
    return action.text;
  case 'CLOSE_TEXT':
    return {};
  default:
    return state;
  }
};

export const reducers = combineReducers({
  text,
});

// store.js
export function configureStore(initialState = {}): Store<CombinedState<TextState>> {
  const remoteDebuggerReduxDevToolCompose = get(window, ['remoteDebuggerLauncher', 'composeWithDevTools']);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const composeEnhancers = remoteDebuggerReduxDevToolCompose({ trace: true }) as any;
  const store = composeEnhancers()(createStore)(reducers, initialState);
  return store;
};

export const store = configureStore();
