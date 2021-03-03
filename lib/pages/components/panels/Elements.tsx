import React, { useState } from 'react';
import { Button } from 'semantic-ui-react';

const Elements: React.FunctionComponent = () => {
  const [text, setText] = useState('Click and see what I will be');

  return (
    <React.Fragment>
      <h3>Change button text</h3>
      <p>You can check the changing text in the remote inspector below.</p>
      <Button onClick={(): void => setText('Click ' + Math.random())}>{text}</Button>
    </React.Fragment>
  );
};

export default Elements;
