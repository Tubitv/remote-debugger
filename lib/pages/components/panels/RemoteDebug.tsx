import React, { useState } from 'react';
import { Button, Input } from 'semantic-ui-react';

const RemoteDebug: React.FunctionComponent = () => {
  const [url, setUrl] = useState('https://www.google.com');
  const buttons = [
    {
      text: 'fetch by URL',
      onClick: (): void => {
        fetch(url);
      },
    },
    {
      text: 'fetch by Request',
      onClick: (): void => {
        fetch(new Request(url));
      },
    },
    {
      text: 'XMLHttpRequest',
      onClick: (): void => {
        const oReq = new XMLHttpRequest();
        oReq.open('GET', url, true);
        oReq.send();
      },
    },
  ];

  return (
    <React.Fragment>
      <h3>Network mock</h3>
      <p>You can mock network in the RemoteDebug panel of the remote inspector and check it by sending the mocked URLs.</p>
      <div style={{ marginBottom: '10px' }}>
        <Input
          placeholder='URL...'
          defaultValue={url}
          onChange={ (event: React.ChangeEvent<HTMLInputElement>, { value }: { value: string}): void => setUrl(value) }
          style={{ width: '400px' }}
        />
      </div>
      {buttons.map(({ text, onClick }) => <Button key={text} onClick={onClick}>{text}</Button>)}
    </React.Fragment>
  );
};

export default RemoteDebug;
