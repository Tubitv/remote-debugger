import React from 'react';
import { Button } from 'semantic-ui-react';

const imgId = 'requestedImage';
const buttons = [
  {
    text: 'Load an image',
    onClick: (): void => {
      const imgElement = document.querySelector(`#${imgId}`) as HTMLImageElement;
      imgElement.src = 'https://loremflickr.com/1280/960/kitten?timestamp=' + Math.random();
    },
  },
  {
    text: 'Make a fetch for json',
    onClick: (): void => {
      fetch('http://www.mocky.io/v2/5d8dca2a310000b6032b5060');
    },
  },
  {
    text: 'Make a fetch for csv',
    onClick: (): void => {
      fetch('https://gist.githubusercontent.com/tyrchen/32c50aadca48aee3da10a77a18479517/raw/3aa07629e61239cd26cf514584c949a98aa38d67/movies.csv');
    },
  },
  {
    text: 'Make a fetch with 404',
    onClick: (): void => {
      fetch('http://www.mocky.io/v2/5d8dc');
    },
  },
  {
    text: 'Make a failed fetch',
    onClick: (): void => {
      fetch('https://error.com/');
    },
  },
  {
    text: 'Make a xhr for json',
    onClick: (): void => {
      const oReq = new XMLHttpRequest();
      oReq.open('GET', 'http://www.mocky.io/v2/5d8dca2a310000b6032b5060', true);
      oReq.send();
    },
  },
  {
    text: 'Make a xhr with 500',
    onClick: (): void => {
      const oReq = new XMLHttpRequest();
      oReq.open('GET', 'http://www.mocky.io/v2/5d8dca2a', true);
      oReq.send();
    },
  },
  {
    text: 'Make a xhr then abort',
    onClick: (): void => {
      const oReq = new XMLHttpRequest();
      oReq.open('GET', 'http://www.mocky.io/v2/5d8dca2a', true);
      oReq.abort();
    },
  },
  {
    text: 'Send an Image beacon',
    onClick: (): void => {
      const img = new Image();
      img.src = 'https://loremflickr.com/1280/960/kitten?timestamp=' + Math.random();
    },
  },
  {
    text: 'Send an navigator beacon',
    onClick: (): void => {
      navigator.sendBeacon('https://loremflickr.com/1280/960/kitten?timestamp=' + Math.random(), JSON.stringify({ test: 1 }));
    },
  },
];

const Network: React.FunctionComponent = () => {
  return (
    <React.Fragment>
      <h3>Send requests</h3>
      <p>Click the buttons and you can inspect different types of requests in the network panel of the remote inspector.</p>
      {buttons.map(({ text, onClick }) => <Button key={text} onClick={onClick} style={{ marginBottom: '5px' }}>{text}</Button>)}
      <img style={{ display: 'block', marginTop: '10px' }} id={imgId} />
    </React.Fragment>
  );
};

export default Network;
