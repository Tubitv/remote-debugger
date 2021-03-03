import React, { ReactElement } from 'react';
import { Button, Header } from 'semantic-ui-react';

import { connect } from 'react-redux';

import { activateText, closeText, TextState } from '../../store';

export function Redux({ text, activateText, closeText }: {
  text: TextState;
  activateText: (text: TextState) => void;
  closeText: () => void;
}): ReactElement {
  return (
    <React.Fragment>
      <Header>Redux View</Header>
      <p>You can use Redux devtools on your web app with the relay of the remote debugger. Let's see how it runs.</p>
      <p>First of all, make sure you have enabled Redux mode. You can toggle it from RemoteDebug -> Redux -> Redux Mode.</p>
      <p>If you have enabled it, now you can open the inspector and check on the Redux panel. You can press the button below to simulate an action. You can see the Redux change there.</p>
      {text.title ? (
        <Button onClick={closeText}>Hide the Text</Button>
      ) : (
        <Button onClick={(): void => { activateText({ title: 'Hello World!' }); }}>Show the text!</Button>
      )}
      {text.title && <Header>{text.title}</Header>}
    </React.Fragment>
  );
}

const mapStateToProps = (state: { text: TextState }): { text: TextState } => ({
  text: state.text,
});

const mapDispatchToProps = {
  activateText,
  closeText,
};

const ReduxContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(Redux);

export default ReduxContainer;
