import React from 'react';
import { Button, Icon } from 'semantic-ui-react';

const buttons = [
  {
    text: 'Print logs',
    onClick: (): void => console.log('Call console.log with a random number: ' + Math.random()),
  },
  {
    text: 'Print debug logs',
    onClick: (): void => console.debug('Call console.debug with a random number: ' + Math.random()),
  },
  {
    text: 'Print warn logs',
    onClick: (): void => console.warn('Call console.warn with a random number: ' + Math.random()),
  },
  {
    text: 'Print warn logs with an error and an event',
    onClick: (): void => console.warn('Call console.warn with a random number: ' + Math.random(), new Error('test'), new Event('look', { bubbles: true, cancelable: false })),
  },
  {
    text: 'Print error logs',
    onClick: (): void => console.error('Call console.error with a random number: ' + Math.random()),
  },
];

const copy = (text: string): void => {
  navigator?.clipboard?.writeText(text);
};

const Console: React.FunctionComponent = () => {
  const experimentId = 'experiment';
  const code = `document.querySelector('#${experimentId}').textContent = 'On'`;
  const copyButton = <Button icon onClick={(): void => copy(code)}><Icon name="copy"/></Button>;

  return (
    <React.Fragment>
      <h3>Console logs</h3>
      <p>Click the buttons and you will the console logs in the remote inspector below.</p>
      {buttons.map(({ text, onClick }) => <Button key={text} onClick={onClick}>{text}</Button>)}
      <h3>Remote control</h3>
      <p>Run <code id="code" style={{ backgroundColor: '#ccc' }}>{code}</code> {copyButton} in the connected DevTools console and check the text bellow.</p>
      <p>Experiment: <span id={experimentId} style={{ fontWeight: 'bold' }}>Off</span></p>
    </React.Fragment>
  );
};

export default Console;
