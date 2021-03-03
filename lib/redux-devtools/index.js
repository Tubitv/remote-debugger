import { createStore, compose } from 'redux';

const actionToPayloadMap = new Map();
const enhancer = compose(window.__REDUX_DEVTOOLS_EXTENSION__ ? window.__REDUX_DEVTOOLS_EXTENSION__() : noop => noop);
const myStore = createStore((state = {}, action) => {
  const payload = actionToPayloadMap.get(action);
  if (payload) {
    actionToPayloadMap.delete(action);
  }
  return payload || state;
}, {}, enhancer);
const SDK = window.SDK;

SDK.targetManager.addModelListener(
  SDK.ReduxModel,
  SDK.ReduxModel.Events.ReduxRelay, ({ data: { action, instanceId, isExcess, name, nextActionId, payload, type } }) => {
    const realAction = action.action || { type: '@@INIT' };
    actionToPayloadMap.set(realAction, payload);
    myStore.dispatch(realAction);
  });
