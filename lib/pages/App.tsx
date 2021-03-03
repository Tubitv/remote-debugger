import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import 'semantic-ui-css/semantic.min.css';

import { Provider } from 'react-redux';

import Demo from './Demo/Demo';
import { store } from './store';

const App: React.FunctionComponent = () => {
  return (
    <Provider store={store}>
      <Router>
        <Switch>
          <Route path="/demo" component={Demo} exact />
        </Switch>
      </Router>
    </Provider>
  );
};

export default App;
